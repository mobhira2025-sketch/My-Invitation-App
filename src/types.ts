import type { HighlightClassification, ScoreBreakdown } from './utils/scoring';

export type AppView =
  | 'home'
  | 'text-test'
  | 'question-challenge'
  | 'results'
  | 'offline-results'
  | 'challenge-friend';

export interface AnalysisIndicator {
  title: string;
  score: number;
  summary: string;
}

export interface InconsistencyHighlight {
  classification: HighlightClassification;
  quotes: string[];
  excerpt: string;
  note: string;
}

export interface AnalysisResult {
  mode: 'text' | 'challenge';
  isDemo?: boolean;
  evidenceStatus: 'sufficient' | 'insufficient';
  insufficientEvidenceReason?: string;
  consistencyScore: number | null;
  scoreLabel: string;
  indicators: [AnalysisIndicator, AnalysisIndicator, AnalysisIndicator] | null;
  scoreBreakdown?: ScoreBreakdown;
  plainLanguageSummary: string;
  observations: string[];
  highlights: InconsistencyHighlight[];
  uncertaintyCues?: string[];
  questions?: ChallengeQuestion[];
  answers?: string[];
  theme?: string;
}

export interface OfflineRoundResult {
  mode: 'offline';
  category: string;
  deckId: string;
  deckTitle: string;
  deckNumber: number;
  totalDecksInCategory: number;
  questions: ChallengeQuestion[];
  answers: string[];
  selfReviewQuestions: string[];
  completedAt: number;
  totalWords: number;
  totalCharacters: number;
}

export interface ChallengeQuestion {
  id: string;
  prompt: string;
  hint: string;
}

export type RandomOutcome = 'TRUE' | 'LIE';

export interface FriendVerdictItem {
  questionId: string;
  question: string;
  answer: string;
  outcome: RandomOutcome;
  verdictLabel: 'TRUE – NOT LYING' | 'LIE – CAUGHT!';
}

export interface FriendChallengeCompletedResult {
  challengeId: string;
  friendAName: string;
  friendBName: string;
  theme: string;
  submittedAt: number;
  totalQuestions: number;
  totalTrue: number;
  totalLie: number;
  overallSummary: string;
  items: FriendVerdictItem[];
}

export interface FriendChallengePublic {
  challengeId: string;
  friendAName: string;
  theme: string;
  status: 'open' | 'completed';
  questions: ChallengeQuestion[];
  createdAt: number;
  expiresAt: number;
  result?: FriendChallengeCompletedResult;
}

export type AiErrorCode =
  | 'QUOTA_EXHAUSTED'
  | 'RATE_LIMITED'
  | 'AUTH_ERROR'
  | 'MALFORMED_RESPONSE'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'CANCELLED'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR';

export interface StructuredApiErrorPayload {
  error: string;
  code?: AiErrorCode;
  nextStep?: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
}
