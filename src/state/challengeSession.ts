import type {
  AnalysisResult,
  ChallengeQuestion,
  FriendChallengeCompletedResult,
  FriendChallengePublic,
} from '../types';
import { AppApiError, requestJson, toAppApiError } from '../utils/api';
import {
  assertValidAnalysisResult,
  assertValidGeneratedQuestions,
} from '../utils/validators';
import {
  DEFAULT_20_QUESTIONS,
  type OfflineDeck,
  SOLO_CATEGORIES,
} from '../data/offlineDecks';

export type ChallengePlayMode = 'live' | 'offline';

export interface SoloChallengeSessionState {
  initialized: boolean;
  playMode: ChallengePlayMode;
  selectedCategory: string;
  loadedCategory: string;
  questions: ChallengeQuestion[];
  activeOfflineDeck: OfflineDeck | null;
  totalOfflineDecks: number;
  answers: string[];
  currentIndex: number;
  loadingQuestions: boolean;
  analyzing: boolean;
  questionError: AppApiError | null;
  analysisError: AppApiError | null;
  roundEpoch: number;
  roundCompleted: boolean;
}

export interface TextTestSessionState {
  text: string;
  loading: boolean;
  error: AppApiError | null;
  requestEpoch: number;
}

export interface FriendChallengeSessionState {
  friendAName: string;
  theme: string;
  questions: ChallengeQuestion[];
  newQuestionText: string;
  builderConsent: boolean;
  generatingAi: boolean;
  creatingLink: boolean;
  createdChallengeId: string | null;
  builderError: string | null;
  aiError: AppApiError | null;
  aiEpoch: number;
  // Friend B remote/answering state
  loadedChallengeId: string | null;
  loadingChallenge: boolean;
  remoteChallenge: FriendChallengePublic | null;
  remoteError: string | null;
  friendBView: 'intro' | 'answering' | 'reveal' | 'dashboard';
  friendBName: string;
  friendBConsent: boolean;
  friendBAnswers: string[];
  currentAnswerIndex: number;
  submittingAnswers: boolean;
  answerError: string | null;
  completedResult: FriendChallengeCompletedResult | null;
  revealIndex: number;
  verdictFilter: 'ALL' | 'TRUE' | 'LIE';
}

export function normalizeSoloCategory(category?: string): string {
  if (category && (SOLO_CATEGORIES as readonly string[]).includes(category)) {
    return category;
  }
  return SOLO_CATEGORIES[0];
}

export function createInitialSoloState(): SoloChallengeSessionState {
  return {
    initialized: false,
    playMode: 'live',
    selectedCategory: SOLO_CATEGORIES[0],
    loadedCategory: SOLO_CATEGORIES[0],
    questions: [],
    activeOfflineDeck: null,
    totalOfflineDecks: 4,
    answers: ['', '', '', '', ''],
    currentIndex: 0,
    loadingQuestions: false,
    analyzing: false,
    questionError: null,
    analysisError: null,
    roundEpoch: 0,
    roundCompleted: false,
  };
}

export function createInitialTextTestState(): TextTestSessionState {
  return {
    text: '',
    loading: false,
    error: null,
    requestEpoch: 0,
  };
}

export function createInitialFriendChallengeState(): FriendChallengeSessionState {
  return {
    friendAName: '',
    theme: 'Party Mix',
    questions: DEFAULT_20_QUESTIONS.map((q) => ({ ...q })),
    newQuestionText: '',
    builderConsent: false,
    generatingAi: false,
    creatingLink: false,
    createdChallengeId: null,
    builderError: null,
    aiError: null,
    aiEpoch: 0,
    loadedChallengeId: null,
    loadingChallenge: false,
    remoteChallenge: null,
    remoteError: null,
    friendBView: 'intro',
    friendBName: '',
    friendBConsent: false,
    friendBAnswers: [],
    currentAnswerIndex: 0,
    submittingAnswers: false,
    answerError: null,
    completedResult: null,
    revealIndex: 0,
    verdictFilter: 'ALL',
  };
}

export function hasUnfinishedSoloAnswers(state: SoloChallengeSessionState): boolean {
  return (
    state.questions.length > 0 &&
    !state.roundCompleted &&
    state.answers.some((a) => a.trim().length > 0)
  );
}

export function hasUnfinishedFriendBuilderEdits(
  state: FriendChallengeSessionState
): boolean {
  if (state.createdChallengeId) return false;
  if (state.friendAName.trim().length > 0 || state.newQuestionText.trim().length > 0) {
    return true;
  }
  if (state.questions.length !== DEFAULT_20_QUESTIONS.length) {
    return true;
  }
  return state.questions.some(
    (q, idx) => q.prompt.trim() !== DEFAULT_20_QUESTIONS[idx]?.prompt.trim()
  );
}

export function hasUnfinishedFriendBAnswers(
  state: FriendChallengeSessionState
): boolean {
  return (
    state.friendBView === 'answering' &&
    !state.completedResult &&
    state.friendBAnswers.some((a) => a.trim().length > 0)
  );
}

export function countSoloAnswered(state: SoloChallengeSessionState): number {
  return state.questions.filter(
    (_, idx) => (state.answers[idx] || '').trim().length >= 2
  ).length;
}

export function isStaleRoundEpoch(
  currentEpoch: number,
  requestEpoch: number
): boolean {
  return currentEpoch !== requestEpoch;
}

export function clearCurrentSoloAnswerInPlace(
  state: SoloChallengeSessionState
): SoloChallengeSessionState {
  const nextAnswers = [...state.answers];
  nextAnswers[state.currentIndex] = '';
  return {
    ...state,
    answers: nextAnswers,
    analysisError: null,
    roundCompleted: false,
  };
}

