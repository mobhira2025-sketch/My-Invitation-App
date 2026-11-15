export type ServerAiErrorCode =
  | 'QUOTA_EXHAUSTED'
  | 'RATE_LIMITED'
  | 'AUTH_ERROR'
  | 'MALFORMED_RESPONSE'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR';

export class ServerTimeoutError extends Error {
  constructor(message = 'The AI request timed out before completing.') {
    super(message);
    this.name = 'ServerTimeoutError';
  }
}

export class ClientDisconnectedError extends Error {
  constructor() {
    super('Client cancelled the request.');
    this.name = 'ClientDisconnectedError';
  }
}

export class MalformedAiResponseError extends Error {
  constructor(message = 'The AI returned an incomplete or invalid response format.') {
    super(message);
    this.name = 'MalformedAiResponseError';
  }
}

export function redactSecrets(text: string): string {
  return text
    .replace(/([?&]key=)[^&\s"']+/gi, '$1REDACTED')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, 'REDACTED_KEY')
    .replace(/(x-goog-api-key['":\s=]+)[^\s"',}]+/gi, '$1REDACTED');
}

interface ParsedGoogleError {
  code?: number;
  status?: string;
  message?: string;
  retryDelaySeconds?: number;
  quotaViolations: string[];
  errorReasons: string[];
}

function mergeParsedDetails(target: ParsedGoogleError, errObj: Record<string, unknown>): void {
  if (typeof errObj.code === 'number') target.code = errObj.code;
  if (typeof errObj.status === 'string') target.status = errObj.status;
  if (typeof errObj.message === 'string') target.message = errObj.message;

  if (Array.isArray(errObj.details)) {
    for (const detail of errObj.details) {
      if (!detail || typeof detail !== 'object') continue;
      const d = detail as Record<string, unknown>;
      const typeStr = typeof d['@type'] === 'string' ? d['@type'] : '';

      if (typeStr.includes('RetryInfo') && typeof d.retryDelay === 'string') {
        const secMatch = d.retryDelay.match(/(\d+(?:\.\d+)?)\s*s/i);
        if (secMatch) {
          target.retryDelaySeconds = Math.max(2, Math.min(120, Math.ceil(Number(secMatch[1]))));
        }
      }

      if (typeStr.includes('QuotaFailure') && Array.isArray(d.violations)) {
        for (const v of d.violations) {
          if (v && typeof v === 'object') {
            const vObj = v as Record<string, unknown>;
            const parts = [vObj.quotaId, vObj.quotaMetric, vObj.description].filter(
              (x): x is string => typeof x === 'string'
            );
            target.quotaViolations.push(parts.join(' '));
          }
        }
      }

      if (typeStr.includes('ErrorInfo') && typeof d.reason === 'string') {
        target.errorReasons.push(d.reason);
      }
    }
  }
}

export function parseGoogleApiErrorBody(rawMessage: string, depth = 0): ParsedGoogleError {
  const result: ParsedGoogleError = {
    quotaViolations: [],
    errorReasons: [],
  };

  if (depth > 2) return result;
  const jsonStart = rawMessage.indexOf('{');
  if (jsonStart === -1) return result;

  try {
    const parsed = JSON.parse(rawMessage.slice(jsonStart)) as {
      error?: Record<string, unknown>;
    };
    const errObj = parsed?.error;
    if (!errObj || typeof errObj !== 'object') return result;

    mergeParsedDetails(result, errObj);

    // Unwrap nested upstream JSON embedded inside error.message if present
    if (typeof errObj.message === 'string' && errObj.message.includes('{')) {
      const nested = parseGoogleApiErrorBody(errObj.message, depth + 1);
      if (nested.code !== undefined) result.code = nested.code;
      if (nested.status) result.status = nested.status;
      if (nested.message) result.message = nested.message;
      if (nested.retryDelaySeconds !== undefined) result.retryDelaySeconds = nested.retryDelaySeconds;
      result.quotaViolations.push(...nested.quotaViolations);
      result.errorReasons.push(...nested.errorReasons);
    }
  } catch {
    // Ignore non-JSON error payloads
  }

  return result;
}

export interface ClassifiedGeminiError {
  status: number;
  retryAfterSeconds?: number;
  payload: {
    error: string;
    code: ServerAiErrorCode;
    nextStep: string;
    retryable: boolean;
    retryAfterSeconds?: number;
  };
}

export function classifyGeminiError(err: unknown): ClassifiedGeminiError {
  if (err instanceof ServerTimeoutError) {
    return {
      status: 504,
      payload: {
        error: 'The AI request timed out before finishing.',
        code: 'TIMEOUT',
        nextStep:
          'Click Retry to try again, or shorten your input if you submitted a very long statement.',
        retryable: true,
      },
    };
  }

  if (err instanceof MalformedAiResponseError || err instanceof SyntaxError) {
    return {
      status: 502,
      payload: {
        error: 'The AI returned an incomplete or unexpected response format.',
        code: 'MALFORMED_RESPONSE',
        nextStep: 'Click Retry to request a fresh AI response.',
        retryable: true,
      },
    };
  }

  const raw = redactSecrets(err instanceof Error ? err.message : String(err));
  const errStatus =
    err &&
    typeof err === 'object' &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : undefined;
  const parsedBody = parseGoogleApiErrorBody(raw);
  const statusCode = parsedBody.code ?? errStatus;
  const apiStatus = parsedBody.status ?? '';
  const apiMsg = (parsedBody.message ?? raw).toLowerCase();
  const reasons = parsedBody.errorReasons.join(' ').toUpperCase();
  const violations = parsedBody.quotaViolations.join(' ').toLowerCase();

  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return {
      status: 503,
      payload: {
        error: 'Gemini API key is not configured on the server.',
        code: 'AUTH_ERROR',
        nextStep: 'Add a valid GEMINI_API_KEY in Settings > Secrets, then click Retry.',
        retryable: false,
      },
    };
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    apiStatus === 'PERMISSION_DENIED' ||
    apiStatus === 'UNAUTHENTICATED' ||
    reasons.includes('API_KEY_INVALID') ||
    reasons.includes('API_KEY_SERVICE_BLOCKED') ||
    reasons.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
    /api[_\s]?key.*invalid|api key not valid|permission denied|unauthenticated/i.test(apiMsg)
  ) {
    return {
      status: statusCode === 401 ? 401 : 403,
      payload: {
        error: 'Gemini API authentication failed on the server.',
        code: 'AUTH_ERROR',
        nextStep:
          'Verify your GEMINI_API_KEY in Settings > Secrets and confirm the Generative Language API is enabled.',
        retryable: false,
      },
    };
  }

  if (
    statusCode === 429 ||
    apiStatus === 'RESOURCE_EXHAUSTED' ||
    raw.includes('RESOURCE_EXHAUSTED')
  ) {
    const isHardQuotaExhausted =
      violations.includes('perday') ||
      violations.includes('daily') ||
      violations.includes('monthly') ||
      violations.includes('limit: 0') ||
      apiMsg.includes('limit: 0');

    const isPerMinuteRateLimit =
      !isHardQuotaExhausted &&
      (violations.includes('perminute') ||
        violations.includes('persecond') ||
        violations.includes('rate_limit') ||
        typeof parsedBody.retryDelaySeconds === 'number');

    const isQuotaExhausted =
      isHardQuotaExhausted ||
      (!isPerMinuteRateLimit &&
        (apiMsg.includes('exceeded your current quota') ||
          apiMsg.includes('plan and billing') ||
          apiMsg.includes('billing') ||
          apiMsg.includes('quota')));

    if (isQuotaExhausted) {
      return {
        status: 429,
        payload: {
          error: 'The Gemini API quota for this project has been exhausted.',
          code: 'QUOTA_EXHAUSTED',
          nextStep:
            'Check your Gemini API quota and Cloud billing plan in Google AI Studio / Settings > Secrets, or play Friend Challenge mode without AI.',
          retryable: false,
        },
      };
    }

    const retryAfterSeconds = parsedBody.retryDelaySeconds ?? 15;
    return {
      status: 429,
      retryAfterSeconds,
      payload: {
        error: 'Gemini API rate limit reached due to high request volume.',
        code: 'RATE_LIMITED',
        retryAfterSeconds,
        nextStep: `Wait ${retryAfterSeconds} seconds for the rate limit to reset, then click Retry.`,
        retryable: true,
      },
    };
  }

  if (
    statusCode === 504 ||
    apiStatus === 'DEADLINE_EXCEEDED' ||
    (err instanceof Error && err.name === 'AbortError') ||
    /etimedout|deadline_exceeded|timed out/i.test(apiMsg)
  ) {
    return {
      status: 504,
      payload: {
        error: 'The AI request timed out before finishing.',
        code: 'TIMEOUT',
        nextStep: 'Click Retry to try again, or try shorter input.',
        retryable: true,
      },
    };
  }

  if (statusCode === 404 || apiStatus === 'NOT_FOUND') {
    return {
      status: 502,
      payload: {
        error: 'The configured AI model is currently unavailable.',
        code: 'SERVER_ERROR',
        nextStep: 'Wait a moment and click Retry.',
        retryable: true,
      },
    };
  }

  if (statusCode === 400 || apiStatus === 'INVALID_ARGUMENT') {
    return {
      status: 400,
      payload: {
        error: 'The submitted input could not be processed by the AI model.',
        code: 'VALIDATION_ERROR',
        nextStep: 'Revise or shorten your text, then try submitting again.',
        retryable: false,
      },
    };
  }

  return {
    status: 503,
    payload: {
      error: 'The AI service is temporarily unavailable.',
      code: 'SERVER_ERROR',
      nextStep: 'Wait a few seconds and click Retry.',
      retryable: true,
    },
  };
}

export function isTransientServerRetryable(err: unknown): boolean {
  if (err instanceof ClientDisconnectedError || err instanceof ServerTimeoutError) {
    return false;
  }
  if (err instanceof MalformedAiResponseError || err instanceof SyntaxError) {
    return true;
  }
  const classified = classifyGeminiError(err);
  return classified.payload.code === 'SERVER_ERROR';
}

export function parseJsonFromGemini<T>(
  rawText: string | undefined,
  validator: (parsed: unknown) => T | null
): T {
  const trimmed = typeof rawText === 'string' ? rawText.trim() : '';
  if (!trimmed) {
    throw new MalformedAiResponseError('The AI returned an empty response.');
  }

  const stripped = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new MalformedAiResponseError('The AI response was not valid JSON.');
  }

  const validated = validator(parsed);
  if (!validated) {
    throw new MalformedAiResponseError('The AI response was missing required fields.');
  }
  return validated;
}
