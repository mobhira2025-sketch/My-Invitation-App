import { useCallback, useEffect, useRef, useState } from 'react';
import Navbar from './components/Navbar';
import HomePage from './components/HomePage';
import TextTestPage from './components/TextTestPage';
import QuestionChallengePage, { type ChallengePlayMode } from './components/QuestionChallengePage';
import ResultsPage from './components/ResultsPage';
import OfflineResultsPage from './components/OfflineResultsPage';
import ChallengeFriendPage, { type ConfirmPromptOptions } from './components/ChallengeFriendPage';
import ConfirmDialog from './components/ConfirmDialog';
import {
  DEMO_ILLUSTRATIVE_RESULT,
  pickNextOfflineDeck,
  type OfflineDeck,
} from './data/offlineDecks';
import {
  clearCurrentSoloAnswerInPlace,
  createInitialFriendChallengeState,
  createInitialSoloState,
  createInitialTextTestState,
  executeSoloChallengeAnalysis,
  executeSoloQuestionFetch,
  hasUnfinishedSoloAnswers,
  isStaleRoundEpoch,
  normalizeSoloCategory,
  prepareNewLiveSoloRoundState,
  prepareOfflineSoloRoundState,
  resetSoloRoundAnswersInPlace,
  type FriendChallengeSessionState,
  type SoloChallengeSessionState,
  type TextTestSessionState,
} from './state/challengeSession';
import type { AnalysisResult, AppView, OfflineRoundResult } from './types';
import { AppApiError, requestJson, toAppApiError } from './utils/api';
import { unlockAudio } from './utils/soundEffects';
import { assertValidAnalysisResult, isValidAnalysisResult } from './utils/validators';

const SOUND_STORAGE_KEY = 'truthcheck_sound_enabled';

function readInitialSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(SOUND_STORAGE_KEY);
    if (stored === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

function readChallengeIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('challenge');
  return id && id.trim().length > 0 ? id.trim() : null;
}

