import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, FileText, HelpCircle, Users, WifiOff } from 'lucide-react';
import type { AppView } from '../types';
import ScoreMeter from './ScoreMeter';

interface HomePageProps {
  navigationSeq?: number;
  hasUnfinishedSoloRound?: boolean;
  onNavigate: (view: AppView) => void;
  onStartLiveChallenge: () => void;
  onStartOffline: () => void;
  onViewDemo: () => void;
}

interface SamplePreviewProfile {
  id: string;
  label: string;
  score: number;
  vibe: string;
  quote: string;
  indicators: Array<{ name: string; value: number }>;
  note: string;
}

const SAMPLE_PREVIEWS: SamplePreviewProfile[] = [
  {
    id: 'decisive',
    label: 'Crisp Story',
    // 60% * 88 + 25% * 92 + 15% * 88 = 52.8 + 23.0 + 13.2 = 89
    score: 89,
    vibe: 'Steady & Clear (Sample)',
    quote: '"I always turn down late-night plans on weekdays because early mornings keep my whole week calm."',
    indicators: [
      { name: 'Narrative Consistency (60%)', value: 88 },
      { name: 'Clarity & Specificity (25%)', value: 92 },
      { name: 'Phrasing Directness (15%)', value: 88 },
    ],
    note: 'Illustrative example: direct preference paired with a clear reason.',
  },
  {
    id: 'twist',
    label: 'Plot Twist',
    // 60% * 57 + 25% * 84 + 15% * 60 = 34.2 + 21.0 + 9.0 = 64.2 -> 64
    score: 64,
    vibe: 'Direct Tension (Sample)',
    quote: '"I hate surprises, yet I booked a mystery flight last Friday—maybe because I secretly love chaos."',
    indicators: [
      { name: 'Narrative Consistency (60%)', value: 57 },
      { name: 'Clarity & Specificity (25%)', value: 84 },
      { name: 'Phrasing Directness (15%)', value: 60 },
    ],
    note: 'Illustrative example: stated dislike of surprises conflicts with booking a mystery trip.',
  },
];

