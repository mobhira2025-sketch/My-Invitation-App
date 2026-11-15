import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertCircle,
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  HelpCircle,
  Info,
  Quote,
  RotateCcw,
  Share2,
  Users,
} from 'lucide-react';
import type { AnalysisResult } from '../types';
import {
  HIGHLIGHT_CLASSIFICATION_META,
  calculateConsistencyScore,
  type ScoreBreakdown,
} from '../utils/scoring';
import ScoreMeter from './ScoreMeter';
import { copyTextToClipboard } from '../utils/api';

interface ResultsPageProps {
  navigationSeq?: number;
  result: AnalysisResult;
  onStartNextRound: () => void;
  onChallengeFriend: () => void;
}

interface IndicatorCardData {
  key: 'consistency' | 'clarity' | 'directness';
  title: string;
  weightLabel: string;
  score: number;
  secondaryNote?: string;
  bandLabel: string;
  summary: string;
  accentBarClass: string;
  accentTextClass: string;
  borderClass: string;
  Icon: typeof Activity;
}

function useAnimatedNumber(target: number, duration = 950): number {
  const clamped = Math.max(0, Math.min(100, Math.round(target)));
  const [value, setValue] = useState(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setValue(clamped);
      return;
    }

    let rafId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(clamped * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setValue(clamped);
      }
    };

    setValue(0);
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [clamped, duration]);

  return value;
}

