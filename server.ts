import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// --- Gemini Server-Side Client (Used ONLY for Text Test, AI Question Challenge, and Question Drafting) ---
const MODEL_NAME = 'gemini-4-hydrogen';

import {
  ClientDisconnectedError,
  ServerTimeoutError,
  classifyGeminiError,
  isTransientServerRetryable,
  parseJsonFromGemini,
} from './serverAiUtils.ts';
import {
  CHALLENGE_ANALYSIS_SCHEMA,
  SYSTEM_SAFETY_RULES,
  TEXT_ANALYSIS_SCHEMA,
  buildChallengeAnalysisPrompt,
  buildTextAnalysisPrompt,
  buildVerifiedAnalysisResult,
  evaluateChallengePreflight,
  evaluateTextPreflight,
  parseRawAnalysisJson,
} from './serverAnalysis.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function runGeminiCall<T>(params: {
  res: Response;
  timeoutMs: number;
  maxRetries?: number;
  operation: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  const { res, timeoutMs, maxRetries = 1, operation } = params;
  let clientClosed = false;

  const onResClose = () => {
    if (!res.writableEnded) {
      clientClosed = true;
    }
  };
  res.once('close', onResClose);

  let lastError: unknown;
  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (clientClosed) {
        throw new ClientDisconnectedError();
      }

      const controller = new AbortController();
      let timedOut = false;
      const closeHandler = () => {
        if (!res.writableEnded) {
          clientClosed = true;
          controller.abort();
        }
      };
      res.once('close', closeHandler);

      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      try {
        const result = await Promise.race([
          operation(controller.signal),
          new Promise<never>((_resolve, reject) => {
            controller.signal.addEventListener(
              'abort',
              () => {
                if (clientClosed) {
                  reject(new ClientDisconnectedError());
                } else if (timedOut) {
                  reject(new ServerTimeoutError());
                } else {
                  reject(new Error('Request aborted.'));
                }
              },
              { once: true }
            );
          }),
        ]);
        return result;
      } catch (err: unknown) {
        lastError = err;
        if (timedOut) {
          lastError = new ServerTimeoutError();
        }
        if (clientClosed || !isTransientServerRetryable(lastError) || attempt === maxRetries) {
          throw lastError;
        }
        await new Promise((resolve) => setTimeout(resolve, 650));
      } finally {
        clearTimeout(timer);
        res.removeListener('close', closeHandler);
      }
    }
  } finally {
    res.removeListener('close', onResClose);
  }

  throw lastError;
}

// --- Sliding-Window Rate Limiting ---
interface RateRecord {
  timestamps: number[];
}
const rateLimitStore = new Map<string, RateRecord>();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 40;
const BURST_WINDOW_MS = 30 * 1000; // 30 seconds
const MAX_REQUESTS_PER_BURST = 8;

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function checkAiRateLimit(req: Request, res: Response): boolean {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = rateLimitStore.get(ip) ?? { timestamps: [] };
  record.timestamps = record.timestamps.filter((ts) => now - ts < WINDOW_MS);

  const recentBurst = record.timestamps.filter((ts) => now - ts < BURST_WINDOW_MS);
  if (recentBurst.length >= MAX_REQUESTS_PER_BURST) {
    const oldestBurst = recentBurst[0] ?? now;
    const retryAfterSeconds = Math.max(3, Math.min(30, Math.ceil((BURST_WINDOW_MS - (now - oldestBurst)) / 1000)));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: 'Too many AI requests sent in quick succession.',
      code: 'RATE_LIMITED',
      retryAfterSeconds,
      retryable: true,
      nextStep: `Wait ${retryAfterSeconds} seconds for the cooldown timer, then click Retry.`,
    });
    return false;
  }

  if (record.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestWindow = record.timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(15, Math.min(120, Math.ceil((WINDOW_MS - (now - oldestWindow)) / 1000)));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: 'Session AI request limit reached temporarily.',
      code: 'RATE_LIMITED',
      retryAfterSeconds,
      retryable: true,
      nextStep: `Wait ${retryAfterSeconds} seconds before clicking Retry.`,
    });
    return false;
  }

  record.timestamps.push(now);
  rateLimitStore.set(ip, record);

  if (rateLimitStore.size > 1000) {
    for (const [key, val] of rateLimitStore.entries()) {
      if (val.timestamps.length === 0 || now - val.timestamps[val.timestamps.length - 1] > WINDOW_MS) {
        rateLimitStore.delete(key);
      }
    }
  }
  return true;
}

function aiRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (checkAiRateLimit(req, res)) {
    next();
  }
}

const challengeWriteStore = new Map<string, RateRecord>();
const CHALLENGE_WINDOW_MS = 10 * 60 * 1000;
const MAX_CHALLENGE_WRITES_PER_WINDOW = 30;

function challengeWriteLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = challengeWriteStore.get(ip) ?? { timestamps: [] };
  record.timestamps = record.timestamps.filter((ts) => now - ts < CHALLENGE_WINDOW_MS);

  if (record.timestamps.length >= MAX_CHALLENGE_WRITES_PER_WINDOW) {
    const retryAfterSeconds = 60;
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: 'Too many challenges created or submitted in a short period.',
      code: 'RATE_LIMITED',
      retryAfterSeconds,
      retryable: true,
      nextStep: 'Wait 60 seconds and click Retry.',
    });
    return;
  }

  record.timestamps.push(now);
  challengeWriteStore.set(ip, record);

  if (challengeWriteStore.size > 1000) {
    for (const [key, val] of challengeWriteStore.entries()) {
      if (val.timestamps.length === 0 || now - val.timestamps[val.timestamps.length - 1] > CHALLENGE_WINDOW_MS) {
        challengeWriteStore.delete(key);
      }
    }
  }
  next();
}

// --- Persistent Challenge Storage (File-Backed + In-Memory Cache) ---
interface StoredQuestion {
  id: string;
  prompt: string;
  hint: string;
}

interface StoredVerdictItem {
  questionId: string;
  question: string;
  answer: string;
  outcome: 'TRUE' | 'LIE';
  verdictLabel: 'TRUE – NOT LYING' | 'LIE – CAUGHT!';
}

interface StoredCompletedResult {
  challengeId: string;
  friendAName: string;
  friendBName: string;
  theme: string;
  submittedAt: number;
  totalQuestions: number;
  totalTrue: number;
  totalLie: number;
  overallSummary: string;
  items: StoredVerdictItem[];
}

interface StoredChallenge {
  challengeId: string;
  friendAName: string;
  theme: string;
  status: 'open' | 'completed';
  questions: StoredQuestion[];
  createdAt: number;
  expiresAt: number;
  result?: StoredCompletedResult;
}

const CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_STORED_CHALLENGES = 1000;
const DATA_DIR = path.resolve(__dirname, '.data');
const DATA_FILE = path.join(DATA_DIR, 'challenges.json');
const challengeStore = new Map<string, StoredChallenge>();

function loadChallengesFromDisk(): void {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const now = Date.now();
    for (const item of parsed) {
      if (item && typeof item.challengeId === 'string' && item.expiresAt > now) {
        challengeStore.set(item.challengeId, item as StoredChallenge);
      }
    }
  } catch (err) {
    console.warn('Could not load persisted challenges:', err);
  }
}

function persistChallengesToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload = JSON.stringify(Array.from(challengeStore.values()));
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, payload, 'utf8');
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.warn('Could not persist challenges to disk:', err);
  }
}

function pruneChallenges(): void {
  const now = Date.now();
  let changed = false;
  for (const [id, item] of challengeStore.entries()) {
    if (item.expiresAt <= now) {
      challengeStore.delete(id);
      changed = true;
    }
  }
  while (challengeStore.size >= MAX_STORED_CHALLENGES) {
    const oldestKey = challengeStore.keys().next().value;
    if (!oldestKey) break;
    challengeStore.delete(oldestKey);
    changed = true;
  }
  if (changed) {
    persistChallengesToDisk();
  }
}

