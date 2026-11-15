import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Eraser,
  ExternalLink,
  Link2,
  ListChecks,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  FriendChallengeCompletedResult,
  FriendChallengePublic,
} from '../types';
import { DEFAULT_20_QUESTIONS } from '../data/offlineDecks';
import {
  hasUnfinishedFriendBAnswers,
  hasUnfinishedFriendBuilderEdits,
  type FriendChallengeSessionState,
} from '../state/challengeSession';
import { playLieSound, playTrueSound, unlockAudio } from '../utils/soundEffects';
import { AppApiError, copyTextToClipboard, requestJson, toAppApiError } from '../utils/api';
import { assertValidGeneratedQuestions } from '../utils/validators';
import AnswerProgressBar from './AnswerProgressBar';
import AiErrorBanner from './AiErrorBanner';

export interface ConfirmPromptOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

interface ChallengeFriendPageProps {
  navigationSeq?: number;
  initialChallengeId: string | null;
  state: FriendChallengeSessionState;
  setState: Dispatch<SetStateAction<FriendChallengeSessionState>>;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenChallengeId: (challengeId: string) => void;
  onClearChallengeParam: () => void;
  onGoHome: () => void;
  onRequestConfirm: (opts: ConfirmPromptOptions) => void;
}

const TRANSPARENCY_NOTICE =
  'TruthCheck AI is a fun entertainment game. TRUE and LIE results are randomly generated and do not determine whether anyone is actually telling the truth.';

const MIN_QUESTIONS = 20;

const PARTY_THEMES = [
  'Party Mix',
  'Everyday Habits',
  'Funny Hypotheticals',
  'Social Confessions',
  'Wildcard Mix',
];

