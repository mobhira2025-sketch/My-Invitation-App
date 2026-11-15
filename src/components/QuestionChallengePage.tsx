import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Eraser,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import { SOLO_CATEGORIES } from '../data/offlineDecks';
import {
  countSoloAnswered,
  type ChallengePlayMode,
  type SoloChallengeSessionState,
} from '../state/challengeSession';
import AnswerProgressBar from './AnswerProgressBar';
import AiErrorBanner from './AiErrorBanner';

export type { ChallengePlayMode };

interface QuestionChallengePageProps {
  navigationSeq?: number;
  state: SoloChallengeSessionState;
  onEnsureInitialized: () => void;
  onAnswerChange: (index: number, value: string) => void;
  onSelectQuestionIndex: (index: number) => void;
  onRequestNewRound: () => void;
  onRequestModeSwitch: (mode: ChallengePlayMode) => void;
  onRequestCategoryChange: (category: string) => void;
  onRetryQuestionFetch: () => void;
  onCancelQuestionFetch: () => void;
  onSubmitRound: () => void;
  onCancelAnalysis: () => void;
  onSetValidationError: (message: string, nextStep: string) => void;
  onViewOfflineSummaryFromError: () => void;
  onClearCurrentAnswer: () => void;
  onRequestResetAnswers: () => void;
}

