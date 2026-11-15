import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Clock, RefreshCw, WifiOff } from 'lucide-react';
import type { AiErrorCode } from '../types';
import { AppApiError } from '../utils/api';

interface AiErrorBannerProps {
  error: AppApiError;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
}

function getTitleForCode(code: AiErrorCode): string {
  switch (code) {
    case 'QUOTA_EXHAUSTED':
      return 'AI Quota Exhausted';
    case 'RATE_LIMITED':
      return 'Rate Limit Cooldown';
    case 'AUTH_ERROR':
      return 'Server API Key / Auth Issue';
    case 'MALFORMED_RESPONSE':
      return 'Unexpected AI Response';
    case 'TIMEOUT':
      return 'Request Timed Out';
    case 'NETWORK_ERROR':
      return 'Network Connection Failed';
    case 'CANCELLED':
      return 'Request Cancelled';
    case 'VALIDATION_ERROR':
      return 'Input Needs Adjustment';
    case 'SERVER_ERROR':
    default:
      return 'AI Service Unavailable';
  }
}

export default function AiErrorBanner({
  error,
  onRetry,
  retryLabel = 'Retry',
  secondaryLabel,
  onSecondaryAction,
}: AiErrorBannerProps) {
  const initialWait =
    error.code === 'RATE_LIMITED' && error.retryAfterSeconds
      ? Math.max(0, Math.ceil(error.retryAfterSeconds))
      : 0;

  const [cooldownLeft, setCooldownLeft] = useState(initialWait);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const prevErrorRef = useRef<AppApiError | null>(error);

  useEffect(() => {
    if (prevErrorRef.current !== error) {
      prevErrorRef.current = error;
      bannerRef.current?.focus({ preventScroll: true });
    }
  }, [error]);

  useEffect(() => {
    const nextWait =
      error.code === 'RATE_LIMITED' && error.retryAfterSeconds
        ? Math.max(0, Math.ceil(error.retryAfterSeconds))
        : 0;
    setCooldownLeft(nextWait);

    if (nextWait <= 0) return;

    const timer = setInterval(() => {
      setCooldownLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [error]);

  const isCancelled = error.code === 'CANCELLED';
  const isWarning = error.code === 'RATE_LIMITED' || error.code === 'QUOTA_EXHAUSTED' || error.code === 'TIMEOUT';

  const containerStyle = isCancelled
    ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100'
    : isWarning
    ? 'border-amber-400/35 bg-amber-500/10 text-amber-100'
    : 'border-rose-500/35 bg-rose-500/10 text-rose-100';

  const titleColor = isCancelled
    ? 'text-cyan-200'
    : isWarning
    ? 'text-amber-200'
    : 'text-rose-200';

  const IconComponent =
    error.code === 'NETWORK_ERROR'
      ? WifiOff
      : error.code === 'RATE_LIMITED' || error.code === 'TIMEOUT'
      ? Clock
      : AlertCircle;

  const retryBlockedByCooldown = error.code === 'RATE_LIMITED' && cooldownLeft > 0;

  return (
    <div
      ref={bannerRef}
      tabIndex={-1}
      role={isCancelled ? 'status' : 'alert'}
      className={`rounded-xl border p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${containerStyle}`}
    >
      <div className="flex items-start gap-3">
        <IconComponent className={`mt-0.5 h-4 w-4 shrink-0 ${titleColor}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${titleColor}`}>{getTitleForCode(error.code)}</p>
          <p className="mt-1 leading-relaxed">{error.message}</p>
          {error.nextStep && (
            <p className="mt-1.5 text-xs leading-relaxed opacity-90">
              Next step: {error.nextStep}
            </p>
          )}

          {(onRetry || (onSecondaryAction && secondaryLabel)) && (
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              {onRetry && (
                <button
                  type="button"
                  disabled={retryBlockedByCooldown}
                  onClick={onRetry}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white whitespace-nowrap transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="tabular-nums">
                    {retryBlockedByCooldown ? `Wait ${cooldownLeft}s to Retry` : retryLabel}
                  </span>
                </button>
              )}

              {onSecondaryAction && secondaryLabel && (
                <button
                  type="button"
                  onClick={onSecondaryAction}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/15 bg-transparent px-3.5 py-1.5 text-xs font-medium text-slate-100 whitespace-nowrap hover:bg-white/10"
                >
                  <span>{secondaryLabel}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