function countWords(answers: string[]): number {
  return answers
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export default function App() {
  const [challengeIdFromUrl, setChallengeIdFromUrl] = useState<string | null>(() =>
    readChallengeIdFromUrl()
  );
  const [currentView, setCurrentView] = useState<AppView>(() =>
    readChallengeIdFromUrl() ? 'challenge-friend' : 'home'
  );
  const [navigationSeq, setNavigationSeq] = useState(0);

  // Strict in-memory session state (no browser or unconsented server storage for drafts/answers/results)
  const [soloState, setSoloState] = useState<SoloChallengeSessionState>(() =>
    createInitialSoloState()
  );
  const [textState, setTextState] = useState<TextTestSessionState>(() =>
    createInitialTextTestState()
  );
  const [friendState, setFriendState] = useState<FriendChallengeSessionState>(() =>
    createInitialFriendChallengeState()
  );
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null);
  const [offlineResult, setOfflineResult] = useState<OfflineRoundResult | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => readInitialSoundEnabled());
  const [confirmPrompt, setConfirmPrompt] = useState<ConfirmPromptOptions | null>(null);

  // Async orchestration refs held at App level so switching views preserves in-flight state
  // while starting a new round aborts and invalidates older epochs.
  const soloStateRef = useRef(soloState);
  soloStateRef.current = soloState;

  const textStateRef = useRef(textState);
  textStateRef.current = textState;

  const soloEpochRef = useRef(0);
  const soloFetchCtrlRef = useRef<AbortController | null>(null);
  const soloAnalyzeCtrlRef = useRef<AbortController | null>(null);
  const recentDeckIdsRef = useRef<string[]>([]);

  const textEpochRef = useRef(0);
  const textAnalyzeCtrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      soloFetchCtrlRef.current?.abort();
      soloAnalyzeCtrlRef.current?.abort();
      textAnalyzeCtrlRef.current?.abort();
    };
  }, []);

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next) {
        unlockAudio();
      }
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors in private/restricted environments
      }
      return next;
    });
  };

  useEffect(() => {
    const onPopState = () => {
      const nextId = readChallengeIdFromUrl();
      setChallengeIdFromUrl(nextId);
      if (nextId) {
        setCurrentView('challenge-friend');
        setNavigationSeq((prev) => prev + 1);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openChallengeById = (challengeId: string) => {
    setChallengeIdFromUrl(challengeId);
    setCurrentView('challenge-friend');
    setNavigationSeq((prev) => prev + 1);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('challenge', challengeId);
      window.history.pushState({}, '', url.pathname + url.search);
    }
    scrollToTop();
  };

  const clearChallengeQuery = () => {
    setChallengeIdFromUrl(null);
    if (typeof window !== 'undefined' && window.location.search.includes('challenge=')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('challenge');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  };

  const navigateTo = (view: AppView) => {
    if (view !== 'challenge-friend') {
      clearChallengeQuery();
    }
    setCurrentView(view);
    setNavigationSeq((prev) => prev + 1);
    scrollToTop();
  };

  const abortAllSoloRequestsAndBumpEpoch = (): number => {
    soloFetchCtrlRef.current?.abort();
    soloFetchCtrlRef.current = null;
    soloAnalyzeCtrlRef.current?.abort();
    soloAnalyzeCtrlRef.current = null;
    soloEpochRef.current += 1;
    return soloEpochRef.current;
  };

  const startLiveSoloRoundNow = useCallback((category: string) => {
    const normalized = normalizeSoloCategory(category);
    const epoch = abortAllSoloRequestsAndBumpEpoch();
    const controller = new AbortController();
    soloFetchCtrlRef.current = controller;

    setSoloState((prev) => prepareNewLiveSoloRoundState(prev, normalized, epoch));

    void executeSoloQuestionFetch(
      {
        category: normalized,
        requestEpoch: epoch,
        signal: controller.signal,
      },
      {
        getEpoch: () => soloEpochRef.current,
        setState: setSoloState,
      }
    ).finally(() => {
      if (soloFetchCtrlRef.current === controller) {
        soloFetchCtrlRef.current = null;
      }
    });
  }, []);

  const startOfflineSoloRoundNow = useCallback((category: string) => {
    const normalized = normalizeSoloCategory(category);
    const epoch = abortAllSoloRequestsAndBumpEpoch();
    const { deck, totalDecksInCategory, updatedRecentIds } = pickNextOfflineDeck(
      normalized,
      recentDeckIdsRef.current
    );
    recentDeckIdsRef.current = updatedRecentIds;

    setSoloState((prev) =>
      prepareOfflineSoloRoundState(prev, deck, totalDecksInCategory, epoch)
    );
  }, []);

  const startOrSwitchSoloRound = (
    mode: ChallengePlayMode,
    category?: string,
    opts?: { bypassConfirm?: boolean; actionTitle?: string; actionMessage?: string; confirmLabel?: string }
  ) => {
    const targetCategory = normalizeSoloCategory(
      category ?? soloStateRef.current.selectedCategory
    );
    const runAction = () => {
      clearChallengeQuery();
      setCurrentView('question-challenge');
      setNavigationSeq((prev) => prev + 1);
      scrollToTop();
      if (mode === 'offline') {
        startOfflineSoloRoundNow(targetCategory);
      } else {
        startLiveSoloRoundNow(targetCategory);
      }
    };

    if (!opts?.bypassConfirm && hasUnfinishedSoloAnswers(soloStateRef.current)) {
      setConfirmPrompt({
        title: opts?.actionTitle ?? 'Discard unfinished round?',
        message:
          opts?.actionMessage ??
          'You already typed answers in your current 5-question round. Starting a new round will discard them.',
        confirmLabel: opts?.confirmLabel ?? 'Discard & Start New Round',
        cancelLabel: 'Keep Current Round',
        onConfirm: runAction,
      });
      return;
    }

    runAction();
  };

  const handleEnsureSoloInitialized = useCallback(() => {
    if (soloStateRef.current.initialized) return;
    startLiveSoloRoundNow(soloStateRef.current.selectedCategory);
  }, [startLiveSoloRoundNow]);

  const handleOpenLiveChallengeFromLanding = () => {
    clearChallengeQuery();
    setCurrentView('question-challenge');
    setNavigationSeq((prev) => prev + 1);
    scrollToTop();
    if (!soloStateRef.current.initialized) {
      startLiveSoloRoundNow(soloStateRef.current.selectedCategory);
    }
  };

  const handleOpenOfflineChallengeFromLanding = () => {
    if (
      soloStateRef.current.playMode === 'offline' &&
      hasUnfinishedSoloAnswers(soloStateRef.current)
    ) {
      navigateTo('question-challenge');
      return;
    }
    startOrSwitchSoloRound('offline', soloStateRef.current.selectedCategory, {
      actionTitle: 'Switch to Offline Mode and discard current answers?',
      actionMessage:
        'You have unfinished answers in your current Live AI round. Loading an offline deck will replace them.',
      confirmLabel: 'Discard & Play Offline',
    });
  };

  const handleSoloModeSwitch = (nextMode: ChallengePlayMode) => {
    const current = soloStateRef.current;
    if (current.analyzing) return;

    if (nextMode === 'offline') {
      if (current.playMode === 'offline' && current.questions.length === 5 && !current.roundCompleted) {
        return;
      }
      if (hasUnfinishedSoloAnswers(current)) {
        setConfirmPrompt({
          title: 'Switch to Play Offline?',
          message:
            'Switching to an offline deck will clear the answers you typed in this Live AI round.',
          confirmLabel: 'Discard & Play Offline',
          cancelLabel: 'Keep Current Round',
          onConfirm: () => startOfflineSoloRoundNow(current.selectedCategory),
        });
        return;
      }
      startOfflineSoloRoundNow(current.selectedCategory);
      return;
    }

    // Switching to Live AI
    if (
      current.playMode === 'live' &&
      (current.loadingQuestions || (current.questions.length === 5 && current.loadedCategory === current.selectedCategory))
    ) {
      return;
    }
    if (hasUnfinishedSoloAnswers(current)) {
      setConfirmPrompt({
        title: 'Switch to Live AI?',
        message:
          'Switching to Live AI will clear the answers you typed in this offline deck.',
        confirmLabel: 'Discard & Switch to Live AI',
        cancelLabel: 'Keep Current Round',
        onConfirm: () => startLiveSoloRoundNow(current.selectedCategory),
      });
      return;
    }
    startLiveSoloRoundNow(current.selectedCategory);
  };

  const handleSoloCategoryChange = (nextCategory: string) => {
    const current = soloStateRef.current;
    if (current.analyzing) return;
    const normalized = normalizeSoloCategory(nextCategory);

    if (
      normalized === current.selectedCategory &&
      (current.loadingQuestions || current.questions.length === 5)
    ) {
      return;
    }

    const applyCategoryChange = () => {
      if (soloStateRef.current.playMode === 'offline') {
        startOfflineSoloRoundNow(normalized);
      } else {
        startLiveSoloRoundNow(normalized);
      }
    };

    if (hasUnfinishedSoloAnswers(current)) {
      setConfirmPrompt({
        title: `Switch to ${normalized}?`,
        message: `Changing categories clears your unfinished answers and loads 5 new questions for ${normalized}.`,
        confirmLabel: `Discard & Switch to ${normalized}`,
        cancelLabel: 'Keep Current Round',
        onConfirm: applyCategoryChange,
      });
      return;
    }

    applyCategoryChange();
  };

  const handleRequestNewSoloRound = () => {
    const current = soloStateRef.current;
    if (current.analyzing || current.loadingQuestions) return;

    const executeNewRound = () => {
      if (soloStateRef.current.playMode === 'offline') {
        startOfflineSoloRoundNow(soloStateRef.current.selectedCategory);
      } else {
        startLiveSoloRoundNow(soloStateRef.current.selectedCategory);
      }
    };

    if (hasUnfinishedSoloAnswers(current)) {
      setConfirmPrompt({
        title: 'Start a new 5-question round?',
        message:
          'Starting a new round replaces your current 5 questions and discards your typed answers.',
        confirmLabel: 'Discard & Start New Round',
        cancelLabel: 'Keep Current Round',
        onConfirm: executeNewRound,
      });
      return;
    }

    executeNewRound();
  };

  const handleCancelSoloQuestionFetch = () => {
    const current = soloStateRef.current;
    if (!current.loadingQuestions) return;
    const nextEpoch = abortAllSoloRequestsAndBumpEpoch();
    setSoloState((prev) => ({
      ...prev,
      loadingQuestions: false,
      roundEpoch: nextEpoch,
      questionError: new AppApiError({
        code: 'CANCELLED',
        message: `Live AI question generation for ${prev.selectedCategory} was cancelled.`,
        nextStep: `Click Retry ${prev.selectedCategory} or switch to Play Offline for a curated deck.`,
        retryable: true,
      }),
    }));
  };

  const handleRetrySoloQuestionFetch = () => {
    startLiveSoloRoundNow(soloStateRef.current.selectedCategory);
  };

  const handleClearCurrentSoloAnswer = () => {
    setSoloState((prev) => clearCurrentSoloAnswerInPlace(prev));
  };

  const handleRequestResetSoloAnswers = () => {
    const current = soloStateRef.current;
    const executeReset = () => {
      const nextEpoch = abortAllSoloRequestsAndBumpEpoch();
      setSoloState((prev) => resetSoloRoundAnswersInPlace(prev, nextEpoch));
    };

    if (hasUnfinishedSoloAnswers(current)) {
      setConfirmPrompt({
        title: 'Reset all 5 answers?',
        message:
          'This erases your typed answers and returns to Question 1 while keeping the exact same 5 questions.',
        confirmLabel: 'Reset Answers',
        cancelLabel: 'Keep Current Round',
        onConfirm: executeReset,
      });
      return;
    }

    executeReset();
  };

  const buildOfflineCompletionResult = (
    stateSnapshot: SoloChallengeSessionState,
    deckOverride?: OfflineDeck
  ): OfflineRoundResult => {
    const deck =
      deckOverride ??
      stateSnapshot.activeOfflineDeck ??
      pickNextOfflineDeck(stateSnapshot.loadedCategory, recentDeckIdsRef.current).deck;
    const trimmedAnswers = stateSnapshot.answers.map((a) => a.trim());
    return {
      mode: 'offline',
      category: stateSnapshot.loadedCategory,
      deckId: deck.id,
      deckTitle: deck.title,
      deckNumber: deck.deckNumber,
      totalDecksInCategory: stateSnapshot.totalOfflineDecks,
      questions: stateSnapshot.questions,
      answers: trimmedAnswers,
      selfReviewQuestions: deck.selfReviewQuestions,
      completedAt: Date.now(),
      totalWords: countWords(trimmedAnswers),
      totalCharacters: trimmedAnswers.reduce((sum, item) => sum + item.length, 0),
    };
  };

  const handleSubmitSoloRound = () => {
    const current = soloStateRef.current;
    if (current.loadingQuestions || current.analyzing) return;

    const allAnswered =
      current.questions.length === 5 &&
      current.answers.every((a) => a.trim().length >= 2);

    if (!allAnswered) {
      setSoloState((prev) => ({
        ...prev,
        analysisError: new AppApiError({
          code: 'VALIDATION_ERROR',
          message:
            current.playMode === 'offline'
              ? 'Please answer all 5 questions before viewing your offline summary.'
              : 'Please make sure all 5 questions have at least a short answer before analyzing.',
          nextStep: 'Check any unanswered step in the progress bar above.',
          retryable: false,
        }),
      }));
      return;
    }

    if (current.playMode === 'offline') {
      const offlinePayload = buildOfflineCompletionResult(current);
      setSoloState((prev) => ({
        ...prev,
        analysisError: null,
        roundCompleted: true,
      }));
      setOfflineResult(offlinePayload);
      setCurrentView('offline-results');
      setNavigationSeq((prev) => prev + 1);
      scrollToTop();
      return;
    }

    soloAnalyzeCtrlRef.current?.abort();
    const controller = new AbortController();
    soloAnalyzeCtrlRef.current = controller;
    const reqEpoch = current.roundEpoch;

    setSoloState((prev) => ({
      ...prev,
      analyzing: true,
      analysisError: null,
    }));

    void executeSoloChallengeAnalysis(
      {
        category: current.loadedCategory,
        questions: current.questions,
        answers: current.answers,
        requestEpoch: reqEpoch,
        signal: controller.signal,
        onValidatedResult: (validated) => {
          setLastResult(validated);
          setCurrentView('results');
          setNavigationSeq((prev) => prev + 1);
          scrollToTop();
        },
      },
      {
        getEpoch: () => soloEpochRef.current,
        setState: setSoloState,
      }
    ).finally(() => {
      if (soloAnalyzeCtrlRef.current === controller) {
        soloAnalyzeCtrlRef.current = null;
      }
    });
  };

  const handleCancelSoloAnalysis = () => {
    const current = soloStateRef.current;
    if (!current.analyzing) return;
    soloAnalyzeCtrlRef.current?.abort();
    soloAnalyzeCtrlRef.current = null;
    soloEpochRef.current += 1;
    setSoloState((prev) => ({
      ...prev,
      analyzing: false,
      roundEpoch: soloEpochRef.current,
      analysisError: new AppApiError({
        code: 'CANCELLED',
        message: 'Answer analysis was cancelled.',
        nextStep:
          'All 5 of your answers were kept. Edit any response, click Retry Live AI Analysis, or view an Offline Summary.',
        retryable: true,
      }),
    }));
  };

  const handleViewOfflineSummaryFromError = () => {
    const current = soloStateRef.current;
    const allAnswered =
      current.questions.length === 5 &&
      current.answers.every((a) => a.trim().length >= 2);
    if (!allAnswered) return;

    const fallbackDeck = pickNextOfflineDeck(current.loadedCategory, []).deck;
    const offlinePayload = buildOfflineCompletionResult(current, fallbackDeck);
    setSoloState((prev) => ({
      ...prev,
      roundCompleted: true,
      analysisError: null,
    }));
    setOfflineResult(offlinePayload);
    setCurrentView('offline-results');
    setNavigationSeq((prev) => prev + 1);
    scrollToTop();
  };

  // --- Text Test Session Actions ---
  const handleTextChange = (nextText: string) => {
    setTextState((prev) => ({
      ...prev,
      text: nextText,
      error: prev.error ? null : null,
    }));
  };

  const handleClearTextDraft = () => {
    textAnalyzeCtrlRef.current?.abort();
    textAnalyzeCtrlRef.current = null;
    textEpochRef.current += 1;
    setTextState({
      text: '',
      loading: false,
      error: null,
      requestEpoch: textEpochRef.current,
    });
  };

  const handleCancelTextAnalyze = () => {
    if (!textStateRef.current.loading) return;
    textAnalyzeCtrlRef.current?.abort();
    textAnalyzeCtrlRef.current = null;
    textEpochRef.current += 1;
    setTextState((prev) => ({
      ...prev,
      loading: false,
      requestEpoch: textEpochRef.current,
      error: new AppApiError({
        code: 'CANCELLED',
        message: 'Statement analysis was cancelled.',
        nextStep: 'Your statement was kept below. Edit it or click Retry Analysis when ready.',
        retryable: true,
      }),
    }));
  };

  const handleRunTextAnalyze = async () => {
    const current = textStateRef.current;
    if (current.loading) return;

    const trimmed = current.text.trim();
    const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;

    if (trimmed.length === 0) {
      setTextState((prev) => ({
        ...prev,
        error: new AppApiError({
          code: 'VALIDATION_ERROR',
          message: 'Your statement box is empty. Write a sentence or story before analyzing.',
          nextStep: 'Enter at least 15 characters (about 4–5 words) and click Analyze Statement.',
          retryable: false,
        }),
      }));
      return;
    }

    if (trimmed.length < 15 || wordCount < 4 || trimmed.length > 3000) {
      setTextState((prev) => ({
        ...prev,
        error: new AppApiError({
          code: 'VALIDATION_ERROR',
          message:
            'Please enter between 15 and 3000 characters (at least 4 words) so there is enough context to analyze.',
          nextStep: 'Add a full thought or supporting detail above, then click Analyze Statement.',
          retryable: false,
        }),
      }));
      return;
    }

    textAnalyzeCtrlRef.current?.abort();
    const controller = new AbortController();
    textAnalyzeCtrlRef.current = controller;
    const reqEpoch = ++textEpochRef.current;

    setTextState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      requestEpoch: reqEpoch,
    }));

    try {
      const data = await requestJson<unknown>('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: current.text }),
        timeoutMs: 30000,
        signal: controller.signal,
      });

      if (isStaleRoundEpoch(textEpochRef.current, reqEpoch) || controller.signal.aborted) {
        return;
      }

      const validated = assertValidAnalysisResult(data, 'text');
      setTextState((prev) => ({
        ...prev,
        loading: false,
        error: null,
      }));
      setLastResult(validated);
      setCurrentView('results');
      setNavigationSeq((prev) => prev + 1);
      scrollToTop();
    } catch (err: unknown) {
      if (isStaleRoundEpoch(textEpochRef.current, reqEpoch)) return;
      const mapped = toAppApiError(err, 'Something went wrong while analyzing your statement.');
      setTextState((prev) => ({
        ...prev,
        loading: false,
        error: mapped,
      }));
    } finally {
      if (textAnalyzeCtrlRef.current === controller) {
        textAnalyzeCtrlRef.current = null;
      }
    }
  };

  const handleViewDemoResults = () => {
    clearChallengeQuery();
    setLastResult(DEMO_ILLUSTRATIVE_RESULT);
    setCurrentView('results');
    setNavigationSeq((prev) => prev + 1);
    scrollToTop();
  };

  const handleNextRoundFromResults = () => {
    if (lastResult?.mode === 'text' && !lastResult.isDemo) {
      navigateTo('text-test');
      return;
    }
    startOrSwitchSoloRound('live', lastResult?.theme ?? soloStateRef.current.selectedCategory, {
      actionTitle: 'Discard unfinished round?',
      actionMessage:
        'You have unfinished answers in an active 5-question round. Starting a new round will discard them.',
      confirmLabel: 'Discard & Start New Round',
    });
  };

  const hasUnfinishedSolo = hasUnfinishedSoloAnswers(soloState);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#050814] text-slate-100">
      {/* Subtle Futuristic Navy & Electric Glow Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.22)_0%,rgba(34,211,238,0.1)_42%,transparent_72%)] blur-3xl" />
        <div className="absolute right-0 bottom-0 h-[360px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.15)_0%,transparent_70%)] blur-3xl" />
      </div>

      <Navbar
        currentView={currentView}
        onNavigate={navigateTo}
        onOpenQuestionChallenge={handleOpenLiveChallengeFromLanding}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />

      <main className="flex-1">
        {currentView === 'home' && (
          <HomePage
            navigationSeq={navigationSeq}
            hasUnfinishedSoloRound={hasUnfinishedSolo}
            onNavigate={navigateTo}
            onStartLiveChallenge={handleOpenLiveChallengeFromLanding}
            onStartOffline={handleOpenOfflineChallengeFromLanding}
            onViewDemo={handleViewDemoResults}
          />
        )}

        {currentView === 'text-test' && (
          <TextTestPage
            navigationSeq={navigationSeq}
            state={textState}
            onTextChange={handleTextChange}
            onAnalyze={() => void handleRunTextAnalyze()}
            onCancel={handleCancelTextAnalyze}
            onClear={handleClearTextDraft}
            onOpenFriendChallenge={() => navigateTo('challenge-friend')}
          />
        )}

        {currentView === 'question-challenge' && (
          <QuestionChallengePage
            navigationSeq={navigationSeq}
            state={soloState}
            onEnsureInitialized={handleEnsureSoloInitialized}
            onAnswerChange={(idx, value) => {
              setSoloState((prev) => {
                const updated = [...prev.answers];
                updated[idx] = value;
                return {
                  ...prev,
                  answers: updated,
                  analysisError: null,
                  roundCompleted: false,
                };
              });
            }}
            onSelectQuestionIndex={(idx) => {
              setSoloState((prev) => ({
                ...prev,
                currentIndex: Math.max(0, Math.min(4, idx)),
                analysisError: null,
              }));
            }}
            onRequestNewRound={handleRequestNewSoloRound}
            onRequestModeSwitch={handleSoloModeSwitch}
            onRequestCategoryChange={handleSoloCategoryChange}
            onRetryQuestionFetch={handleRetrySoloQuestionFetch}
            onCancelQuestionFetch={handleCancelSoloQuestionFetch}
            onSubmitRound={handleSubmitSoloRound}
            onCancelAnalysis={handleCancelSoloAnalysis}
            onSetValidationError={(message, nextStep) => {
              setSoloState((prev) => ({
                ...prev,
                analysisError: new AppApiError({
                  code: 'VALIDATION_ERROR',
                  message,
                  nextStep,
                  retryable: false,
                }),
              }));
            }}
            onViewOfflineSummaryFromError={handleViewOfflineSummaryFromError}
            onClearCurrentAnswer={handleClearCurrentSoloAnswer}
            onRequestResetAnswers={handleRequestResetSoloAnswers}
          />
        )}

        {currentView === 'results' && isValidAnalysisResult(lastResult) && (
          <ResultsPage
            navigationSeq={navigationSeq}
            result={lastResult}
            onStartNextRound={handleNextRoundFromResults}
            onChallengeFriend={() => navigateTo('challenge-friend')}
          />
        )}

        {currentView === 'results' && !isValidAnalysisResult(lastResult) && (
          <HomePage
            navigationSeq={navigationSeq}
            hasUnfinishedSoloRound={hasUnfinishedSolo}
            onNavigate={navigateTo}
            onStartLiveChallenge={handleOpenLiveChallengeFromLanding}
            onStartOffline={handleOpenOfflineChallengeFromLanding}
            onViewDemo={handleViewDemoResults}
          />
        )}

        {currentView === 'offline-results' && offlineResult && (
          <OfflineResultsPage
            navigationSeq={navigationSeq}
            result={offlineResult}
            onPlayAgainOffline={(cat) =>
              startOrSwitchSoloRound('offline', cat, { bypassConfirm: !hasUnfinishedSolo })
            }
            onTryLiveAi={(cat) =>
              startOrSwitchSoloRound('live', cat, { bypassConfirm: !hasUnfinishedSolo })
            }
            onChallengeFriend={() => navigateTo('challenge-friend')}
            onViewDemoResults={handleViewDemoResults}
          />
        )}

        {currentView === 'offline-results' && !offlineResult && (
          <HomePage
            navigationSeq={navigationSeq}
            hasUnfinishedSoloRound={hasUnfinishedSolo}
            onNavigate={navigateTo}
            onStartLiveChallenge={handleOpenLiveChallengeFromLanding}
            onStartOffline={handleOpenOfflineChallengeFromLanding}
            onViewDemo={handleViewDemoResults}
          />
        )}

        {currentView === 'challenge-friend' && (
          <ChallengeFriendPage
            navigationSeq={navigationSeq}
            initialChallengeId={challengeIdFromUrl}
            state={friendState}
            setState={setFriendState}
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
            onOpenChallengeId={openChallengeById}
            onClearChallengeParam={clearChallengeQuery}
            onGoHome={() => navigateTo('home')}
            onRequestConfirm={(opts) => setConfirmPrompt(opts)}
          />
        )}
      </main>

      <ConfirmDialog
        open={Boolean(confirmPrompt)}
        title={confirmPrompt?.title ?? ''}
        message={confirmPrompt?.message ?? ''}
        confirmLabel={confirmPrompt?.confirmLabel ?? 'Continue'}
        cancelLabel={confirmPrompt?.cancelLabel}
        onCancel={() => setConfirmPrompt(null)}
        onConfirm={() => {
          const action = confirmPrompt?.onConfirm;
          setConfirmPrompt(null);
          action?.();
        }}
      />

      <footer className="border-t border-white/10 bg-[#050814]/90 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:px-6">
          <p>
            TruthCheck AI · Entertainment-based consistency explorer. Not a scientifically
            validated lie detector.
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => navigateTo('text-test')}
              className="hover:text-slate-200"
            >
              Text Test
            </button>
            <button
              type="button"
              onClick={handleOpenLiveChallengeFromLanding}
              className="hover:text-slate-200"
            >
              5-Question Challenge
            </button>
            <button
              type="button"
              onClick={handleOpenOfflineChallengeFromLanding}
              className="hover:text-slate-200"
            >
              Play 5-Question Offline
            </button>
            <button
              type="button"
              onClick={() => navigateTo('challenge-friend')}
              className="hover:text-slate-200"
            >
              Challenge a Friend
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