function IndicatorCard({
  card,
  delay,
  uncertaintyCues,
}: {
  card: IndicatorCardData;
  delay: number;
  uncertaintyCues?: string[];
}) {
  const animatedScore = useAnimatedNumber(card.score, 950);
  const Icon = card.Icon;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col justify-between rounded-2xl border bg-[#0B1228] p-6 ${card.borderClass}`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#050814]">
              <Icon className={`h-4 w-4 ${card.accentTextClass}`} aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">{card.title}</h3>
              <p className={`text-xs font-medium ${card.accentTextClass}`}>
                {card.bandLabel} · {card.weightLabel}
              </p>
            </div>
          </div>

          <span className={`font-mono text-2xl font-semibold tabular-nums ${card.accentTextClass}`}>
            {animatedScore}%
          </span>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${card.score}%` }}
            transition={{ duration: 0.9, delay: delay + 0.08, ease: [0.16, 1, 0.3, 1] }}
            className={`h-full rounded-full ${card.accentBarClass}`}
          />
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-300">{card.summary}</p>
        {card.secondaryNote && (
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{card.secondaryNote}</p>
        )}
      </div>

      {card.key === 'directness' && uncertaintyCues && uncertaintyCues.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-xs font-medium text-slate-400">
            Tentative / hedging phrases spotted (style cue only, not dishonesty):
          </p>
          <p className="mt-1 text-xs leading-relaxed text-purple-200">
            {uncertaintyCues.map((c) => `"${c}"`).join(' · ')}
          </p>
        </div>
      )}
    </motion.article>
  );
}

function getConsistencyBand(score: number): string {
  if (score >= 80) return 'Strong Narrative Alignment';
  if (score >= 55) return 'Mostly Aligned';
  return 'Noticeable Tensions';
}

function getClarityBand(score: number): string {
  if (score >= 80) return 'Specific & Clear';
  if (score >= 55) return 'Readable Detail';
  return 'Brief or Broad';
}

function getDirectnessBand(directnessScore: number): string {
  if (directnessScore >= 75) return 'Decisive Phrasing';
  if (directnessScore >= 45) return 'Measured & Qualified';
  return 'Cautious / Hedged Tone';
}

export default function ResultsPage({
  navigationSeq = 0,
  result,
  onStartNextRound,
  onChallengeFriend,
}: ResultsPageProps) {
  const [copied, setCopied] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (navigationSeq > 0) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [navigationSeq]);

  const isInsufficient =
    result.evidenceStatus === 'insufficient' || result.consistencyScore === null;

  const primaryNextLabel = result.isDemo
    ? 'Start Live 5-Question Challenge'
    : result.mode === 'text'
    ? isInsufficient
      ? 'Add More Context & Try Again'
      : 'Edit Statement or Try Another'
    : 'Play Another 5-Question Round';

  // Extract Clarity, Directness (certainty), and Narrative Consistency safely when evidence is sufficient
  let breakdown: ScoreBreakdown | null = null;
  let indicatorCards: IndicatorCardData[] = [];

  if (!isInsufficient && result.indicators) {
    const clarityIndicator =
      result.indicators.find((i) => i.title.toLowerCase().includes('clarity')) ||
      result.indicators[0];
    const directnessIndicator =
      result.indicators.find((i) => i.title.toLowerCase().includes('certainty')) ||
      result.indicators[1];
    const consistencyIndicator =
      result.indicators.find(
        (i) =>
          i.title.toLowerCase().includes('consistency') ||
          i.title.toLowerCase().includes('alignment')
      ) || result.indicators[2];

    breakdown =
      result.scoreBreakdown ??
      calculateConsistencyScore({
        consistency: consistencyIndicator.score,
        clarity: clarityIndicator.score,
        directness: directnessIndicator.score,
      });

    const { consistency, clarity, directness, hedgingLevel } = breakdown.raw;

    indicatorCards = [
      {
        key: 'consistency',
        title: 'Narrative Consistency',
        weightLabel: '60% weight',
        score: consistency,
        bandLabel: getConsistencyBand(consistency),
        summary:
          consistencyIndicator?.summary ||
          'Measures how claims connect. Valid exceptions, timeline shifts, and changed circumstances remain coherent.',
        accentBarClass: 'bg-gradient-to-r from-blue-500 to-cyan-400',
        accentTextClass: 'text-blue-300',
        borderClass: 'border-blue-500/30',
        Icon: Activity,
      },
      {
        key: 'clarity',
        title: 'Clarity & Specificity',
        weightLabel: '25% weight',
        score: clarity,
        bandLabel: getClarityBand(clarity),
        summary:
          clarityIndicator?.summary ||
          'Reflects how concrete, unambiguous, and easy to follow the phrasing is.',
        accentBarClass: 'bg-gradient-to-r from-cyan-400 to-teal-300',
        accentTextClass: 'text-cyan-300',
        borderClass: 'border-cyan-500/30',
        Icon: Eye,
      },
      {
        key: 'directness',
        title: 'Phrasing Directness',
        weightLabel: '15% weight',
        score: directness,
        bandLabel: getDirectnessBand(directness),
        summary:
          directnessIndicator?.summary ||
          'Reflects decisive vs. tentative wording (qualifiers like "maybe" or "usually").',
        secondaryNote: `Hedging / Uncertainty Cue Level: ${hedgingLevel}% (cautious wording is phrasing style only—never treated as dishonesty).`,
        accentBarClass: 'bg-gradient-to-r from-purple-500 to-fuchsia-400',
        accentTextClass: 'text-purple-300',
        borderClass: 'border-purple-500/30',
        Icon: HelpCircle,
      },
    ];
  }

  const handleShare = async () => {
    const shareLines = isInsufficient
      ? [
          `TruthCheck AI · ${result.scoreLabel}`,
          `Result: Insufficient context to generate a meaningful consistency score.`,
          `Summary: ${result.plainLanguageSummary}`,
          `(Entertainment indicator only — not a scientific measurement or lie detector.)`,
        ]
      : [
          result.isDemo
            ? `TruthCheck AI · Static Sample Preview (Not a Player Score): ${result.consistencyScore}/100 (${result.scoreLabel})`
            : `TruthCheck AI · Entertainment Consistency Indicator: ${result.consistencyScore}/100 (${result.scoreLabel})`,
          breakdown
            ? `Formula (60/25/15): ${breakdown.formulaText}`
            : '',
          `Summary: ${result.plainLanguageSummary}`,
          `(Entertainment metrics only — not a scientific measurement or probability of honesty.)`,
        ].filter(Boolean);

    const shareText = shareLines.join('\n');

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'TruthCheck AI Narrative Consistency Summary',
          text: shareText,
          url: window.location.origin,
        });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }

    const ok = await copyTextToClipboard(shareText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {result.isDemo ? (
          <div
            role="status"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          >
            <div>
              <span className="font-semibold text-white">
                Static Sample Preview — Illustrative Data Only (Not Your Score)
              </span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>
                This pre-built example shows report layout and math using sample quotes. It was not
                generated from your own input.
              </span>
            </div>
          </div>
        ) : (
          <div
            role="status"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-400/25 bg-[#0B1228] px-4 py-3 text-xs text-slate-300"
          >
            <span>
              <span className="font-semibold text-cyan-300">Your Live Analysis Results</span>
              {' · '}
              {result.mode === 'text'
                ? 'Generated for your submitted Text Test statement'
                : `Generated for your ${result.theme || 'Wildcard Mix'} 5-Question Challenge`}
            </span>
            <span className="text-slate-400">
              Entertainment indicator only · Not saved to disk
            </span>
          </div>
        )}

        {/* Top Hero Score Stage */}
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0B1228] p-6 shadow-2xl sm:p-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"
          />

          <div className="grid items-center gap-8 lg:grid-cols-12">
            <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-[#050814]/75 px-4 py-7 lg:col-span-5">
              <ScoreMeter
                score={result.consistencyScore}
                size={240}
                strokeWidth={14}
                label={
                  isInsufficient
                    ? 'Insufficient Evidence for a Score'
                    : result.isDemo
                    ? 'Sample Illustrative Score (Not Yours)'
                    : 'Entertainment Consistency Indicator'
                }
                subtitle={
                  isInsufficient
                    ? 'More narrative context needed before scoring'
                    : result.scoreLabel
                }
              />
            </div>

            <div className="lg:col-span-7">
              <p className="text-xs font-medium text-cyan-300">
                {result.isDemo
                  ? `Static Sample Layout · ${result.theme || 'Wildcard Mix'}`
                  : isInsufficient
                  ? `${result.mode === 'text' ? 'Text Test' : 'Question Challenge'} · Context Check`
                  : result.mode === 'text'
                  ? 'Text Test · Narrative Consistency & Clarity'
                  : `AI Question Challenge · ${result.theme || 'Wildcard Mix'}`}
              </p>

              <h1
                ref={headingRef}
                tabIndex={-1}
                className="mt-2 font-display text-2xl font-bold tracking-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:text-3xl"
              >
                {result.scoreLabel}
              </h1>

              <p className="mt-3 text-base leading-relaxed text-slate-200">
                {result.plainLanguageSummary}
              </p>

              {isInsufficient ? (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-400/35 bg-amber-500/10 p-4">
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
                    aria-hidden="true"
                  />
                  <div className="text-xs leading-relaxed text-amber-50">
                    <p className="font-semibold text-white">
                      Why no numeric score was invented:
                    </p>
                    <p className="mt-1">
                      {result.insufficientEvidenceReason ||
                        'There was not enough comparative narrative context to evaluate how claims align. Rather than guessing a confident number, TruthCheck AI withheld the score.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-4">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                  <div className="text-xs leading-relaxed text-slate-200">
                    <span className="font-semibold text-white">
                      Entertainment Indicator Only — Not Scientific &amp; Not a Honesty Test:
                    </span>{' '}
                    This score reflects narrative consistency and phrasing clarity for social
                    entertainment. It is not a scientific measurement, lie detector, or probability
                    that someone is telling the truth, and cautious wording is never penalized as
                    dishonesty.
                  </div>
                </div>
              )}

              {/* Clear Replay & Next Actions */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onStartNextRound}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap shadow-[0_6px_24px_rgba(37,99,235,0.3)] transition-all hover:brightness-110"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>{primaryNextLabel}</span>
                </button>

                <button
                  type="button"
                  onClick={onChallengeFriend}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap transition-colors hover:border-cyan-400/40 hover:bg-white/[0.08]"
                >
                  <Users className="h-4 w-4" aria-hidden="true" />
                  <span>Challenge a Friend</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-purple-400/35 bg-purple-500/10 px-4 py-2.5 text-sm font-semibold text-purple-200 whitespace-nowrap transition-colors hover:bg-purple-500/20"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                      <span>Summary Copied</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                      <span>Share Summary</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Three Component Breakdown + Accessible Scoring Formula */}
        {!isInsufficient && breakdown && indicatorCards.length > 0 && (
          <>
            <section aria-labelledby="indicators-heading" className="mt-9">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id="indicators-heading" className="font-display text-xl font-bold text-white">
                    Component Breakdown
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Each part contributes a fixed, documented share to your overall indicator.
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  Cautious wording = phrasing style only, never dishonesty
                </p>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-3">
                {indicatorCards.map((card, idx) => (
                  <IndicatorCard
                    key={card.key}
                    card={card}
                    delay={idx * 0.08}
                    uncertaintyCues={result.uncertaintyCues}
                  />
                ))}
              </div>
            </section>

            {/* Accessible Scoring Formula Explainer */}
            <section
              aria-labelledby="formula-heading"
              className="mt-8 rounded-2xl border border-white/10 bg-[#0B1228] p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-[#050814]">
                    <Calculator className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 id="formula-heading" className="font-display text-lg font-bold text-white">
                      How This Score Is Calculated
                    </h2>
                    <p className="text-xs text-slate-400">
                      Same deterministic math every round—so component scores and totals always
                      agree.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#050814] px-3.5 py-2 font-mono text-xs text-cyan-200 tabular-nums">
                  {breakdown.formulaText}
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-[#050814]/80 p-4">
                  <p className="text-xs font-semibold text-blue-300">
                    1. Narrative Consistency (60%)
                  </p>
                  <p className="mt-1 font-mono text-sm text-white tabular-nums">
                    {breakdown.raw.consistency}% × 0.60 = +{breakdown.weighted.consistency.toFixed(1)}{' '}
                    pts
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    Checks if claims conflict directly. Reasonable exceptions, timeline shifts, and
                    changed circumstances are treated as coherent.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#050814]/80 p-4">
                  <p className="text-xs font-semibold text-cyan-300">
                    2. Clarity &amp; Specificity (25%)
                  </p>
                  <p className="mt-1 font-mono text-sm text-white tabular-nums">
                    {breakdown.raw.clarity}% × 0.25 = +{breakdown.weighted.clarity.toFixed(1)} pts
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    Looks at concrete details, clear reasoning, and how easy the main idea is to
                    follow.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#050814]/80 p-4">
                  <p className="text-xs font-semibold text-purple-300">
                    3. Phrasing Directness (15%)
                  </p>
                  <p className="mt-1 font-mono text-sm text-white tabular-nums">
                    {breakdown.raw.directness}% × 0.15 = +{breakdown.weighted.directness.toFixed(1)}{' '}
                    pts
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    Reflects direct vs. tentative phrasing ({breakdown.raw.hedgingLevel}% hedging
                    cues). Hedging never implies deception.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Consistency & Tension Notes (with Exact Verbatim Quotes) + Helpful Feedback */}
        <section className="mt-9 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#0B1228] p-6">
            <h2 className="font-display text-lg font-bold text-white">
              Consistency, Exceptions &amp; Quoted Passages
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Distinguishing true contradictions from exceptions, timelines, and changed conditions.
            </p>

            {result.highlights.length > 0 ? (
              <div className="mt-4 space-y-4">
                {result.highlights.map((item, idx) => {
                  const meta = HIGHLIGHT_CLASSIFICATION_META[item.classification];
                  return (
                    <article
                      key={idx}
                      className={`rounded-xl border bg-[#050814]/85 p-4 ${meta.borderClass}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-xs font-medium text-slate-300">{item.excerpt}</span>
                      </div>

                      <p className="mt-1.5 text-[11px] text-slate-400">{meta.shortDesc}</p>

                      {item.quotes && item.quotes.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {item.quotes.map((quote, qIdx) => (
                            <blockquote
                              key={qIdx}
                              className="flex items-start gap-2 rounded-lg border border-white/10 bg-[#0B1228] px-3 py-2 text-xs leading-relaxed text-slate-100"
                            >
                              <Quote
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300"
                                aria-hidden="true"
                              />
                              <span>&ldquo;{quote}&rdquo;</span>
                            </blockquote>
                          ))}
                        </div>
                      )}

                      <p className="mt-3 text-sm leading-relaxed text-slate-200">{item.note}</p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                No notable tensions or contradictions stood out—your statements stayed aligned from
                start to finish.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0B1228] p-6">
            <h2 className="font-display text-lg font-bold text-white">
              {result.isDemo
                ? 'Illustrative Feedback'
                : isInsufficient
                ? 'How to Get a Full Score'
                : 'Observations & Feedback'}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Practical takeaways about narrative structure and wording clarity.
            </p>

            {result.observations.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {result.observations.map((obs, idx) => (
                  <li
                    key={idx}
                    className="border-b border-white/10 pb-3 text-sm leading-relaxed text-slate-300 last:border-b-0 last:pb-0"
                  >
                    <span className="mr-2 font-mono text-xs text-cyan-300 tabular-nums">
                      0{idx + 1}.
                    </span>
                    {obs}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                Your submission was concise and easy to follow.
              </p>
            )}
          </div>
        </section>

        {/* Optional Review of Q&A if from Question Challenge */}
        {result.questions && result.answers && (
          <section className="mt-8 rounded-2xl border border-white/10 bg-[#0B1228] p-6">
            <button
              type="button"
              onClick={() => setShowAnswers((prev) => !prev)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="font-display text-base font-semibold text-white">
                Review Your 5 Questions &amp; Answers
              </span>
              {showAnswers ? (
                <ChevronUp className="h-5 w-5 text-slate-400" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" aria-hidden="true" />
              )}
            </button>

            {showAnswers && (
              <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
                {result.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0"
                  >
                    <p className="text-xs font-medium text-cyan-300">Question {idx + 1}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{q.prompt}</p>
                    <p className="mt-1.5 text-sm text-slate-300">{result.answers?.[idx]}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </motion.div>
    </div>
  );
}