loadChallengesFromDisk();

function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLen);
}

/**
 * Generates an entertaining summary strictly from the random TRUE/LIE counts.
 * Never reads answer text, question text, or uses AI.
 */
function buildRandomGameSummary(params: {
  friendAName: string;
  friendBName: string;
  totalTrue: number;
  totalLie: number;
  totalQuestions: number;
}): string {
  const { friendAName, friendBName, totalTrue, totalLie, totalQuestions } = params;
  const truePct = Math.round((totalTrue / Math.max(1, totalQuestions)) * 100);

  if (totalTrue === totalQuestions) {
    return `Pure green sweep! All ${totalQuestions} random verdicts landed on TRUE – NOT LYING for ${friendBName} in ${friendAName}'s challenge.`;
  }
  if (totalLie === totalQuestions) {
    return `Total red alert! Every single one of the ${totalQuestions} random verdicts triggered LIE – CAUGHT! for ${friendBName} in ${friendAName}'s challenge.`;
  }
  if (truePct >= 70) {
    return `Smooth streak! ${friendBName} rolled ${totalTrue} TRUE – NOT LYING verdicts and ${totalLie} LIE – CAUGHT! alarms across ${friendAName}'s ${totalQuestions} questions.`;
  }
  if (truePct <= 30) {
    return `Alarm bells were busy! ${friendBName} drew ${totalLie} LIE – CAUGHT! verdicts and ${totalTrue} TRUE – NOT LYING outcomes out of ${totalQuestions} questions from ${friendAName}.`;
  }
  return `Right down the middle! Out of ${totalQuestions} questions from ${friendAName}, the randomizer dealt ${friendBName} ${totalTrue} TRUE – NOT LYING and ${totalLie} LIE – CAUGHT! verdicts.`;
}