export default function ChallengeFriendPage({
  navigationSeq = 0,
  initialChallengeId,
  state,
  setState,
  soundEnabled,
  onToggleSound,
  onOpenChallengeId,
  onClearChallengeParam,
  onGoHome,
  onRequestConfirm,
}: ChallengeFriendPageProps) {
  const {
    friendAName,
    theme,
    questions,
    newQuestionText,
    builderConsent,
    generatingAi,
    creatingLink,
    createdChallengeId,
    builderError,
    aiError,
    loadedChallengeId,
    loadingChallenge,
    remoteChallenge,
    remoteError,
    friendBView,
    friendBName,
    friendBConsent,
    friendBAnswers,
    currentAnswerIndex,
    submittingAnswers,
    answerError,
    completedResult,
    revealIndex,
    verdictFilter,
  } = state;

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const friendBTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const builderAlertRef = useRef<HTMLDivElement | null>(null);
  const answerAlertRef = useRef<HTMLDivElement | null>(null);
  const [questionFocusTrigger, setQuestionFocusTrigger] = useState(0);

  const aiGenIdRef = useRef(state.aiEpoch);
  const aiAbortRef = useRef<AbortController | null>(null);
  const generatingAiRef = useRef(false);
  const creatingLinkRef = useRef(false);
  const submittingAnswersRef = useRef(false);

  useEffect(() => {
    if (navigationSeq > 0) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [navigationSeq]);

  useEffect(() => {
    if (questionFocusTrigger > 0) {
      const timer = window.setTimeout(() => {
        friendBTextareaRef.current?.focus({ preventScroll: true });
      }, 40);
      return () => window.clearTimeout(timer);
    }
  }, [questionFocusTrigger, currentAnswerIndex]);

  useEffect(() => {
    return () => {
      aiAbortRef.current?.abort();
    };
  }, []);

  // Load challenge from ?challenge=<id> only when needed (preserves in-progress Friend B answers across section navigation!)
  useEffect(() => {
    if (!initialChallengeId) {
      return;
    }
    if (loadedChallengeId === initialChallengeId && (remoteChallenge || completedResult)) {
      return;
    }

    let cancelled = false;
    const loadChallenge = async () => {
      setState((prev) => ({
        ...prev,
        loadingChallenge: true,
        remoteError: null,
        answerError: null,
      }));
      try {
        const payload = await requestJson<FriendChallengePublic>(
          `/api/challenges/${encodeURIComponent(initialChallengeId)}`
        );
        if (cancelled) return;

        if (payload.status === 'completed' && payload.result) {
          setState((prev) => ({
            ...prev,
            loadedChallengeId: initialChallengeId,
            loadingChallenge: false,
            remoteChallenge: payload,
            completedResult: payload.result ?? null,
            friendBView: 'dashboard',
          }));
        } else {
          setState((prev) => ({
            ...prev,
            loadedChallengeId: initialChallengeId,
            loadingChallenge: false,
            remoteChallenge: payload,
            completedResult: null,
            friendBAnswers: new Array(payload.questions.length).fill(''),
            currentAnswerIndex: 0,
            friendBView: 'intro',
          }));
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loadedChallengeId: initialChallengeId,
            loadingChallenge: false,
            remoteError:
              err instanceof Error ? err.message : 'Unable to load challenge invitation.',
          }));
        }
      }
    };

    void loadChallenge();
    return () => {
      cancelled = true;
    };
  }, [initialChallengeId, loadedChallengeId, remoteChallenge, completedResult, setState]);

  const shareUrl =
    typeof window !== 'undefined' && createdChallengeId
      ? `${window.location.origin}/?challenge=${createdChallengeId}`
      : '';

  const filteredDashboardItems = useMemo(() => {
    if (!completedResult) return [];
    if (verdictFilter === 'ALL') return completedResult.items;
    return completedResult.items.filter((item) => item.outcome === verdictFilter);
  }, [completedResult, verdictFilter]);

  const prevBuilderErrorRef = useRef<string | null>(builderError);
  const prevAnswerErrorRef = useRef<string | null>(answerError);

  useEffect(() => {
    if (builderError && prevBuilderErrorRef.current !== builderError) {
      builderAlertRef.current?.focus({ preventScroll: true });
    }
    prevBuilderErrorRef.current = builderError;
  }, [builderError]);

  useEffect(() => {
    if (answerError && prevAnswerErrorRef.current !== answerError) {
      answerAlertRef.current?.focus({ preventScroll: true });
    }
    prevAnswerErrorRef.current = answerError;
  }, [answerError]);

  // --- Friend A Actions ---
  const executeGenerate20Questions = async (selectedTheme: string) => {
    if (generatingAiRef.current) return;
    generatingAiRef.current = true;

    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;

    const reqId = ++aiGenIdRef.current;
    setState((prev) => ({
      ...prev,
      theme: selectedTheme,
      generatingAi: true,
      builderError: null,
      aiError: null,
      aiEpoch: reqId,
    }));

    try {
      const data = await requestJson<unknown>('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: selectedTheme, count: 20 }),
        timeoutMs: 35000,
        signal: controller.signal,
      });
      if (reqId !== aiGenIdRef.current || controller.signal.aborted) return;
      const validated = assertValidGeneratedQuestions(data, MIN_QUESTIONS);
      setState((prev) => {
        if (reqId !== aiGenIdRef.current) return prev;
        return {
          ...prev,
          theme: selectedTheme,
          questions: validated,
          generatingAi: false,
          aiError: null,
        };
      });
    } catch (err: unknown) {
      if (reqId !== aiGenIdRef.current) return;
      const mapped = toAppApiError(err, 'Unable to generate AI questions right now.');
      setState((prev) => ({
        ...prev,
        generatingAi: false,
        aiError: mapped,
      }));
    } finally {
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
      }
      if (reqId === aiGenIdRef.current) {
        generatingAiRef.current = false;
      }
    }
  };

  const handleGenerate20Questions = (selectedTheme: string) => {
    if (hasUnfinishedFriendBuilderEdits(state)) {
      onRequestConfirm({
        title: 'Replace custom challenge edits?',
        message:
          'Generating 20 AI questions will replace your current edited question list.',
        confirmLabel: 'Generate 20 AI Questions',
        cancelLabel: 'Keep Current Questions',
        onConfirm: () => {
          void executeGenerate20Questions(selectedTheme);
        },
      });
      return;
    }
    void executeGenerate20Questions(selectedTheme);
  };

  const handleCancelAiQuestions = () => {
    if (!generatingAi) return;
    const nextEpoch = ++aiGenIdRef.current;
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    generatingAiRef.current = false;
    setState((prev) => ({
      ...prev,
      generatingAi: false,
      aiEpoch: nextEpoch,
      aiError: new AppApiError({
        code: 'CANCELLED',
        message: 'AI question generation was cancelled.',
        nextStep:
          'Your existing 20+ questions were kept below. Edit them or retry AI generation anytime.',
        retryable: true,
      }),
    }));
  };

  const handleAddCustomQuestion = () => {
    const trimmed = newQuestionText.trim();
    if (trimmed.length < 5) {
      setState((prev) => ({
        ...prev,
        builderError: 'Please enter at least 5 characters for a custom question.',
      }));
      return;
    }
    if (questions.length >= 50) {
      setState((prev) => ({
        ...prev,
        builderError: 'Maximum of 50 questions per challenge reached.',
      }));
      return;
    }
    setState((prev) => ({
      ...prev,
      builderError: null,
      newQuestionText: '',
      questions: [
        ...prev.questions,
        {
          id: `custom-${Date.now()}-${prev.questions.length + 1}`,
          prompt: trimmed,
          hint: 'Custom question',
        },
      ],
    }));
  };

  const handleCreateChallengeLink = async () => {
    if (creatingLinkRef.current) return;
    const validQuestions = questions.filter((q) => q.prompt.trim().length >= 5);
    if (validQuestions.length < MIN_QUESTIONS) {
      setState((prev) => ({
        ...prev,
        builderError: `Please include at least ${MIN_QUESTIONS} valid questions (currently ${validQuestions.length}).`,
      }));
      return;
    }
    if (!builderConsent) {
      setState((prev) => ({
        ...prev,
        builderError:
          'Please confirm consent so we can save your challenge link and store Friend B’s results.',
      }));
      return;
    }

    creatingLinkRef.current = true;
    setState((prev) => ({
      ...prev,
      builderError: null,
      creatingLink: true,
    }));
    try {
      const data = await requestJson<{ challengeId: string }>('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friendAName: friendAName.trim() || 'Friend A',
          theme,
          questions: validQuestions,
          consentGiven: true,
        }),
        timeoutMs: 15000,
      });
      setState((prev) => ({
        ...prev,
        creatingLink: false,
        createdChallengeId: data.challengeId,
      }));
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        creatingLink: false,
        builderError:
          err instanceof Error ? err.message : 'Could not create challenge link.',
      }));
    } finally {
      creatingLinkRef.current = false;
    }
  };

  const handleCopyInviteLink = async () => {
    if (!shareUrl) return;
    const ok = await copyTextToClipboard(shareUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const executeResetBuilder = () => {
    aiGenIdRef.current += 1;
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    generatingAiRef.current = false;
    setState((prev) => ({
      ...prev,
      friendAName: '',
      theme: 'Party Mix',
      questions: DEFAULT_20_QUESTIONS.map((q) => ({ ...q })),
      newQuestionText: '',
      builderConsent: false,
      generatingAi: false,
      builderError: null,
      aiError: null,
      aiEpoch: aiGenIdRef.current,
    }));
  };

  const handleRequestResetBuilder = () => {
    if (hasUnfinishedFriendBuilderEdits(state)) {
      onRequestConfirm({
        title: 'Reset Friend Challenge builder?',
        message:
          'This restores the default 20 questions and clears your Friend A name and custom question edits.',
        confirmLabel: 'Reset Builder',
        cancelLabel: 'Keep Current Edits',
        onConfirm: executeResetBuilder,
      });
      return;
    }
    executeResetBuilder();
  };

  // --- Friend B Actions ---
  const handleStartAnswering = () => {
    if (!friendBConsent) {
      setState((prev) => ({
        ...prev,
        answerError: 'Please check the consent box to continue.',
      }));
      return;
    }
    setState((prev) => ({
      ...prev,
      answerError: null,
      friendBView: 'answering',
    }));
    setQuestionFocusTrigger((prev) => prev + 1);
  };

  const handleNextQuestion = () => {
    const current = (friendBAnswers[currentAnswerIndex] || '').trim();
    if (current.length < 1) {
      setState((prev) => ({
        ...prev,
        answerError: 'Please write an answer before moving to the next question.',
      }));
      return;
    }
    if (remoteChallenge && currentAnswerIndex < remoteChallenge.questions.length - 1) {
      setState((prev) => ({
        ...prev,
        answerError: null,
        currentAnswerIndex: prev.currentAnswerIndex + 1,
      }));
      setQuestionFocusTrigger((prev) => prev + 1);
    }
  };

  const handleClearFriendBAnswer = () => {
    setState((prev) => {
      const next = [...prev.friendBAnswers];
      next[prev.currentAnswerIndex] = '';
      return {
        ...prev,
        friendBAnswers: next,
        answerError: null,
      };
    });
    setQuestionFocusTrigger((prev) => prev + 1);
  };

  const handleSubmitAllFriendBAnswers = async () => {
    if (!remoteChallenge || submittingAnswersRef.current) return;
    const firstEmpty = friendBAnswers.findIndex((a) => a.trim().length < 1);
    if (firstEmpty !== -1) {
      setState((prev) => ({
        ...prev,
        currentAnswerIndex: firstEmpty,
        answerError: `Please answer Question ${firstEmpty + 1} before submitting.`,
      }));
      return;
    }

    if (soundEnabled) {
      unlockAudio();
    }

    submittingAnswersRef.current = true;
    setState((prev) => ({
      ...prev,
      submittingAnswers: true,
      answerError: null,
    }));
    try {
      const resultPayload = await requestJson<FriendChallengeCompletedResult>(
        `/api/challenges/${encodeURIComponent(remoteChallenge.challengeId)}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            friendBName: friendBName.trim() || 'Friend B',
            friendBAnswers,
            consentGiven: true,
          }),
          timeoutMs: 15000,
        }
      );

      setState((prev) => ({
        ...prev,
        submittingAnswers: false,
        completedResult: resultPayload,
        revealIndex: 0,
        friendBView: 'reveal',
      }));

      const firstOutcome = resultPayload.items[0]?.outcome;
      if (soundEnabled) {
        if (firstOutcome === 'TRUE') {
          playTrueSound(true);
        } else if (firstOutcome === 'LIE') {
          playLieSound(true);
        }
      }
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        submittingAnswers: false,
        answerError:
          err instanceof Error ? err.message : 'Unable to submit answers right now.',
      }));
    } finally {
      submittingAnswersRef.current = false;
    }
  };

  const triggerRevealSound = (
    outcome: 'TRUE' | 'LIE' | undefined,
    nextSoundState = soundEnabled
  ) => {
    if (!nextSoundState || !outcome) return;
    unlockAudio();
    if (outcome === 'TRUE') {
      playTrueSound(true);
    } else {
      playLieSound(true);
    }
  };

  const handleToggleSound = () => {
    onToggleSound();
  };

  const handleCopyResultSummary = async () => {
    if (!completedResult) return;
    const summary = [
      `TruthCheck AI · Random Friend Game Results`,
      `${completedResult.friendAName} vs ${completedResult.friendBName} (${completedResult.totalQuestions} questions)`,
      `TRUE – NOT LYING: ${completedResult.totalTrue}`,
      `LIE – CAUGHT!: ${completedResult.totalLie}`,
      completedResult.overallSummary,
      TRANSPARENCY_NOTICE,
    ].join('\n');

    const ok = await copyTextToClipboard(summary);
    if (ok) {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    }
  };

  const executeBrandNewChallenge = () => {
    onClearChallengeParam();
    setState((prev) => ({
      ...prev,
      createdChallengeId: null,
      loadedChallengeId: null,
      remoteChallenge: null,
      completedResult: null,
      remoteError: null,
      builderError: null,
      answerError: null,
      builderConsent: false,
      friendBConsent: false,
      friendAName: '',
      friendBName: '',
      friendBAnswers: [],
      currentAnswerIndex: 0,
      newQuestionText: '',
      revealIndex: 0,
      verdictFilter: 'ALL',
      questions: DEFAULT_20_QUESTIONS.map((q) => ({ ...q })),
      friendBView: 'intro',
    }));
  };

  const handleStartBrandNewChallenge = () => {
    if (hasUnfinishedFriendBAnswers(state)) {
      onRequestConfirm({
        title: 'Discard unfinished friend answers?',
        message:
          'Starting a new challenge builder will clear the answers you already typed for this invitation.',
        confirmLabel: 'Discard & Create New Challenge',
        cancelLabel: 'Keep Answering',
        onConfirm: executeBrandNewChallenge,
      });
      return;
    }
    executeBrandNewChallenge();
  };

  const handleAnswerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && remoteChallenge) {
      e.preventDefault();
      if (currentAnswerIndex < remoteChallenge.questions.length - 1) {
        handleNextQuestion();
      } else {
        void handleSubmitAllFriendBAnswers();
      }
    }
  };

  // =========================================================================
  // RENDER: CHALLENGE INVITATION / FRIEND B / RESULTS FLOW (?challenge=...)
  // =========================================================================
  if (initialChallengeId) {
    if (loadingChallenge) {
      return (
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#0B1228] p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" aria-hidden="true" />
            <p className="mt-4 font-display text-lg font-semibold text-white">
              Loading TruthCheck AI Challenge...
            </p>
          </div>
        </div>
      );
    }

    if (remoteError || !remoteChallenge) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <div className="rounded-2xl border border-white/10 bg-[#0B1228] p-8 text-center">
            <AlertCircle className="mx-auto h-9 w-9 text-rose-400" aria-hidden="true" />
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-4 font-display text-2xl font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              Challenge Link Unavailable
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-300">
              {remoteError || 'This challenge link has expired or could not be found.'}
            </p>
            <button
              type="button"
              onClick={handleStartBrandNewChallenge}
              className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white"
            >
              Create a New 20-Question Challenge
            </button>
          </div>
        </div>
      );
    }

    // --- FRIEND B VIEW 1: GAME INTRODUCTION ---
    if (friendBView === 'intro' && remoteChallenge.status === 'open') {
      return (
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-white/10 bg-[#0B1228] p-6 sm:p-8"
          >
            <p className="text-xs font-medium text-cyan-300">
              Friend Truth Challenge · {remoteChallenge.theme}
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-2 font-display text-3xl font-bold tracking-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:text-4xl"
            >
              {remoteChallenge.friendAName} Invited You to Play
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-300">
              Answer all <span className="font-mono font-semibold text-white tabular-nums">{remoteChallenge.questions.length}</span>{' '}
              questions below. Once you submit, the game generates a surprise{' '}
              <span className="font-semibold text-emerald-300">TRUE – NOT LYING</span> or{' '}
              <span className="font-semibold text-rose-300">LIE – CAUGHT!</span> verdict for every
              single answer.
            </p>

            {/* Mandatory Transparency Box */}
            <div className="mt-6 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4">
              <p className="text-xs font-semibold text-cyan-200">
                Important Game Transparency Notice
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-100">
                {TRANSPARENCY_NOTICE}
              </p>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label htmlFor="friend-b-name" className="block text-sm font-semibold text-white">
                  Your Name (Friend B)
                </label>
                <input
                  id="friend-b-name"
                  type="text"
                  maxLength={40}
                  value={friendBName}
                  onChange={(e) => setState((prev) => ({ ...prev, friendBName: e.target.value }))}
                  placeholder="e.g. Sam"
                  className="mt-2 w-full max-w-sm rounded-xl border border-white/15 bg-[#050814] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#050814]/80 p-4 text-xs leading-relaxed text-slate-300">
                <input
                  type="checkbox"
                  checked={friendBConsent}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      friendBConsent: e.target.checked,
                      answerError: null,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#050814] accent-cyan-400"
                />
                <span>
                  I understand this is a random entertainment game and consent to storing my name,
                  submitted answers, and generated game verdicts on this challenge link so{' '}
                  {remoteChallenge.friendAName} and I can revisit the results.
                </span>
              </label>

              {answerError && (
                <div
                  ref={answerAlertRef}
                  tabIndex={-1}
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3.5 text-sm text-rose-200 outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
                  <span>{answerError}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                <button
                  type="button"
                  onClick={handleToggleSound}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-400/40"
                >
                  {soundEnabled ? (
                    <>
                      <Volume2 className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                      <span>Sound On</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      <span>Sound Off</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleStartAnswering}
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white whitespace-nowrap shadow-[0_6px_24px_rgba(37,99,235,0.35)] hover:brightness-110"
                >
                  <span>Begin {remoteChallenge.questions.length} Questions</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      );
    }

    // --- FRIEND B VIEW 2: ANSWERING ALL QUESTIONS ---
    if (friendBView === 'answering' && remoteChallenge.status === 'open') {
      const totalQ = remoteChallenge.questions.length;
      const currentQ = remoteChallenge.questions[currentAnswerIndex];
      const currentFriendAnswer = friendBAnswers[currentAnswerIndex] || '';
      const answeredCount = friendBAnswers.filter((a) => a.trim().length > 0).length;

      return (
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
          <div className="mb-5">
            <p className="text-xs font-medium text-cyan-300">
              {remoteChallenge.friendAName}&apos;s Challenge · Answering as{' '}
              {friendBName.trim() || 'Friend B'}
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-1 font-display text-2xl font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:text-3xl"
            >
              Answer All {totalQ} Questions
            </h1>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0B1228] p-6 sm:p-8">
            {/* Visual Progress Bar & Question Navigator */}
            <div className="mb-6 space-y-3 border-b border-white/10 pb-5">
              <AnswerProgressBar
                answeredCount={answeredCount}
                totalCount={totalQ}
                currentIndex={currentAnswerIndex}
                label="Friend Challenge answer progress"
                secondaryLabel="Tip: Ctrl/Cmd + Enter for next"
              />

              <div className="flex flex-wrap gap-1.5">
                {remoteChallenge.questions.map((q, idx) => {
                  const isCurrent = idx === currentAnswerIndex;
                  const isDone = (friendBAnswers[idx] || '').trim().length > 0;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setState((prev) => ({
                          ...prev,
                          answerError: null,
                          currentAnswerIndex: idx,
                        }));
                        setQuestionFocusTrigger((prev) => prev + 1);
                      }}
                      aria-label={`Jump to question ${idx + 1}${isDone ? ' (answered)' : ''}`}
                      className={`h-10 min-w-[40px] rounded-lg px-2 font-mono text-xs font-medium tabular-nums transition-colors ${
                        isCurrent
                          ? 'bg-cyan-400 text-[#050814]'
                          : isDone
                          ? 'bg-blue-600/80 text-white hover:bg-blue-500'
                          : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentQ.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                <h2 className="font-display text-xl leading-snug font-bold text-white sm:text-2xl">
                  {currentQ.prompt}
                </h2>
                {currentQ.hint && (
                  <p className="mt-1.5 text-sm text-slate-400">{currentQ.hint}</p>
                )}

                <textarea
                  ref={friendBTextareaRef}
                  rows={4}
                  maxLength={1500}
                  value={currentFriendAnswer}
                  onChange={(e) => {
                    const value = e.target.value;
                    setState((prev) => {
                      const next = [...prev.friendBAnswers];
                      next[prev.currentAnswerIndex] = value;
                      return {
                        ...prev,
                        friendBAnswers: next,
                        answerError: null,
                      };
                    });
                  }}
                  onKeyDown={handleAnswerKeyDown}
                  disabled={submittingAnswers}
                  placeholder="Type your answer..."
                  aria-label={`Answer to question ${currentAnswerIndex + 1}`}
                  className="mt-5 w-full resize-y rounded-xl border border-white/15 bg-[#050814] p-4 text-base text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </motion.div>
            </AnimatePresence>

            {answerError && (
              <div
                ref={answerAlertRef}
                tabIndex={-1}
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3.5 text-sm text-rose-200 outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
                <span>{answerError}</span>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={currentAnswerIndex === 0 || submittingAnswers}
                  onClick={() => {
                    setState((prev) => ({
                      ...prev,
                      answerError: null,
                      currentAnswerIndex: Math.max(0, prev.currentAnswerIndex - 1),
                    }));
                    setQuestionFocusTrigger((prev) => prev + 1);
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:opacity-40"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  disabled={submittingAnswers || currentFriendAnswer.length === 0}
                  onClick={handleClearFriendBAnswer}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-40"
                >
                  <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Clear Answer</span>
                </button>
              </div>

              {currentAnswerIndex < totalQ - 1 ? (
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white whitespace-nowrap"
                >
                  <span>Next Question</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submittingAnswers}
                  onClick={handleSubmitAllFriendBAnswers}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-500 px-6 py-2.5 text-sm font-semibold text-white whitespace-nowrap shadow-[0_6px_24px_rgba(34,211,238,0.28)] disabled:opacity-50"
                >
                  {submittingAnswers ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Generating Verdicts...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit All {totalQ} Answers</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // --- FRIEND B VIEW 3: DRAMATIC ONE-AT-A-TIME VERDICT REVEAL ---
    if (friendBView === 'reveal' && completedResult && completedResult.items.length > 0) {
      const safeRevealIndex = Math.max(0, Math.min(revealIndex, completedResult.items.length - 1));
      const currentItem = completedResult.items[safeRevealIndex];
      const isTrue = currentItem.outcome === 'TRUE';
      const isLast = safeRevealIndex >= completedResult.items.length - 1;

      return (
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
          {/* Top Controls Bar */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-400">
                {completedResult.friendAName} vs. {completedResult.friendBName}
              </p>
              <p className="font-mono text-sm font-semibold text-cyan-300 tabular-nums">
                Verdict {safeRevealIndex + 1} of {completedResult.totalQuestions}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleToggleSound}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/15 bg-[#0B1228] px-3.5 py-2 text-xs font-semibold text-white hover:border-cyan-400/40"
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                    <span>Sound On</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <span>Sound Off</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, friendBView: 'dashboard' }))}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-100 whitespace-nowrap hover:border-cyan-400/40"
              >
                <ListChecks className="h-4 w-4" aria-hidden="true" />
                <span>Show All Results</span>
              </button>
            </div>
          </div>

          {/* Dramatic Verdict Reveal Stage */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentItem.questionId}-${safeRevealIndex}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={`relative overflow-hidden rounded-2xl border p-6 sm:p-10 ${
                isTrue
                  ? 'border-emerald-400/50 bg-[#071D18] shadow-[0_0_60px_rgba(16,185,129,0.22)]'
                  : 'border-rose-500/60 bg-[#220912] shadow-[0_0_60px_rgba(244,63,94,0.28)]'
              }`}
            >
              {/* Animated Background Effect: Green celebration vs Red flashing alarm */}
              {isTrue ? (
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0.2, scale: 0.9 }}
                  animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.06, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-500/25 blur-3xl"
                />
              ) : (
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.05, 0.45, 0.08, 0.4, 0.05] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                  className="pointer-events-none absolute inset-0 bg-rose-600/25"
                />
              )}

              <div className="relative z-10 text-center">
                {/* Question & Submitted Answer */}
                <p className="text-xs font-medium text-slate-300">
                  Question {safeRevealIndex + 1}
                </p>
                <h2 className="mx-auto mt-2 max-w-2xl font-display text-lg font-bold text-white sm:text-xl">
                  {currentItem.question}
                </h2>

                <div className="mx-auto mt-4 max-w-2xl rounded-xl border border-white/10 bg-[#050814]/75 p-4 text-left">
                  <p className="text-xs font-medium text-slate-400">
                    {completedResult.friendBName}&apos;s Answer
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-100 sm:text-base">
                    &ldquo;{currentItem.answer}&rdquo;
                  </p>
                </div>

                {/* Big Animated Outcome */}
                {isTrue ? (
                  <motion.div
                    initial={{ scale: 0.65, opacity: 0 }}
                    animate={{ scale: [0.65, 1.08, 1], opacity: 1 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-8 flex flex-col items-center"
                  >
                    <div className="flex items-center gap-3 text-emerald-300">
                      <Sparkles className="h-7 w-7 animate-pulse" aria-hidden="true" />
                      <span className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
                        TRUE!
                      </span>
                      <Sparkles className="h-7 w-7 animate-pulse" aria-hidden="true" />
                    </div>
                    <p className="mt-2 font-mono text-lg font-semibold tracking-widest text-emerald-200">
                      NOT LYING
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{
                      scale: [0.7, 1.1, 1],
                      x: [0, -8, 8, -6, 6, 0],
                      opacity: 1,
                    }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-8 flex flex-col items-center"
                  >
                    <div className="flex items-center gap-3 text-rose-300">
                      <ShieldAlert className="h-8 w-8" aria-hidden="true" />
                      <span className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
                        LIE!
                      </span>
                      <ShieldAlert className="h-8 w-8" aria-hidden="true" />
                    </div>
                    <p className="mt-2 font-mono text-lg font-semibold tracking-widest text-rose-200">
                      CAUGHT!
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Reveal Stepper Navigation */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={safeRevealIndex === 0}
              onClick={() => {
                const prevIdx = Math.max(0, safeRevealIndex - 1);
                setState((prev) => ({ ...prev, revealIndex: prevIdx }));
                triggerRevealSound(completedResult.items[prevIdx]?.outcome);
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Previous Verdict</span>
            </button>

            {!isLast ? (
              <button
                type="button"
                onClick={() => {
                  const nextIdx = safeRevealIndex + 1;
                  setState((prev) => ({ ...prev, revealIndex: nextIdx }));
                  triggerRevealSound(completedResult.items[nextIdx]?.outcome);
                }}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white whitespace-nowrap shadow-[0_6px_24px_rgba(37,99,235,0.3)] hover:brightness-110"
              >
                <span>Reveal Next Verdict ({safeRevealIndex + 2}/{completedResult.totalQuestions})</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, friendBView: 'dashboard' }))}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white whitespace-nowrap"
              >
                <ListChecks className="h-4 w-4" aria-hidden="true" />
                <span>View Full Results Dashboard</span>
              </button>
            )}
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
            {TRANSPARENCY_NOTICE}
          </p>
        </div>
      );
    }

    // --- FRIEND B VIEW 4: FULL RESULTS DASHBOARD (PERSISTED ACROSS REFRESH) ---
    if (completedResult) {
      return (
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header Summary Card */}
            <section className="rounded-2xl border border-white/10 bg-[#0B1228] p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs font-medium text-cyan-300">
                    Friend Truth Challenge Results · {completedResult.theme}
                  </p>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="mt-2 font-display text-2xl font-bold tracking-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:text-3xl"
                  >
                    {completedResult.friendAName} vs. {completedResult.friendBName}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleToggleSound}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/15 bg-[#050814] px-3.5 py-2 text-xs font-semibold text-white hover:border-cyan-400/40"
                  >
                    {soundEnabled ? (
                      <>
                        <Volume2 className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                        <span>Sound On</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        <span>Sound Off</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (soundEnabled) unlockAudio();
                      setState((prev) => ({
                        ...prev,
                        revealIndex: 0,
                        friendBView: 'reveal',
                      }));
                      triggerRevealSound(completedResult.items[0]?.outcome);
                    }}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-200 whitespace-nowrap hover:bg-cyan-500/20"
                  >
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Play Dramatic Reveal</span>
                  </button>
                </div>
              </div>

              {/* Counts Grid: Friend A, Friend B, Total TRUE, Total LIE */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-[#050814]/80 p-4">
                  <p className="text-xs text-slate-400">Friend A (Challenger)</p>
                  <p className="mt-1 font-display text-lg font-bold text-white truncate">
                    {completedResult.friendAName}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#050814]/80 p-4">
                  <p className="text-xs text-slate-400">Friend B (Player)</p>
                  <p className="mt-1 font-display text-lg font-bold text-white truncate">
                    {completedResult.friendBName}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4">
                  <p className="text-xs font-medium text-emerald-200">Total TRUE – NOT LYING</p>
                  <p className="mt-1 font-mono text-3xl font-semibold text-emerald-300 tabular-nums">
                    {completedResult.totalTrue}
                  </p>
                </div>

                <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-4">
                  <p className="text-xs font-medium text-rose-200">Total LIE – CAUGHT!</p>
                  <p className="mt-1 font-mono text-3xl font-semibold text-rose-300 tabular-nums">
                    {completedResult.totalLie}
                  </p>
                </div>
              </div>

              {/* Overall Game Summary */}
              <div className="mt-6 rounded-xl border border-white/10 bg-[#050814]/70 p-4">
                <p className="text-xs font-semibold text-slate-300">Overall Game Summary</p>
                <p className="mt-1.5 text-base leading-relaxed text-slate-100">
                  {completedResult.overallSummary}
                </p>
              </div>

              {/* Mandatory Transparency Notice */}
              <div className="mt-5 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-4">
                <p className="text-xs leading-relaxed text-cyan-100">
                  {TRANSPARENCY_NOTICE}
                </p>
              </div>

              {/* Dashboard Actions */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleStartBrandNewChallenge}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap hover:brightness-110"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Create New Challenge</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyResultSummary}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap hover:border-cyan-400/40"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                      <span>Results Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      <span>Copy Results Summary</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onGoHome}
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white"
                >
                  Back to Home
                </button>
              </div>
            </section>

            {/* Filter & All Questions/Answers/Verdicts */}
            <section className="mt-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-white">
                  All {completedResult.totalQuestions} Questions &amp; Verdicts
                </h2>

                <div
                  role="tablist"
                  aria-label="Filter verdicts"
                  className="inline-flex rounded-xl border border-white/10 bg-[#0B1228] p-1"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={verdictFilter === 'ALL'}
                    onClick={() => setState((prev) => ({ ...prev, verdictFilter: 'ALL' }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                      verdictFilter === 'ALL'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({completedResult.totalQuestions})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={verdictFilter === 'TRUE'}
                    onClick={() => setState((prev) => ({ ...prev, verdictFilter: 'TRUE' }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                      verdictFilter === 'TRUE'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-emerald-300'
                    }`}
                  >
                    TRUE ({completedResult.totalTrue})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={verdictFilter === 'LIE'}
                    onClick={() => setState((prev) => ({ ...prev, verdictFilter: 'LIE' }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                      verdictFilter === 'LIE'
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-400 hover:text-rose-300'
                    }`}
                  >
                    LIE ({completedResult.totalLie})
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {filteredDashboardItems.map((item) => {
                  const isTrue = item.outcome === 'TRUE';
                  const originalNumber =
                    completedResult.items.findIndex((x) => x.questionId === item.questionId) + 1;

                  return (
                    <article
                      key={item.questionId}
                      className={`rounded-2xl border p-5 ${
                        isTrue
                          ? 'border-emerald-500/25 bg-[#081918]'
                          : 'border-rose-500/25 bg-[#1B0A13]'
                      }`}
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs text-slate-400 tabular-nums">
                            Question {String(originalNumber).padStart(2, '0')}
                          </p>
                          <h3 className="mt-1 font-display text-base font-bold text-white">
                            {item.question}
                          </h3>
                          <p className="mt-2.5 text-sm leading-relaxed text-slate-200">
                            <span className="font-medium text-slate-400">
                              {completedResult.friendBName}:
                            </span>{' '}
                            {item.answer}
                          </p>
                        </div>

                        <div
                          className={`shrink-0 self-start rounded-xl border px-3.5 py-2 text-right font-mono text-xs font-bold tracking-wide whitespace-nowrap ${
                            isTrue
                              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                              : 'border-rose-400/40 bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {item.verdictLabel}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </motion.div>
        </div>
      );
    }
  }

  // =========================================================================
  // RENDER: FRIEND A CHALLENGE BUILDER (NO CHALLENGE ID IN URL)
  // =========================================================================
  const validQuestionCount = questions.filter((q) => q.prompt.trim().length >= 5).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-sm font-medium text-purple-300">
          Friend Truth Challenge · 20+ Questions Random Game
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 font-display text-3xl font-bold tracking-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:text-4xl"
        >
          Challenge a Friend With 20+ Questions
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-300">
          Build a deck of at least 20 questions and send your friend the invitation link. After they
          answer all questions, every response gets a random{' '}
          <span className="font-semibold text-emerald-300">TRUE – NOT LYING</span> or{' '}
          <span className="font-semibold text-rose-300">LIE – CAUGHT!</span> reveal.
        </p>

        {/* Mandatory Game Transparency Notice on Intro / Builder */}
        <div className="mt-6 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4">
          <p className="text-xs leading-relaxed text-cyan-100">{TRANSPARENCY_NOTICE}</p>
        </div>

        {createdChallengeId ? (
          /* --- LINK CREATED STATE --- */
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#0B1228] p-6 sm:p-8">
            <p className="text-xs font-medium text-cyan-300">
              Challenge Ready · {validQuestionCount} Questions Locked In
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-white">
              Send This Invitation Link to Your Friend
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Once your friend answers all {validQuestionCount} questions, the server generates and
              locks their random verdicts so refreshing the results page never changes them.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                readOnly
                value={shareUrl}
                aria-label="Friend Truth Challenge invitation link"
                className="w-full rounded-xl border border-white/15 bg-[#050814] px-4 py-3 font-mono text-xs text-cyan-200 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={() => onOpenChallengeId(createdChallengeId)}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span>Open Invitation as Friend B</span>
              </button>

              <button
                type="button"
                onClick={handleStartBrandNewChallenge}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Create Another Challenge</span>
              </button>
            </div>
          </div>
        ) : (
          /* --- FRIEND A CHALLENGE BUILDER --- */
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#0B1228] p-6 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="friend-a-name" className="block text-sm font-semibold text-white">
                  Your Name (Friend A)
                </label>
                <input
                  id="friend-a-name"
                  type="text"
                  maxLength={40}
                  value={friendAName}
                  onChange={(e) => setState((prev) => ({ ...prev, friendAName: e.target.value }))}
                  placeholder="e.g. Alex"
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#050814] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="challenge-theme" className="block text-sm font-semibold text-white">
                  Question Theme
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    id="challenge-theme"
                    value={theme}
                    disabled={generatingAi}
                    onChange={(e) => setState((prev) => ({ ...prev, theme: e.target.value }))}
                    className="min-h-[42px] w-full rounded-xl border border-white/15 bg-[#050814] px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {PARTY_THEMES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={generatingAi}
                    onClick={() => handleGenerate20Questions(theme)}
                    className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap hover:border-cyan-400/40 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${generatingAi ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{generatingAi ? 'Generating...' : 'Generate 20 AI Questions'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Questions List Header */}
            <div className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-6">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Challenge Questions
                </h2>
                <p className="text-xs text-slate-400">
                  Edit any question below, delete extras, or add your own. Minimum 20 required.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`font-mono text-xs font-semibold tabular-nums ${
                    validQuestionCount >= MIN_QUESTIONS ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {validQuestionCount} / {MIN_QUESTIONS} minimum
                </span>
                <button
                  type="button"
                  disabled={generatingAi}
                  onClick={handleRequestResetBuilder}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-amber-400/40 hover:text-amber-200 disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset Builder</span>
                </button>
              </div>
            </div>

            {aiError && !generatingAi && (
              <div className="mt-4">
                <AiErrorBanner
                  error={aiError}
                  onRetry={() => void executeGenerate20Questions(theme)}
                  retryLabel="Retry AI Generation"
                  secondaryLabel="Keep Current Questions"
                  onSecondaryAction={() => setState((prev) => ({ ...prev, aiError: null }))}
                />
              </div>
            )}

            {/* Editable 20+ Question List */}
            {generatingAi ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
                <Loader2 className="h-7 w-7 animate-spin text-cyan-400" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-slate-200">
                  Drafting 20 fun {theme} questions...
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Waiting for AI response (up to 32s) · You can cancel anytime.
                </p>
                <button
                  type="button"
                  onClick={handleCancelAiQuestions}
                  className="mt-4 inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-slate-200 hover:border-rose-400/40 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Cancel</span>
                </button>
              </div>
            ) : (
              <div className="mt-4 max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                {questions.map((q, idx) => (
                  <div key={q.id} className="flex items-center gap-2.5">
                    <span className="w-7 shrink-0 font-mono text-xs font-semibold text-cyan-300 tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <input
                      type="text"
                      maxLength={300}
                      value={q.prompt}
                      onChange={(e) => {
                        const value = e.target.value;
                        setState((prev) => {
                          const next = [...prev.questions];
                          next[idx] = { ...next[idx], prompt: value };
                          return {
                            ...prev,
                            questions: next,
                            builderError: null,
                          };
                        });
                      }}
                      aria-label={`Question ${idx + 1}`}
                      className="w-full rounded-xl border border-white/10 bg-[#050814] px-3.5 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setState((prev) => ({
                          ...prev,
                          questions: prev.questions.filter((_, i) => i !== idx),
                        }));
                      }}
                      aria-label={`Remove question ${idx + 1}`}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:border-rose-500/40 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Custom Question Input */}
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <input
                type="text"
                maxLength={300}
                value={newQuestionText}
                onChange={(e) => setState((prev) => ({ ...prev, newQuestionText: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomQuestion();
                  }
                }}
                placeholder="Write a custom question to add to the list..."
                className="w-full rounded-xl border border-white/10 bg-[#050814] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomQuestion}
                className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap hover:border-cyan-400/40"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Question</span>
              </button>
            </div>

            {/* Consent Checkbox */}
            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#050814]/80 p-4 text-xs leading-relaxed text-slate-300">
              <input
                type="checkbox"
                checked={builderConsent}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    builderConsent: e.target.checked,
                    builderError: null,
                  }))
                }
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#050814] accent-cyan-400"
              />
              <span>
                I consent to storing these {validQuestionCount} challenge questions on the server so
                my friend can open the invitation link and view the locked random game results.
              </span>
            </label>

            {builderError && (
              <div
                ref={builderAlertRef}
                tabIndex={-1}
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3.5 text-sm text-rose-200 outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
                <span>{builderError}</span>
              </div>
            )}

            <div className="mt-6 flex justify-end border-t border-white/10 pt-5">
              <button
                type="button"
                disabled={creatingLink || generatingAi || validQuestionCount < MIN_QUESTIONS}
                onClick={handleCreateChallengeLink}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-purple-500 px-6 py-2.5 text-sm font-semibold text-white whitespace-nowrap shadow-[0_6px_24px_rgba(37,99,235,0.3)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingLink ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Creating Invitation Link...</span>
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                    <span>Create 20+ Question Challenge Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
