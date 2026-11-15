export type HighlightClassification =
  | 'direct_contradiction'
  | 'explicit_exception'
  | 'different_time_periods'
  | 'changed_circumstances'
  | 'insufficient_context'
  | 'aligned_support';

export interface ClassificationMeta {
  label: string;
  shortDesc: string;
  badgeClass: string;
  borderClass: string;
  isTrueContradiction: boolean;
}

export const HIGHLIGHT_CLASSIFICATION_META: Record<HighlightClassification, ClassificationMeta> = {
  direct_contradiction: {
    label: 'Direct Contradiction',
    shortDesc: 'Two incompatible claims apply at the same time with no explanation bridging them.',
    badgeClass: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
    borderClass: 'border-rose-400/35',
    isTrueContradiction: true,
  },
  explicit_exception: {
    label: 'Explicit Exception',
    shortDesc: 'A general preference paired with a clear boundary or exception—logically coherent.',
    badgeClass: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
    borderClass: 'border-cyan-400/30',
    isTrueContradiction: false,
  },
  different_time_periods: {
    label: 'Different Time Periods',
    shortDesc: 'Past attitude or habit contrasted with a newer view—a timeline shift, not a contradiction.',
    badgeClass: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-200',
    borderClass: 'border-indigo-400/30',
    isTrueContradiction: false,
  },
  changed_circumstances: {
    label: 'Changed Circumstances',
    shortDesc: 'A different choice explained by new external conditions or priorities.',
    badgeClass: 'border-teal-400/40 bg-teal-500/15 text-teal-200',
    borderClass: 'border-teal-400/30',
    isTrueContradiction: false,
  },
  insufficient_context: {
    label: 'Insufficient Context',
    shortDesc: 'More detail is needed to tell whether these points conflict or fit together.',
    badgeClass: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
    borderClass: 'border-amber-400/30',
    isTrueContradiction: false,
  },
  aligned_support: {
    label: 'Consistent Support',
    shortDesc: 'Details and reasoning actively reinforce each other.',
    badgeClass: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
    borderClass: 'border-emerald-400/30',
    isTrueContradiction: false,
  },
};

export const VALID_HIGHLIGHT_CLASSIFICATIONS: HighlightClassification[] = [
  'direct_contradiction',
  'explicit_exception',
  'different_time_periods',
  'changed_circumstances',
  'insufficient_context',
  'aligned_support',
];

export const SCORING_WEIGHTS = {
  consistency: 0.6,
  clarity: 0.25,
  directness: 0.15,
} as const;

export interface ScoreBreakdown {
  weights: {
    consistency: number;
    clarity: number;
    directness: number;
  };
  raw: {
    consistency: number;
    clarity: number;
    directness: number;
    hedgingLevel: number;
  };
  weighted: {
    consistency: number;
    clarity: number;
    directness: number;
  };
  formulaText: string;
  exactWeightedSum: number;
  overallScore: number;
}

export function clampComponentScore(value: unknown, fallback = 50): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

/**
 * Deterministic, documented weighted formula for the Entertainment Consistency Score:
 *   Overall = round(0.60 * NarrativeConsistency + 0.25 * Clarity + 0.15 * PhrasingDirectness)
 *
 * Hedging / Uncertainty Cue Level is reported cleanly as (100 - PhrasingDirectness)
 * and reflects cautious phrasing style only—never dishonesty.
 */
export function calculateConsistencyScore(input: {
  consistency: number;
  clarity: number;
  directness: number;
}): ScoreBreakdown {
  const consistency = clampComponentScore(input.consistency);
  const clarity = clampComponentScore(input.clarity);
  const directness = clampComponentScore(input.directness);
  const hedgingLevel = 100 - directness;

  const wConsistency = Number((consistency * SCORING_WEIGHTS.consistency).toFixed(2));
  const wClarity = Number((clarity * SCORING_WEIGHTS.clarity).toFixed(2));
  const wDirectness = Number((directness * SCORING_WEIGHTS.directness).toFixed(2));
  const exactWeightedSum = Number((wConsistency + wClarity + wDirectness).toFixed(2));
  const overallScore = Math.max(0, Math.min(100, Math.round(exactWeightedSum)));

  return {
    weights: {
      consistency: SCORING_WEIGHTS.consistency,
      clarity: SCORING_WEIGHTS.clarity,
      directness: SCORING_WEIGHTS.directness,
    },
    raw: {
      consistency,
      clarity,
      directness,
      hedgingLevel,
    },
    weighted: {
      consistency: wConsistency,
      clarity: wClarity,
      directness: wDirectness,
    },
    formulaText: `60% × ${consistency} + 25% × ${clarity} + 15% × ${directness} = ${exactWeightedSum.toFixed(1)} → ${overallScore}/100`,
    exactWeightedSum,
    overallScore,
  };
}

export function getNeutralWordTokens(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((token) => token.length > 0);
}

/**
 * Verifies candidate quotes from AI output against the actual user submission.
 * Preserves exact verbatim character casing/punctuation from sourceTexts whenever found.
 */
export function groundVerbatimQuotes(
  candidateQuotes: unknown,
  sourceTexts: string[],
  maxQuotes = 3
): string[] {
  if (!Array.isArray(candidateQuotes)) return [];
  const cleanSources = sourceTexts.filter((s) => typeof s === 'string' && s.trim().length > 0);
  if (cleanSources.length === 0) return [];

  const seen = new Set<string>();
  const grounded: string[] = [];

  for (const item of candidateQuotes) {
    if (typeof item !== 'string') continue;
    const stripped = item.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
    if (stripped.length < 3) continue;

    let matchedSlice: string | null = null;

    // 1. Exact substring match in any source text
    for (const src of cleanSources) {
      const idx = src.indexOf(stripped);
      if (idx !== -1) {
        matchedSlice = src.slice(idx, idx + stripped.length);
        break;
      }
    }

    // 2. Case-insensitive substring match preserving user's exact casing
    if (!matchedSlice) {
      const lowerNeedle = stripped.toLowerCase();
      for (const src of cleanSources) {
        const idx = src.toLowerCase().indexOf(lowerNeedle);
        if (idx !== -1) {
          matchedSlice = src.slice(idx, idx + stripped.length);
          break;
        }
      }
    }

    // 3. Whitespace-collapsed substring match mapping back roughly to original source slice
    if (!matchedSlice) {
      const collapsedNeedle = stripped.replace(/\s+/g, ' ').toLowerCase();
      for (const src of cleanSources) {
        const idx = src.toLowerCase().replace(/\s+/g, ' ').indexOf(collapsedNeedle);
        if (idx !== -1) {
          // Best-effort exact match via regex built from escaped tokens separated by \s+
          const tokens = stripped.split(/\s+/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          if (tokens.length > 0) {
            const regex = new RegExp(tokens.join('\\s+'), 'i');
            const m = regex.exec(src);
            if (m && m[0]) {
              matchedSlice = m[0];
              break;
            }
          }
        }
      }
    }

    if (matchedSlice && !seen.has(matchedSlice)) {
      seen.add(matchedSlice);
      grounded.push(matchedSlice);
      if (grounded.length >= maxQuotes) break;
    }
  }

  return grounded;
}
