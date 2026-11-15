import type { AiErrorCode, StructuredApiErrorPayload } from '../types';

export interface AppApiErrorOptions {
  code: AiErrorCode;
  message: string;
  nextStep: string;
  retryable: boolean;
  status?: number;
  retryAfterSeconds?: number;
}

export class AppApiError extends Error {
  readonly code: AiErrorCode;
  readonly nextStep: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly retryAfterSeconds?: number;

  constructor(options: AppApiErrorOptions) {
    super(options.message);
    this.name = 'AppApiError';
    this.code = options.code;
    this.nextStep = options.nextStep;
    this.retryable = options.retryable;
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export interface RequestJsonOptions extends RequestInit {
  timeoutMs?: number;
  maxTransientRetries?: number;
}

function defaultNextStepForCode(code: AiErrorCode, retryAfterSeconds?: number): string {
  switch (code) {
    case 'QUOTA_EXHAUSTED':
      return 'Check your Gemini API quota and Cloud billing plan in Google AI Studio / Settings > Secrets, or play Friend Challenge mode without AI.';
    case 'RATE_LIMITED':
      return retryAfterSeconds
        ? `Wait ${retryAfterSeconds} seconds for the rate-limit cooldown, then click Retry.`
        : 'Wait a few seconds before clicking Retry.';
    case 'AUTH_ERROR':
      return 'Verify that GEMINI_API_KEY is configured and active in Settings > Secrets, then click Retry.';
    case 'MALFORMED_RESPONSE':
      return 'Click Retry to request a fresh response, or simplify your input.';
    case 'TIMEOUT':
      return 'Click Retry to try again, or shorten your text if you submitted a very long statement.';
    case 'NETWORK_ERROR':
      return 'Check your internet connection or make sure the app server is running, then click Retry.';
    case 'CANCELLED':
      return 'Your input was kept. Edit or try again whenever you are ready.';
    case 'VALIDATION_ERROR':
      return 'Check the input requirements above and try submitting again.';
    case 'SERVER_ERROR':
    default:
      return 'Wait a moment and click Retry.';
  }
}

function inferCodeFromStatus(status: number, message: string): AiErrorCode {
  if (status === 401 || status === 403) return 'AUTH_ERROR';
  if (status === 429) {
    const lower = message.toLowerCase();
    if (lower.includes('exhausted') || lower.includes('billing') || lower.includes('daily')) {
      return 'QUOTA_EXHAUSTED';
    }
    return 'RATE_LIMITED';
  }
  if (status === 502) return 'MALFORMED_RESPONSE';
  if (status === 504 || status === 408) return 'TIMEOUT';
  if (status === 400 || status === 422) return 'VALIDATION_ERROR';
  return 'SERVER_ERROR';
}

function parseRetryAfterHeader(headerVal: string | null): number | undefined {
  if (!headerVal) return undefined;
  const numeric = Number(headerVal.trim());
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.max(1, Math.min(180, Math.ceil(numeric)));
  }
  return undefined;
}

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new AppApiError({
          code: 'CANCELLED',
          message: 'Request cancelled.',
          nextStep: defaultNextStepForCode('CANCELLED'),
          retryable: true,
        })
      );
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(
        new AppApiError({
          code: 'CANCELLED',
          message: 'Request cancelled.',
          nextStep: defaultNextStepForCode('CANCELLED'),
          retryable: true,
        })
      );
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function toAppApiError(err: unknown, fallbackMessage = 'Request failed. Please try again.'): AppApiError {
  if (err instanceof AppApiError) return err;
  if (err instanceof Error) {
    return new AppApiError({
      code: 'SERVER_ERROR',
      message: err.message || fallbackMessage,
      nextStep: defaultNextStepForCode('SERVER_ERROR'),
      retryable: true,
    });
  }
  return new AppApiError({
    code: 'SERVER_ERROR',
    message: fallbackMessage,
    nextStep: defaultNextStepForCode('SERVER_ERROR'),
    retryable: true,
  });
}