export default function HomePage({
  navigationSeq = 0,
  hasUnfinishedSoloRound = false,
  onNavigate,
  onStartLiveChallenge,
  onStartOffline,
  onViewDemo,
}: HomePageProps) {
  const [sampleIndex, setSampleIndex] = useState(0);
  const activeSample = SAMPLE_PREVIEWS[sampleIndex];
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (navigationSeq > 0) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [navigationSeq]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-6 lg:pt-16">
      {/* Hero Section */}
      <section className="grid items-stretch gap-10 lg:grid-cols-12 lg:gap-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col justify-center lg:col-span-7"
        >
          <p className="text-sm font-medium text-cyan-300">
            Social Consistency Game · Instant AI Feedback · No Sign-Up Required
          </p>

          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-4 max-w-2xl font-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1.08] font-bold tracking-tight text-white [text-wrap:balance] outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            Can AI Catch Your Contradictions?
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Answer questions, challenge friends and discover your consistency score. Explore how
            clearly your ideas connect across sentences or 5-question rounds.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onStartLiveChallenge}
              className="inline-flex min-h-[48px] items-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-7 py-3.5 text-base font-semibold text-white whitespace-nowrap shadow-[0_8px_30px_rgba(37,99,235,0.35)] transition-all duration-150 hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            >
              <span>
                {hasUnfinishedSoloRound
                  ? 'Resume 5-Question Challenge'
                  : 'Start 5-Question Challenge'}
              </span>
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('text-test')}
              className="inline-flex min-h-[48px] items-center rounded-xl border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-200 whitespace-nowrap transition-colors duration-150 hover:border-cyan-400/40 hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            >
              Open Text Test
            </button>
          </div>

          <p className="mt-6 max-w-lg text-xs leading-relaxed text-slate-400">
            Entertainment disclaimer: TruthCheck AI is a social entertainment experience—not a
            scientific measurement, probability, or lie detector. Scores measure narrative
            consistency and phrasing clarity only, never honesty or deception.
          </p>
        </motion.div>

        {/* Hero Right Column: Interactive Sample Preview */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col justify-between rounded-2xl border border-amber-400/25 bg-[#0B1228]/90 p-6 shadow-2xl sm:p-7 lg:col-span-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-xs font-semibold text-amber-300">
                Sample Preview Only — Not Your Score
              </p>
              <p className="font-display text-sm font-semibold text-white">
                {activeSample.vibe}
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Sample preview profiles"
              className="flex items-center gap-1 rounded-lg bg-[#050814] p-1 border border-white/10"
            >
              {SAMPLE_PREVIEWS.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={sampleIndex === idx}
                  onClick={() => setSampleIndex(idx)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    sampleIndex === idx
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-amber-100/80">
            Static pre-built example to preview how scoring works. Submit Text Test or Question
            Challenge for your actual analysis.
          </p>

          <div className="my-5 flex justify-center">
            <ScoreMeter
              score={activeSample.score}
              size={176}
              strokeWidth={12}
              label="Sample Preview Score (Not Yours)"
            />
          </div>

          <div className="space-y-4">
            <p className="text-sm italic leading-relaxed text-slate-300">
              <span className="not-italic font-semibold text-slate-200">Example input: </span>
              {activeSample.quote}
            </p>

            <div className="space-y-2.5 border-t border-white/10 pt-4">
              {activeSample.indicators.map((ind) => (
                <div key={ind.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-300">{ind.name}</span>
                    <span className="font-mono text-slate-200 tabular-nums">{ind.value}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-purple-500 transition-all duration-300"
                      style={{ width: `${ind.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-xs leading-relaxed text-slate-400">{activeSample.note}</p>
              <button
                type="button"
                onClick={onViewDemo}
                className="text-xs font-semibold text-cyan-300 underline-offset-4 hover:underline whitespace-nowrap shrink-0"
              >
                View Static Sample Report
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Three Feature Cards */}
      <section aria-labelledby="modes-heading" className="mt-20">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="modes-heading" className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Three Ways to Play
            </h2>
            <p className="mt-1.5 text-sm text-slate-400 sm:text-base">
              Choose a quick text check, a 5-question solo challenge, or a head-to-head friend comparison.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1: Text Test */}
          <article className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1228] p-6 transition-colors duration-150 hover:border-cyan-400/35">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-cyan-300">01. Instant Check</span>
                <FileText className="h-5 w-5 text-cyan-400" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-white">Text Test</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
                Paste or write any statement or story. Gemini highlights clarity, uncertainty
                phrasing, and subtle internal contradictions in plain language.
              </p>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => onNavigate('text-test')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400"
              >
                <span>Open Text Test</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </article>

          {/* Card 2: AI Question Challenge */}
          <article className="flex flex-col justify-between rounded-2xl border border-blue-500/30 bg-[#0D1633] p-6 transition-colors duration-150 hover:border-blue-400/60">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-300">02. Flagship Mode</span>
                <HelpCircle className="h-5 w-5 text-blue-400" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-white">
                AI Question Challenge
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
                Answer 5 fresh AI-generated questions one at a time. Gemini cross-checks your
                reasoning across every answer and reveals your consistency score out of 100.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={onStartLiveChallenge}
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-300 whitespace-nowrap transition-colors hover:text-blue-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400"
              >
                <span>
                  {hasUnfinishedSoloRound
                    ? 'Resume 5-Question Challenge'
                    : 'Open 5-Question Challenge'}
                </span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onStartOffline}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200 whitespace-nowrap transition-colors hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400"
              >
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Play 5-Question Offline</span>
              </button>
            </div>
          </article>

          {/* Card 3: Challenge a Friend */}
          <article className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1228] p-6 transition-colors duration-150 hover:border-purple-400/40">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-purple-300">03. Party Game</span>
                <Users className="h-5 w-5 text-purple-400" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-white">
                Challenge a Friend
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
                Build a 20+ question challenge and send an invite link. Once your friend submits,
                every answer gets a dramatic random TRUE or LIE reveal with sound effects.
              </p>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => onNavigate('challenge-friend')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-purple-300 transition-colors hover:text-purple-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400"
              >
                <span>Create Friend Challenge</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </article>
        </div>
      </section>

      {/* Entertainment & Privacy Assurances */}
      <section className="mt-14 grid gap-6 border-t border-white/10 pt-10 md:grid-cols-2">
        <div>
          <h3 className="font-display text-base font-semibold text-white">
            Entertainment-Based Consistency Scoring
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            TruthCheck AI spots linguistic hedging, shifts in stance, and logical tension for social
            fun. It never detects lies, verifies facts, or judges personal honesty.
          </p>
        </div>
        <div>
          <h3 className="font-display text-base font-semibold text-white">
            Private by Default, No Account Needed
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Text tests and solo challenges run on demand without saving your answers. Shared friend
            challenge links store answers temporarily for 24 hours only when you opt in.
          </p>
        </div>
      </section>
    </div>
  );
}