// --- Express App Setup ---
async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '128kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // 1. Text Test Analysis (Gemini + Deterministic Scoring & Grounding)
  app.post('/api/analyze-text', async (req: Request, res: Response) => {
    try {
      const text = sanitizeText(req.body?.text, 3000);
      const preflight = evaluateTextPreflight(text);

      if (preflight.kind === 'validation_error' && preflight.errorPayload) {
        res.status(400).json(preflight.errorPayload);
        return;
      }

      if (preflight.kind === 'insufficient_evidence' && preflight.insufficientResult) {
        res.json(preflight.insufficientResult);
        return;
      }

      if (!checkAiRateLimit(req, res)) {
        return;
      }

      const ai = getAiClient();
      const parsed = await runGeminiCall({
        res,
        timeoutMs: 25000,
        maxRetries: 1,
        operation: async (abortSignal) => {
          const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: buildTextAnalysisPrompt(text),
            config: {
              abortSignal,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              systemInstruction: SYSTEM_SAFETY_RULES,
              responseMimeType: 'application/json',
              responseSchema: TEXT_ANALYSIS_SCHEMA,
            },
          });

          return parseJsonFromGemini(response.text, (raw) =>
            parseRawAnalysisJson(raw, 'internalConsistency')
          );
        },
      });

      const verified = buildVerifiedAnalysisResult({
        mode: 'text',
        parsed,
        sourceTexts: [text],
        injectionInfo: preflight.injectionInfo,
      });

      res.json(verified);
    } catch (err) {
      if (err instanceof ClientDisconnectedError || res.writableEnded) return;
      const classified = classifyGeminiError(err);
      if (classified.retryAfterSeconds) {
        res.setHeader('Retry-After', String(classified.retryAfterSeconds));
      }
      res.status(classified.status).json(classified.payload);
    }
  });

  // 2. Generate Questions (5 for Solo AI Question Challenge, or 20 for Friend Truth Challenge drafting)
  app.post('/api/generate-questions', aiRateLimiter, async (req: Request, res: Response) => {
    try {
      const theme = sanitizeText(req.body?.theme, 60) || 'Wildcard Mix';
      const requestedCount = Number(req.body?.count);
      const count = requestedCount === 20 ? 20 : 5;
      const ai = getAiClient();

      const promptInstruction =
        count === 20
          ? `Generate an array of exactly 20 fun, punchy, light-hearted party questions for friends on the theme "${theme}". Mix playful habits, funny hypotheticals, friendly confessions, and quick preferences. Every question must be a single clear sentence of at least 10 characters, and the array must contain all 20 distinct items.`
          : `Generate exactly 5 fun, clever, conversational open-ended questions for the theme "${theme}". Design the 5 questions as a connected mini-set so that subtle overlaps or value trade-offs across questions make it entertaining to compare a person's answers for internal consistency (without being intrusive, offensive, or overly personal).`;

      const validatedQuestions = await runGeminiCall({
        res,
        timeoutMs: count === 20 ? 30000 : 25000,
        maxRetries: 1,
        operation: async (abortSignal) => {
          const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: promptInstruction,
            config: {
              abortSignal,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              systemInstruction: SYSTEM_SAFETY_RULES,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        prompt: {
                          type: Type.STRING,
                          description: 'A punchy, engaging single-sentence question.',
                        },
                        hint: {
                          type: Type.STRING,
                          description: 'A brief 4-8 word conversational nudge.',
                        },
                      },
                      required: ['prompt', 'hint'],
                    },
                  },
                },
                required: ['questions'],
              },
            },
          });

          return parseJsonFromGemini(response.text, (raw) => {
            if (!raw || typeof raw !== 'object') return null;
            const list = (raw as { questions?: unknown }).questions;
            if (!Array.isArray(list)) return null;
            const cleaned = list
              .filter((q): q is { prompt: string; hint?: string } =>
                Boolean(q && typeof q === 'object' && typeof (q as { prompt?: unknown }).prompt === 'string' && (q as { prompt: string }).prompt.trim().length >= 5)
              )
              .slice(0, count);
            if (cleaned.length < count) return null;
            return cleaned.map((q, idx) => ({
              id: `q-${idx + 1}-${crypto.randomBytes(2).toString('hex')}`,
              prompt: q.prompt.trim().slice(0, 300),
              hint: typeof q.hint === 'string' ? q.hint.trim().slice(0, 140) : '',
            }));
          });
        },
      });

      res.json({ theme, questions: validatedQuestions });
    } catch (err) {
      if (err instanceof ClientDisconnectedError || res.writableEnded) return;
      const classified = classifyGeminiError(err);
      if (classified.retryAfterSeconds) {
        res.setHeader('Retry-After', String(classified.retryAfterSeconds));
      }
      res.status(classified.status).json(classified.payload);
    }
  });

  // 3. Analyze Solo 5-Question Challenge Answers (Gemini + Deterministic Scoring & Grounding)
  app.post('/api/analyze-challenge', async (req: Request, res: Response) => {
    try {
      const rawQuestions = Array.isArray(req.body?.questions) ? req.body.questions : [];
      const rawAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
      const theme = sanitizeText(req.body?.theme, 60) || 'Wildcard Mix';

      if (rawQuestions.length !== 5 || rawAnswers.length !== 5) {
        res.status(400).json({
          error: 'Please answer all 5 questions before running the analysis.',
          code: 'VALIDATION_ERROR',
          nextStep: 'Complete any unanswered questions and submit again.',
          retryable: false,
        });
        return;
      }

      const questions = rawQuestions.map((q: unknown) => sanitizeText(q, 300));
      const answers = rawAnswers.map((a: unknown) => sanitizeText(a, 1500));

      if (questions.some((q: string) => q.length < 5) || answers.some((a: string) => a.length < 2)) {
        res.status(400).json({
          error: 'Each question needs a valid answer before analyzing.',
          code: 'VALIDATION_ERROR',
          nextStep: 'Check that each of your 5 answers has at least 2 characters.',
          retryable: false,
        });
        return;
      }

      const insufficientChallenge = evaluateChallengePreflight(answers);
      if (insufficientChallenge) {
        res.json({ ...insufficientChallenge, theme });
        return;
      }

      if (!checkAiRateLimit(req, res)) {
        return;
      }

      const ai = getAiClient();
      const parsed = await runGeminiCall({
        res,
        timeoutMs: 25000,
        maxRetries: 1,
        operation: async (abortSignal) => {
          const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: buildChallengeAnalysisPrompt(questions, answers),
            config: {
              abortSignal,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              systemInstruction: SYSTEM_SAFETY_RULES,
              responseMimeType: 'application/json',
              responseSchema: CHALLENGE_ANALYSIS_SCHEMA,
            },
          });

          return parseJsonFromGemini(response.text, (raw) =>
            parseRawAnalysisJson(raw, 'crossAnswerAlignment')
          );
        },
      });

      const verified = buildVerifiedAnalysisResult({
        mode: 'challenge',
        parsed,
        sourceTexts: answers,
        theme,
      });

      res.json(verified);
    } catch (err) {
      if (err instanceof ClientDisconnectedError || res.writableEnded) return;
      const classified = classifyGeminiError(err);
      if (classified.retryAfterSeconds) {
        res.setHeader('Retry-After', String(classified.retryAfterSeconds));
      }
      res.status(classified.status).json(classified.payload);
    }
  });

  // 4. Friend Truth Challenge — Friend A Creates Challenge (>= 20 Questions, No Reference Answers)
  app.post('/api/challenges', challengeWriteLimiter, (req: Request, res: Response) => {
    const consentGiven = req.body?.consentGiven === true;
    if (!consentGiven) {
      res.status(400).json({
        error: 'Consent is required before storing this challenge link.',
      });
      return;
    }

    const friendAName = sanitizeText(req.body?.friendAName, 40) || 'Friend A';
    const theme = sanitizeText(req.body?.theme, 60) || 'Party Mix';
    const rawQuestions = Array.isArray(req.body?.questions) ? req.body.questions : [];

    if (rawQuestions.length < 20 || rawQuestions.length > 50) {
      res.status(400).json({
        error: 'Friend Truth Challenge requires at least 20 questions (up to 50).',
      });
      return;
    }

    const questions: StoredQuestion[] = rawQuestions.map(
      (q: { id?: unknown; prompt?: unknown; hint?: unknown }, idx: number) => ({
        id: sanitizeText(q?.id, 30) || `q-${idx + 1}-${crypto.randomBytes(2).toString('hex')}`,
        prompt: sanitizeText(q?.prompt, 300),
        hint: sanitizeText(q?.hint, 140),
      })
    );

    if (questions.some((q) => q.prompt.length < 5)) {
      res.status(400).json({
        error: 'Every question must be at least 5 characters long.',
      });
      return;
    }

    pruneChallenges();
    const challengeId = `tc_${crypto.randomBytes(5).toString('hex')}`;
    const now = Date.now();
    const expiresAt = now + CHALLENGE_TTL_MS;

    challengeStore.set(challengeId, {
      challengeId,
      friendAName,
      theme,
      status: 'open',
      questions,
      createdAt: now,
      expiresAt,
    });
    persistChallengesToDisk();

    res.json({ challengeId, expiresAt });
  });

  // 5. Fetch Friend Truth Challenge (Returns Questions OR Locked Random Results if Already Completed)
  app.get('/api/challenges/:id', (req: Request, res: Response) => {
    pruneChallenges();
    const id = String(req.params.id || '').trim();
    if (!/^tc_[a-f0-9]{10}$/.test(id)) {
      res.status(404).json({
        error: 'This challenge link is invalid or could not be found.',
      });
      return;
    }
    const record = challengeStore.get(id);
    if (!record) {
      res.status(404).json({
        error: 'This challenge link has expired or could not be found. You can create a fresh challenge anytime.',
      });
      return;
    }

    res.json({
      challengeId: record.challengeId,
      friendAName: record.friendAName,
      theme: record.theme,
      status: record.status,
      questions: record.questions,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      result: record.result,
    });
  });

  // 6. Friend B Submits All Answers -> Secure Server-Side Random TRUE/LIE Verdicts (Stored Once, Never Regenerated)
  app.post('/api/challenges/:id/submit', challengeWriteLimiter, (req: Request, res: Response) => {
    pruneChallenges();
    const id = String(req.params.id || '').trim();
    if (!/^tc_[a-f0-9]{10}$/.test(id)) {
      res.status(404).json({
        error: 'This challenge link is invalid or could not be found.',
      });
      return;
    }
    const record = challengeStore.get(id);
    if (!record) {
      res.status(404).json({
        error: 'This challenge link has expired or could not be found.',
      });
      return;
    }

    // Idempotent lock: if already submitted, return exact stored results unchanged
    if (record.status === 'completed' && record.result) {
      res.json(record.result);
      return;
    }

    const consentGiven = req.body?.consentGiven === true;
    if (!consentGiven) {
      res.status(400).json({
        error: 'Please confirm consent before submitting your answers.',
      });
      return;
    }

    const friendBName = sanitizeText(req.body?.friendBName, 40) || 'Friend B';
    const rawAnswers = Array.isArray(req.body?.friendBAnswers) ? req.body.friendBAnswers : [];

    if (rawAnswers.length !== record.questions.length) {
      res.status(400).json({
        error: `Please answer all ${record.questions.length} questions before submitting.`,
      });
      return;
    }

    const friendBAnswers = rawAnswers.map((a: unknown) => sanitizeText(a, 1500));
    if (friendBAnswers.some((a: string) => a.length < 1)) {
      res.status(400).json({
        error: 'Every question requires an answer before generating your game results.',
      });
      return;
    }

    // Secure independent CSPRNG verdict for every submitted answer.
    // Does NOT use Gemini, answer content, question content, language, or personality.
    let totalTrue = 0;
    let totalLie = 0;

    const items: StoredVerdictItem[] = record.questions.map((q, idx) => {
      const randomBit = crypto.randomInt(0, 2);
      const outcome: 'TRUE' | 'LIE' = randomBit === 0 ? 'TRUE' : 'LIE';
      if (outcome === 'TRUE') {
        totalTrue += 1;
      } else {
        totalLie += 1;
      }

      return {
        questionId: q.id,
        question: q.prompt,
        answer: friendBAnswers[idx],
        outcome,
        verdictLabel: outcome === 'TRUE' ? 'TRUE – NOT LYING' : 'LIE – CAUGHT!',
      };
    });

    const completedResult: StoredCompletedResult = {
      challengeId: record.challengeId,
      friendAName: record.friendAName,
      friendBName,
      theme: record.theme,
      submittedAt: Date.now(),
      totalQuestions: record.questions.length,
      totalTrue,
      totalLie,
      overallSummary: buildRandomGameSummary({
        friendAName: record.friendAName,
        friendBName,
        totalTrue,
        totalLie,
        totalQuestions: record.questions.length,
      }),
      items,
    };

    record.status = 'completed';
    record.result = completedResult;
    challengeStore.set(record.challengeId, record);
    persistChallengesToDisk();

    res.json(completedResult);
  });

  // --- Vite Middleware (Dev) or Static Dist (Prod) ---
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  // JSON error handler for malformed JSON / oversized payloads on /api/*
  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      err && typeof err === 'object' && 'status' in err && typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 400;
    const message =
      status === 413
        ? 'Your submission is too large. Please shorten your text and try again.'
        : 'Invalid request payload.';
    res.status(status).json({ error: message });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TruthCheck AI server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
