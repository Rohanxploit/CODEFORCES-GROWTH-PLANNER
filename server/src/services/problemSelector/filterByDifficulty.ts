import type { RatingRange } from '@cgp/shared';
import type { CatalogProblem } from './fetchProblemset.js';

/** Codeforces' lowest problem rating. */
export const MIN_PROBLEM_RATING = 800;

/** Stage 2, difficulty. Unrated problems are never assigned. */
export function filterByDifficulty(problems: readonly CatalogProblem[], range: RatingRange): CatalogProblem[] {
  return problems.filter((p) => p.rating !== null && p.rating >= range.min && p.rating <= range.max);
}

export function widenRange(range: RatingRange, by: number, direction: 'both' | 'down' = 'both'): RatingRange {
  return {
    min: Math.max(MIN_PROBLEM_RATING, range.min - by),
    max: direction === 'both' ? range.max + by : range.max,
  };
}
