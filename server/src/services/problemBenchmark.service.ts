import { BENCHMARK_OFFSET, MAX_RATING } from '@cgp/shared';
import { assertValidRating } from './ratingLevel.service.js';

/**
 * Training heuristic: to compete at contest rating X, work towards solving
 * problems around X + 300 independently. A long-term stretch objective,
 * not an official Codeforces rule and not a guarantee.
 */
export function calculateBenchmark(targetRating: number): number {
  assertValidRating(targetRating, 'Target rating');
  return Math.min(targetRating + BENCHMARK_OFFSET, MAX_RATING);
}

/**
 * Stretch problems widen gradually from about +100 above today's practice
 * centre at the start to +300 at the end, and never exceed the benchmark.
 */
export function stretchOffset(progress: number): number {
  const p = Math.min(Math.max(progress, 0), 1);
  return 100 + Math.round((200 * p) / 100) * 100;
}
