interface AnswerProgressBarProps {
  answeredCount: number;
  totalCount: number;
  currentIndex: number;
  label?: string;
  secondaryLabel?: string;
}

export default function AnswerProgressBar({
  answeredCount,
  totalCount,
  currentIndex,
  label = 'Progress',
  secondaryLabel,
}: AnswerProgressBarProps) {
  const safeTotal = Math.max(1, totalCount);
  const clampedAnswered = Math.max(0, Math.min(answeredCount, safeTotal));
  const ratio = clampedAnswered / safeTotal;
  const percent = Math.round(ratio * 100);
  const remaining = safeTotal - clampedAnswered;
  const isComplete = clampedAnswered === safeTotal;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold text-cyan-300 tabular-nums">
            Question {Math.min(currentIndex + 1, safeTotal)} of {safeTotal}
          </span>
          {secondaryLabel && (
            <>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="text-slate-400">{secondaryLabel}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono tabular-nums">
          <span className={isComplete ? 'font-semibold text-emerald-300' : 'font-semibold text-white'}>
            {clampedAnswered} of {safeTotal} answered
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className={isComplete ? 'text-emerald-300' : 'text-cyan-300'}>
            {percent}%
          </span>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={clampedAnswered}
        aria-valuetext={`${clampedAnswered} of ${safeTotal} questions answered (${percent}%)`}
        className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          style={{ transform: `scaleX(${ratio})` }}
          className={`h-full w-full origin-left rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none ${
            isComplete
              ? 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 shadow-[0_0_16px_rgba(52,211,153,0.45)]'
              : 'bg-gradient-to-r from-blue-500 via-cyan-400 to-purple-500 shadow-[0_0_14px_rgba(34,211,238,0.35)]'
          }`}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <span>
          {isComplete
            ? 'All questions answered — ready to submit.'
            : `${remaining} ${remaining === 1 ? 'question' : 'questions'} left to complete`}
        </span>
      </div>
    </div>
  );
}
