import type {
  AnalysisIndicator,
  AnalysisResult,
  ChallengeQuestion,
  InconsistencyHighlight,
} from '../types';
import {
  VALID_HIGHLIGHT_CLASSIFICATIONS,
  type HighlightClassification,
} from './scoring';
import { AppApiError } from './api';

function isValidIndicator(value: unknown): value is AnalysisIndicator {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.title === 'string' &&
    obj.title.trim().length > 0 &&
    typeof obj.score === 'number' &&
    Number.isFinite(obj.score) &&
    obj.score >= 0 &&
    obj.score <= 100 &&
    typeof obj.summary === 'string' &&
    obj.summary.trim().length > 0
  );
}

function isValidHighlight(value: unknown): value is InconsistencyHighlight {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  const validClassification =
    typeof obj.classification === 'string' &&
    VALID_HIGHLIGHT_CLASSIFICATIONS.includes(obj.classification as HighlightClassification);

  return (
    validClassification &&
    Array.isArray(obj.quotes) &&
    obj.quotes.every((q) => typeof q === 'string') &&
    typeof obj.excerpt === 'string' &&
    obj.excerpt.trim().length > 0 &&
    typeof obj.note === 'string' &&
    obj.note.trim().length > 0
  );
}

export function isValidAnalysisResult(
  data: unknown,
  expectedMode?: 'text' | 'challenge'
): data is AnalysisResult {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  const modeValid = expectedMode
    ? obj.mode === expectedMode
    : obj.mode === 'text' || obj.mode === 'challenge';
  if (!modeValid) return false;

  if (obj.evidenceStatus !== 'sufficient' && obj.evidenceStatus !== 'insufficient') {
    return false;
  }

  if (typeof obj.scoreLabel !== 'string' || obj.scoreLabel.trim().length === 0) {
    return false;
  }

  if (
    typeof obj.plainLanguageSummary !== 'string' ||
    obj.plainLanguageSummary.trim().length < 5
  ) {
    return false;
  }

  if (!Array.isArray(obj.observations) || !Array.isArray(obj.highlights)) {
    return false;
  }

  if (!obj.highlights.every(isValidHighlight)) {
    return false;
  }

  if (obj.evidenceStatus === 'insufficient') {
    if (obj.consistencyScore !== null) return false;
    if (obj.indicators !== null && obj.indicators !== undefined) return false;
    return true;
  }

  // Sufficient evidence requires valid overall score + 3 valid indicators
  if (
    typeof obj.consistencyScore !== 'number' ||
    !Number.isFinite(obj.consistencyScore) ||
    obj.consistencyScore < 0 ||
    obj.consistencyScore > 100
  ) {
    return false;
  }

  if (!Array.isArray(obj.indicators) || obj.indicators.length !== 3) {
    return false;
  }

  if (!obj.indicators.every(isValidIndicator)) {
    return false;
  }

  return true;
}

export function assertValidAnalysisResult(
  data: unknown,
  expectedMode?: 'text' | 'challenge'
): AnalysisResult {
  if (!isValidAnalysisResult(data, expectedMode)) {
    throw new AppApiError({
      code: 'MALFORMED_RESPONSE',
      message: 'The AI returned an incomplete analysis response.',
      nextStep: 'Click Retry to run the analysis again.',
      retryable: true,
    });
  }
  return data;
}

export function assertValidGeneratedQuestions(
  data: unknown,
  expectedCount: number
): ChallengeQuestion[] {
  if (!data || typeof data !== 'object') {
    throw new AppApiError({
      code: 'MALFORMED_RESPONSE',
      message: 'The AI returned an invalid question payload.',
      nextStep: 'Click Retry to generate a fresh round of questions.',
      retryable: true,
    });
  }

  const rawQuestions = (data as { questions?: unknown }).questions;
  if (!Array.isArray(rawQuestions)) {
    throw new AppApiError({
      code: 'MALFORMED_RESPONSE',
      message: 'No question list was returned by the server.',
      nextStep: 'Click Retry to generate questions again.',
      retryable: true,
    });
  }

  const valid = rawQuestions.filter((item): item is ChallengeQuestion => {
    if (!item || typeof item !== 'object') return false;
    const q = item as Record<string, unknown>;
    return (
      typeof q.id === 'string' &&
      q.id.trim().length > 0 &&
      typeof q.prompt === 'string' &&
      q.prompt.trim().length >= 5 &&
      typeof q.hint === 'string'
    );
  });

  if (valid.length < expectedCount) {
    throw new AppApiError({
      code: 'MALFORMED_RESPONSE',
      message: `Expected ${expectedCount} playable questions, but received ${valid.length}.`,
      nextStep: 'Click Retry to generate a complete set of questions.',
      retryable: true,
    });
  }

  return valid.slice(0, expectedCount);
}
