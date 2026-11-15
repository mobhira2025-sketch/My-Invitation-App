import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  Info,
  RefreshCw,
  RotateCcw,
  Users,
  WifiOff,
} from 'lucide-react';
import type { OfflineRoundResult } from '../types';
import { copyTextToClipboard } from '../utils/api';

interface OfflineResultsPageProps {
  navigationSeq?: number;
  result: OfflineRoundResult;
  onPlayAgainOffline: (category: string) => void;
  onTryLiveAi: (category: string) => void;
  onChallengeFriend: () => void;
  onViewDemoResults: () => void;
}

export default function OfflineResultsPage({
  navigationSeq = 0,
  result,
  onPlayAgainOffline,
  onTryLiveAi,
  onChallengeFriend,
  onViewDemoResults,
}: OfflineResultsPageProps) {
  const [copied, setCopied] = useState(false);
  const [checkedPrompts, setCheckedPrompts] = useState<number[]>([]);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (navigationSeq > 0) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [navigationSeq]);

  const toggleChecked = (idx: number) => {
    setCheckedPrompts((prev) =>
      prev.includes(idx) ? prev.filter((item) => item !== idx) : [...prev, idx]
    );
  };

  const handleCopySummary = async () => {
    const lines = [
      `TruthCheck AI · Offline Mode Completion Summary (Not Analyzed by Gemini)`,
      `Category: ${result.category} · Deck ${result.deckNumber} of ${result.totalDecksInCategory} (${result.deckTitle})`,
      `Completed: ${result.questions.length} / ${result.questions.length} questions · ${result.totalWords} words written`,
      '',
      ...result.questions.flatMap((q, idx) => [
        `Q${idx + 1}: ${q.prompt}`,
        `A${idx + 1}: ${result.answers[idx] ?? ''}`,
        '',
      ]),
      'Self-Review Prompts:',
      ...result.selfReviewQuestions.map((prompt, idx) => `${idx + 1}. ${prompt}`),
    ];

    const ok = await copyTextToClipboard(lines.join('\n'));
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
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Prominent Offline Mode Completion Header */}
        <section className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-[#0B1228] p-6 shadow-2xl sm:p-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"
          />

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-200">
            <WifiOff className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <span>Offline Mode</span>
            <span aria-hidden="true">·</span>
            <span>Curated Deck {result.deckNumber} of {result.totalDecksInCategory}</span>
            <span aria-hidden="true">·</span>
            <span>No Live AI Used</span>
          </div>

          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-3 max-w-2xl font-display text-2xl font-bold tracking-tight text-white [text-wrap:balance] outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:text-3xl"
          >
            Offline Round Complete: {result.deckTitle}
          </h1>

          <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-200">
            You answered all {result.questions.length} questions in{' '}
            <span className="font-semibold text-white">{result.category}</span> using a bundled
            offline deck. Because live Gemini analysis was not active, no AI consistency score was
            generated or simulated for this round.
          </p>

          {/* Objective Completion Summary Metrics */}
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-[#050814]/80 p-4">
              <p className="text-xs text-slate-400">Mode</p>
              <p className="mt-1 font-display text-lg font-bold text-amber-200">Offline Mode</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#050814]/80 p-4">
              <p className="text-xs text-slate-400">Questions Completed</p>
              <p className="mt-1 font-mono text-lg font-bold text-white tabular-nums">
                {result.questions.length} / {result.questions.length}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#050814]/80 p-4">
              <p className="text-xs text-slate-400">Words Written</p>
              <p className="mt-1 font-mono text-lg font-bold text-cyan-300 tabular-nums">
                {result.totalWords}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#050814]/80 p-4">
              <p className="text-xs text-slate-400">Characters</p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-200 tabular-nums">
                {result.totalCharacters}
              </p>
            </div>
          </div>

          {/* Clear No-Invented-Score Notice */}
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <div className="text-xs leading-relaxed text-amber-100">
              <span className="font-semibold text-white">
                Offline Completion Summary — Not Gemini Analysis:
              </span>{' '}
              Rather than inventing a fake score offline, this screen pairs your exact responses
              with curated self-review prompts so you can spot patterns yourself.
            </div>
          </div>

          {/* Primary Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onPlayAgainOffline(result.category)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0 shadow-[0_6px_24px_rgba(37,99,235,0.3)] transition-all hover:brightness-110"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>New Offline Round</span>
            </button>

            <button
              type="button"
              onClick={() => onTryLiveAi(result.category)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:border-cyan-400/40 hover:bg-white/[0.08]"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Try Live 5-Question Challenge</span>
            </button>

            <button
              type="button"
              onClick={onChallengeFriend}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:border-purple-400/40 hover:text-white"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>Challenge a Friend</span>
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:bg-white/5 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                  <span>Summary Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  <span>Copy Answers</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Self-Review Questions + Submitted Answers */}
        <section className="mt-8 grid gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-white/10 bg-[#0B1228] p-6 lg:col-span-5">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Self-Review Questions
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Check each prompt as you inspect your own answers.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-cyan-300 tabular-nums">
                {checkedPrompts.length}/{result.selfReviewQuestions.length}
              </span>
            </div>

            <ul className="mt-4 space-y-3">
              {result.selfReviewQuestions.map((prompt, idx) => {
                const checked = checkedPrompts.includes(idx);
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => toggleChecked(idx)}
                      aria-pressed={checked}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                        checked
                          ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
                          : 'border-white/10 bg-[#050814]/70 text-slate-200 hover:border-cyan-400/35'
                      }`}
                    >
                      <CheckCircle2
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          checked ? 'text-emerald-300' : 'text-slate-500'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="text-sm leading-relaxed">{prompt}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-xs leading-relaxed text-slate-400">
                Want to see what a scored Live AI report looks like? Open our separate static
                example below.
              </p>
              <button
                type="button"
                onClick={onViewDemoResults}
                className="mt-2.5 inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-200 whitespace-nowrap hover:border-cyan-400/40 hover:text-white"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                <span>View Demo — Illustrative Results</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0B1228] p-6 lg:col-span-7">
            <div className="border-b border-white/10 pb-4">
              <h2 className="font-display text-lg font-bold text-white">
                Your 5 Offline Answers
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Stored only in memory for this session · Not sent to Gemini or saved on servers
              </p>
            </div>

            <div className="mt-4 space-y-4">
              {result.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0"
                >
                  <p className="text-xs font-medium text-cyan-300">
                    Question {idx + 1} of {result.questions.length}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{q.prompt}</p>
                  <p className="mt-2 rounded-xl border border-white/10 bg-[#050814]/80 p-3.5 text-sm leading-relaxed text-slate-200">
                    {result.answers[idx]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