export default function QuestionChallengePage({
  navigationSeq = 0,
  state,
  onEnsureInitialized,
  onAnswerChange,
  onSelectQuestionIndex,
  onRequestNewRound,
  onRequestModeSwitch,
  onRequestCategoryChange,
  onRetryQuestionFetch,
  onCancelQuestionFetch,
  onSubmitRound,
  onCancelAnalysis,
  onSetValidationError,
  onViewOfflineSummaryFromError,
  onClearCurrentAnswer,
  onRequestResetAnswers,
}: QuestionChallengePageProps) {
  const {
    initialized,
    playMode,
    selectedCategory,
    loadedCategory,
    questions,
    activeOfflineDeck,
    totalOfflineDecks,
    answers,
    currentIndex,
    loadingQuestions,
    analyzing,
    questionError,
    analysisError,
  } = state;

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [answerFocusTrigger, setAnswerFocusTrigger] = useState(0);

  // Initialize once on first visit to Question Challenge; subsequent visits preserve active session state.
  useEffect(() => {
    if (!initialized) {
      onEnsureInitialized();
    }
  }, [initialized, onEnsureInitialized]);

  // Move focus to heading when user navigates to this section
  useEffect(() => {
    if (navigationSeq > 0) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [navigationSeq]);

  // Move focus to the active question textarea when user switches question steps or clears input
  useEffect(() => {
    if (answerFocusTrigger > 0) {
      const timer = window.setTimeout(() => {
        textareaRef.current?.focus({ preventScroll: true });
      }, 40);
      return () => window.clearTimeout(timer);
    }
  }, [answerFocusTrigger, currentIndex]);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex] || '';
  const answeredCount = countSoloAnswered(state);
  const allAnswered = questions.length === 5 && answers.every((a) => a.trim().length >= 2);
  const anyAnswerTyped = answers.some((a) => a.trim().length > 0);

  const handleJumpToStep = (idx: number) => {
    onSelectQuestionIndex(idx);
    setAnswerFocusTrigger((prev) => prev + 1);
  };

  const handleNextOrSubmit = () => {
    if (analyzing || loadingQuestions) return;

    if (currentAnswer.trim().length < 2) {
      onSetValidationError(
        'Please enter a short answer (at least 2 characters) before continuing.',
        'Write a quick response in the box above.'
      );
      return;
    }

    if (currentIndex < 4) {
      onSelectQuestionIndex(currentIndex + 1);
      setAnswerFocusTrigger((prev) => prev + 1);
      return;
    }

    onSubmitRound();
  };

  const handleClearBox = () => {
    onClearCurrentAnswer();
    setAnswerFocusTrigger((prev) => prev + 1);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-300">
            {playMode === 'offline'
              ? `Offline Mode · Curated 5-Question Deck · ${selectedCategory}`
              : `Live AI Question Challenge · 5 Questions · ${selectedCategory}`}
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-2 font-display text-3xl font-bold tracking-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:text-4xl"
          >
            Answer 5 Questions One by One
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Direct Live AI vs Play Offline Mode Switch */}
          <div
            role="group"
            aria-label="Challenge mode"
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#0B1228] p-1"
          >
            <button
              type="button"
              disabled={analyzing}
              onClick={() => onRequestModeSwitch('live')}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                playMode === 'live'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              } disabled:opacity-50`}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Live AI</span>
            </button>

            <button
              type="button"
              disabled={analyzing}
              onClick={() => onRequestModeSwitch('offline')}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                playMode === 'offline'
                  ? 'border border-amber-400/40 bg-amber-500/25 text-amber-200'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              } disabled:opacity-50`}
            >
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Play Offline</span>
            </button>
          </div>

          <button
            type="button"
            disabled={loadingQuestions || analyzing}
            onClick={onRequestNewRound}
            title="Start a brand-new 5-question round"
            className="inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 whitespace-nowrap transition-colors hover:border-cyan-400/40 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingQuestions ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>New Round</span>
          </button>
        </div>
      </div>

      {/* Prominent Offline Mode Banner Throughout the Round */}
      {playMode === 'offline' && activeOfflineDeck && (
        <div
          role="status"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-100"
        >
          <div className="flex items-start gap-2.5">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <div>
              <span className="font-semibold text-white">Offline Mode Active</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>
                {activeOfflineDeck.category} · Deck {activeOfflineDeck.deckNumber} of{' '}
                {totalOfflineDecks}: {activeOfflineDeck.title}
              </span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span className="text-amber-200/90">
                Curated deck only (not evaluated by Gemini)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onRequestModeSwitch('live')}
            className="text-xs font-semibold text-cyan-300 underline-offset-4 hover:underline whitespace-nowrap"
          >
            Switch to Live AI
          </button>
        </div>
      )}

      {/* Category Selector */}
      <div
        role="group"
        aria-label="Question category"
        className="mt-5 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-[#0B1228] p-1.5"
      >
        {SOLO_CATEGORIES.map((item) => {
          const active = selectedCategory === item;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={active}
              disabled={analyzing}
              onClick={() => onRequestCategoryChange(item)}
              className={`rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
              } disabled:opacity-60`}
            >
              {item}
            </button>
          );
        })}
      </div>

      {/* Main Stage */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-[#0B1228] p-6 sm:p-8">
        {loadingQuestions ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" aria-hidden="true" />
            <p className="mt-4 font-display text-lg font-semibold text-white">
              Crafting 5 fresh AI questions for {selectedCategory}...
            </p>
            <p className="mt-1.5 text-sm text-slate-400">
              Waiting for live Gemini response (up to 30s) · Or jump straight into a curated{' '}
              {selectedCategory} deck.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onCancelQuestionFetch}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 whitespace-nowrap hover:border-rose-400/40 hover:text-white"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cancel</span>
              </button>

              <button
                type="button"
                onClick={() => onRequestModeSwitch('offline')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-100 whitespace-nowrap hover:bg-amber-500/25"
              >
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Play {selectedCategory} Offline</span>
              </button>
            </div>
          </div>
        ) : questions.length === 0 ? (
          <div className="py-4">
            {questionError ? (
              <AiErrorBanner
                error={questionError}
                onRetry={onRetryQuestionFetch}
                retryLabel={`Retry ${selectedCategory}`}
                secondaryLabel={`Play ${selectedCategory} Offline`}
                onSecondaryAction={() => onRequestModeSwitch('offline')}
              />
            ) : (
              <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                <p className="text-base font-medium text-white">
                  No questions loaded for {selectedCategory} yet.
                </p>
                <p className="mt-1.5 text-sm text-slate-400">
                  Generate 5 live AI questions or start a curated offline deck right away.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={onRetryQuestionFetch}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap hover:bg-blue-500"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    <span>Generate {selectedCategory} Questions</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRequestModeSwitch('offline')}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-100 whitespace-nowrap hover:bg-amber-500/25"
                  >
                    <WifiOff className="h-4 w-4" aria-hidden="true" />
                    <span>Play {selectedCategory} Offline</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {questionError && playMode === 'live' && (
              <div className="mb-5">
                <AiErrorBanner
                  error={questionError}
                  onRetry={onRetryQuestionFetch}
                  retryLabel={`Retry ${selectedCategory}`}
                  secondaryLabel={`Play ${selectedCategory} Offline`}
                  onSecondaryAction={() => onRequestModeSwitch('offline')}
                />
              </div>
            )}

            {/* Visual Progress Bar & Quick-Jump Steps */}
            <div className="mb-6 space-y-3 border-b border-white/10 pb-5">
              <AnswerProgressBar
                answeredCount={answeredCount}
                totalCount={questions.length}
                currentIndex={currentIndex}
                label="Question Challenge answer progress"
                secondaryLabel={
                  playMode === 'offline' && activeOfflineDeck
                    ? `Offline Mode · ${loadedCategory} · Deck ${activeOfflineDeck.deckNumber}`
                    : `Live AI · ${loadedCategory}`
                }
              />

              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const answered = (answers[idx] || '').trim().length >= 2;
                  const isCurrent = idx === currentIndex;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      disabled={analyzing}
                      onClick={() => handleJumpToStep(idx)}
                      aria-label={`Go to question ${idx + 1}${answered ? ' (answered)' : ''}`}
                      className={`flex h-9 items-center justify-center rounded-lg font-mono text-xs font-semibold tabular-nums transition-colors ${
                        isCurrent
                          ? 'bg-cyan-400 text-[#050814]'
                          : answered
                          ? 'bg-blue-600/80 text-white hover:bg-blue-500'
                          : 'bg-white/10 text-slate-400 hover:bg-white/15 hover:text-white'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {currentQuestion && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuestion.id}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h2 className="font-display text-xl leading-snug font-bold text-white sm:text-2xl">
                    {currentQuestion.prompt}
                  </h2>
                  {currentQuestion.hint && (
                    <p className="mt-2 text-sm text-slate-400">{currentQuestion.hint}</p>
                  )}

                  <textarea
                    ref={textareaRef}
                    value={currentAnswer}
                    onChange={(e) => onAnswerChange(currentIndex, e.target.value)}
                    rows={4}
                    maxLength={1500}
                    disabled={analyzing}
                    placeholder="Type your honest or playful answer here..."
                    aria-label={`Answer to question ${currentIndex + 1}`}
                    className="mt-5 w-full resize-y rounded-xl border border-white/10 bg-[#050814] p-4 text-base leading-relaxed text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none disabled:opacity-60"
                  />
                </motion.div>
              </AnimatePresence>
            )}

            {analysisError && (
              <div className="mt-4">
                <AiErrorBanner
                  error={analysisError}
                  onRetry={analysisError.code !== 'VALIDATION_ERROR' ? onSubmitRound : undefined}
                  retryLabel="Retry Live AI Analysis"
                  secondaryLabel={
                    analysisError.code !== 'VALIDATION_ERROR' && allAnswered
                      ? 'View Offline Summary'
                      : undefined
                  }
                  onSecondaryAction={
                    analysisError.code !== 'VALIDATION_ERROR' && allAnswered
                      ? onViewOfflineSummaryFromError
                      : undefined
                  }
                />
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={currentIndex === 0 || analyzing}
                  onClick={() => handleJumpToStep(Math.max(0, currentIndex - 1))}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 whitespace-nowrap transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  disabled={analyzing || currentAnswer.length === 0}
                  onClick={handleClearBox}
                  title="Erase only this question's current answer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-300 whitespace-nowrap transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Clear Answer</span>
                </button>

                <button
                  type="button"
                  disabled={analyzing || (!anyAnswerTyped && currentIndex === 0)}
                  onClick={onRequestResetAnswers}
                  title="Erase all 5 answers and return to Question 1 with these same questions"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-300 whitespace-nowrap transition-colors hover:border-amber-400/40 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {analyzing && (
                  <button
                    type="button"
                    onClick={onCancelAnalysis}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 whitespace-nowrap transition-colors hover:border-rose-400/40 hover:text-white"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    <span>Cancel</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={analyzing}
                  onClick={handleNextOrSubmit}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white whitespace-nowrap shadow-[0_6px_24px_rgba(37,99,235,0.3)] transition-all duration-150 hover:brightness-110 disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Comparing Your 5 Answers...</span>
                    </>
                  ) : currentIndex < 4 ? (
                    <>
                      <span>Next Question</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  ) : playMode === 'offline' ? (
                    <>
                      <span>View Offline Summary</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <span>Reveal Consistency Score</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        {playMode === 'offline'
          ? 'Offline Mode · Curated local deck only · Answers remain in session memory and are not sent to Gemini or stored.'
          : 'Your answers stay in session memory only when switching sections and are never saved without consent.'}
      </p>
    </div>
  );
}