export async function requestJson<T>(url: string, options: RequestJsonOptions = {}): Promise<T> {
  const {
    timeoutMs = 28000,
    maxTransientRetries = 1,
    signal: callerSignal,
    ...fetchInit
  } = options;

  let lastError: AppApiError | null = null;

  for (let attempt = 0; attempt <= maxTransientRetries; attempt++) {
    if (callerSignal?.aborted) {
      throw new AppApiError({
        code: 'CANCELLED',
        message: 'Request cancelled.',
        nextStep: defaultNextStepForCode('CANCELLED'),
        retryable: true,
      });
    }

    const attemptController = new AbortController();
    let timedOut = false;

    const onCallerAbort = () => {
      attemptController.abort();
    };
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      attemptController.abort();
    }, timeoutMs);

    try {
      let response: Response;
      try {
        response = await fetch(url, {
          ...fetchInit,
          signal: attemptController.signal,
        });
      } catch {
        if (callerSignal?.aborted) {
          throw new AppApiError({
            code: 'CANCELLED',
            message: 'Request cancelled.',
            nextStep: defaultNextStepForCode('CANCELLED'),
            retryable: true,
          });
        }
        if (timedOut) {
          throw new AppApiError({
            code: 'TIMEOUT',
            message: `The request timed out after ${Math.round(timeoutMs / 1000)} seconds.`,
            nextStep: defaultNextStepForCode('TIMEOUT'),
            retryable: true,
            status: 504,
          });
        }
        throw new AppApiError({
          code: 'NETWORK_ERROR',
          message: 'Could not reach the server due to a network connection error.',
          nextStep: defaultNextStepForCode('NETWORK_ERROR'),
          retryable: true,
        });
      }

      const rawText = await response.text();
      let parsed: unknown = null;

      if (rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          if (!response.ok) {
            const code = inferCodeFromStatus(response.status, rawText);
            throw new AppApiError({
              code,
              status: response.status,
              message: `Server returned an unexpected error (${response.status}).`,
              nextStep: defaultNextStepForCode(code),
              retryable: code !== 'AUTH_ERROR' && code !== 'QUOTA_EXHAUSTED' && code !== 'VALIDATION_ERROR',
            });
          }
          throw new AppApiError({
            code: 'MALFORMED_RESPONSE',
            status: response.status,
            message: 'Received an unexpected non-JSON response from the server.',
            nextStep: defaultNextStepForCode('MALFORMED_RESPONSE'),
            retryable: true,
          });
        }
      }

      if (!response.ok) {
        const body =
          parsed && typeof parsed === 'object' ? (parsed as Partial<StructuredApiErrorPayload>) : {};
        const message =
          typeof body.error === 'string' && body.error.trim().length > 0
            ? body.error.trim()
            : `Request failed (${response.status}).`;
        const code: AiErrorCode = body.code ?? inferCodeFromStatus(response.status, message);
        const retryAfterSeconds =
          typeof body.retryAfterSeconds === 'number' && Number.isFinite(body.retryAfterSeconds)
            ? body.retryAfterSeconds
            : parseRetryAfterHeader(response.headers.get('Retry-After'));
        const retryable =
          typeof body.retryable === 'boolean'
            ? body.retryable
            : code !== 'QUOTA_EXHAUSTED' && code !== 'AUTH_ERROR' && code !== 'VALIDATION_ERROR';
        const nextStep =
          typeof body.nextStep === 'string' && body.nextStep.trim().length > 0
            ? body.nextStep.trim()
            : defaultNextStepForCode(code, retryAfterSeconds);

        throw new AppApiError({
          code,
          status: response.status,
          message,
          nextStep,
          retryable,
          retryAfterSeconds,
        });
      }

      return parsed as T;
    } catch (err: unknown) {
      const apiErr = toAppApiError(err);
      lastError = apiErr;

      // Only retry transient 503/500 server errors once; NEVER retry quota exhaustion, rate limits, auth errors, timeouts, malformed responses, or user cancellations.
      const shouldRetry =
        attempt < maxTransientRetries &&
        apiErr.code === 'SERVER_ERROR' &&
        !callerSignal?.aborted;

      if (!shouldRetry) {
        throw apiErr;
      }

      await sleepWithAbort(750, callerSignal ?? undefined);
    } finally {
      clearTimeout(timeoutHandle);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }
  }

  throw lastError ?? new AppApiError({
    code: 'SERVER_ERROR',
    message: 'Request failed.',
    nextStep: defaultNextStepForCode('SERVER_ERROR'),
    retryable: true,
  });
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }

  if (typeof document === 'undefined') return false;

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