export function resetSoloRoundAnswersInPlace(
  state: SoloChallengeSessionState,
  nextEpoch: number
): SoloChallengeSessionState {
  return {
    ...state,
    answers: new Array(Math.max(5, state.questions.length)).fill(''),
    currentIndex: 0,
    analyzing: false,
    analysisError: null,
    roundCompleted: false,
    roundEpoch: nextEpoch,
  };
}

export function prepareNewLiveSoloRoundState(
  state: SoloChallengeSessionState,
  nextCategory: string,
  nextEpoch: number
): SoloChallengeSessionState {
  const normalized = normalizeSoloCategory(nextCategory);
  return {
    ...state,
    initialized: true,
    playMode: 'live',
    selectedCategory: normalized,
    loadedCategory: normalized,
    questions: [],
    activeOfflineDeck: null,
    answers: ['', '', '', '', ''],
    currentIndex: 0,
    loadingQuestions: true,
    analyzing: false,
    questionError: null,
    analysisError: null,
    roundEpoch: nextEpoch,
    roundCompleted: false,
  };
}

export function prepareOfflineSoloRoundState(
  state: SoloChallengeSessionState,
  deck: OfflineDeck,
  totalDecksInCategory: number,
  nextEpoch: number
): SoloChallengeSessionState {
  return {
    ...state,
    initialized: true,
    playMode: 'offline',
    selectedCategory: deck.category,
    loadedCategory: deck.category,
    questions: deck.questions,
    activeOfflineDeck: deck,
    totalOfflineDecks: totalDecksInCategory,
    answers: ['', '', '', '', ''],
    currentIndex: 0,
    loadingQuestions: false,
    analyzing: false,
    questionError: null,
    analysisError: null,
    roundEpoch: nextEpoch,
    roundCompleted: false,
  };
}

export interface EpochStore<T> {
  getEpoch: () => number;
  setState: (updater: (prev: T) => T) => void;
}

export async function executeSoloQuestionFetch(
  params: {
    category: string;
    requestEpoch: number;
    signal: AbortSignal;
    fetcher?: (category: string, signal: AbortSignal) => Promise<ChallengeQuestion[]>;
  },
  store: EpochStore<SoloChallengeSessionState>
): Promise<boolean> {
  const { category, requestEpoch, signal, fetcher } = params;
  try {
    const validatedQuestions = fetcher
      ? await fetcher(category, signal)
      : assertValidGeneratedQuestions(
          await requestJson<unknown>('/api/generate-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme: category, count: 5 }),
            timeoutMs: 30000,
            signal,
          }),
          5
        );

    if (isStaleRoundEpoch(store.getEpoch(), requestEpoch) || signal.aborted) {
      return false;
    }

    store.setState((prev) => {
      if (isStaleRoundEpoch(prev.roundEpoch, requestEpoch)) return prev;
      return {
        ...prev,
        playMode: 'live',
        selectedCategory: category,
        loadedCategory: category,
        questions: validatedQuestions,
        activeOfflineDeck: null,
        answers: ['', '', '', '', ''],
        currentIndex: 0,
        loadingQuestions: false,
        questionError: null,
        analysisError: null,
        roundCompleted: false,
      };
    });
    return true;
  } catch (err: unknown) {
    if (isStaleRoundEpoch(store.getEpoch(), requestEpoch)) {
      return false;
    }
    const appErr = toAppApiError(
      err,
      'Unable to load AI questions. You can retry or play an offline deck.'
    );
    store.setState((prev) => {
      if (isStaleRoundEpoch(prev.roundEpoch, requestEpoch)) return prev;
      return {
        ...prev,
        loadingQuestions: false,
        questionError: appErr,
      };
    });
    return false;
  }
}

export async function executeSoloChallengeAnalysis(
  params: {
    category: string;
    questions: ChallengeQuestion[];
    answers: string[];
    requestEpoch: number;
    signal: AbortSignal;
    analyzer?: (
      payload: { theme: string; questions: string[]; answers: string[] },
      signal: AbortSignal
    ) => Promise<AnalysisResult>;
    onValidatedResult: (result: AnalysisResult) => void;
  },
  store: EpochStore<SoloChallengeSessionState>
): Promise<boolean> {
  const {
    category,
    questions,
    answers,
    requestEpoch,
    signal,
    analyzer,
    onValidatedResult,
  } = params;

  try {
    const validated = analyzer
      ? await analyzer(
          {
            theme: category,
            questions: questions.map((q) => q.prompt),
            answers,
          },
          signal
        )
      : assertValidAnalysisResult(
          await requestJson<unknown>('/api/analyze-challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              theme: category,
              questions: questions.map((q) => q.prompt),
              answers,
            }),
            timeoutMs: 30000,
            signal,
          }),
          'challenge'
        );

    if (isStaleRoundEpoch(store.getEpoch(), requestEpoch) || signal.aborted) {
      return false;
    }

    const enrichedResult: AnalysisResult = {
      ...validated,
      questions,
      answers,
      theme: category,
    };

    store.setState((prev) => {
      if (isStaleRoundEpoch(prev.roundEpoch, requestEpoch)) return prev;
      return {
        ...prev,
        analyzing: false,
        analysisError: null,
        roundCompleted: true,
      };
    });

    onValidatedResult(enrichedResult);
    return true;
  } catch (err: unknown) {
    if (isStaleRoundEpoch(store.getEpoch(), requestEpoch)) {
      return false;
    }
    const appErr = toAppApiError(
      err,
      'Analysis failed. Your 5 answers were preserved—please retry.'
    );
    store.setState((prev) => {
      if (isStaleRoundEpoch(prev.roundEpoch, requestEpoch)) return prev;
      return {
        ...prev,
        analyzing: false,
        analysisError: appErr,
      };
    });
    return false;
  }
}
