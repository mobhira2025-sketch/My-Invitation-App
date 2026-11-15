import { useEffect, useRef, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Loader2, RotateCcw, X } from 'lucide-react';
import type { TextTestSessionState } from '../state/challengeSession';
import AiErrorBanner from './AiErrorBanner';

interface TextTestPageProps {
  navigationSeq?: number;
  state: TextTestSessionState;
  onTextChange: (nextText: string) => void;
  onAnalyze: () => void;
  onCancel: () => void;
  onClear: () => void;
  onOpenFriendChallenge?: () => void;
}

const SAMPLE_STATEMENTS = [
  {
    label: 'Contradiction Mix',
    text: 'Honestly, I never check my phone during dinner because I value real conversation. Well, I did answer two work messages during pasta tonight, and maybe checked the game score once, but I basically keep it tucked away the whole evening.',
  },
  {
    label: 'Hedged Excuse',
    text: 'I suppose I might be able to finish the weekend marathon if the weather is kind of mild, though I have only trained twice this month and probably prefer sleeping in whenever possible.',
  },
  {
    label: 'Direct & Clear',
    text: 'I prefer working in quiet libraries over noisy cafes because background chatter slows down my reading. That is why I reserve a study desk every Tuesday and Thursday morning.',
  },
];

export default function TextTestPage({
  navigationSeq = 0,
  state,
  onTextChange,
  onAnalyze,
  onCancel,
  onClear,
  onOpenFriendChallenge,
}: TextTestPageProps) {
  const { text, loading, error } = state;
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (navigationSeq > 0) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [navigationSeq]);

  const trimmedText = text.trim();
  const trimmedLength = trimmedText.length;
  const wordCount = trimmedText ? trimmedText.split(/\s+/).filter(Boolean).length : 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onAnalyze();
  };

  const handleClearClick = () => {
    onClear();
    window.setTimeout(() => {
      textareaRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-sm font-medium text-cyan-300">
          Text Test · Instant Narrative Consistency Check
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 font-display text-3xl font-bold tracking-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:text-4xl"
        >
          Test Any Statement or Story
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-300">
          Enter a few sentences, an opinion, or a quick explanation. TruthCheck AI evaluates narrative
          consistency, phrasing clarity, and hedging style—never honesty. Reasonable exceptions and
          changed views over time are treated fairly.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border border-white/10 bg-[#0B1228] p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="statement-input" className="text-sm font-semibold text-white">
              Your statement or answer
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Try a sample:</span>
              {SAMPLE_STATEMENTS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  disabled={loading}
                  onClick={() => onTextChange(sample.text)}
                  className="min-h-[38px] rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 whitespace-nowrap transition-colors hover:border-cyan-400/40 hover:text-white disabled:opacity-50"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            id="statement-input"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            rows={6}
            maxLength={3000}
            disabled={loading}
            placeholder="Write a few sentences—for example, share a preference with an exception, explain how an opinion changed over time, or tell a quick story..."
            className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-[#050814] p-4 text-base leading-relaxed text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none disabled:opacity-60"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <span>
              {loading
                ? 'Waiting for AI response (up to 30s) · You can cancel anytime'
                : 'Kept in session memory only · Very brief inputs (<6 words) are not scored'}
            </span>
            <span className="font-mono tabular-nums">
              {wordCount} words · {trimmedLength} / 3000 chars
            </span>
          </div>

          {error && (
            <div className="mt-4">
              <AiErrorBanner
                error={error}
                onRetry={error.code !== 'VALIDATION_ERROR' ? onAnalyze : undefined}
                retryLabel="Retry Analysis"
                secondaryLabel={
                  error.code === 'QUOTA_EXHAUSTED' && onOpenFriendChallenge
                    ? 'Open Friend Challenge (No AI)'
                    : undefined
                }
                onSecondaryAction={
                  error.code === 'QUOTA_EXHAUSTED' ? onOpenFriendChallenge : undefined
                }
              />
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <button
              type="button"
              disabled={loading || (text.length === 0 && !error)}
              onClick={handleClearClick}
              title="Erase this statement draft and focus the input box"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Clear Draft</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              {loading && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 whitespace-nowrap transition-colors hover:border-rose-400/40 hover:text-white"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  <span>Cancel</span>
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white whitespace-nowrap shadow-[0_6px_24px_rgba(37,99,235,0.3)] transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Analyzing with Gemini...</span>
                  </>
                ) : (
                  <>
                    <span>Analyze Statement</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
