import type { RatingRange } from '@cgp/shared';
import { MIN_PROBLEM_RATING } from './problemSelector/filterByDifficulty.js';
import { stretchOffset } from './problemBenchmark.service.js';

// Practice difficulty over the challenge. The centre moves from the starting
// rating towards the target along a smooth S-curve: the first weeks stay near
// the comfort zone, the climb happens in the middle, the end settles near the
// target. Revision days and adaptive offsets move it down or up, so the
// sequence is intentionally not monotonic.

/** Largest rise of the practice centre over one 90-day plan. */
export const MAX_RAMP = 700;

export interface ProgressionInput {
  startingRating: number;
  targetRating: number;
  benchmark: number;
  hoursPerDay: number;
}

export interface DifficultyCurve {
  start: number;
  end: number;
  capped: boolean;
  centreAt(progress: number, offset?: number): number;
  rangeAt(progress: number, kind?: 'normal' | 'intro' | 'revision', offset?: number): RatingRange;
  stretchAt(progress: number, offset?: number): RatingRange | null;
}

export const round100 = (n: number) => Math.round(n / 100) * 100;

/** Smoothstep: 0 → 0, 1 → 1, slow at both ends. */
export function ease(p: number): number {
  const x = Math.min(Math.max(p, 0), 1);
  return x * x * (3 - 2 * x);
}

export function createDifficultyCurve(input: ProgressionInput): DifficultyCurve {
  const start = Math.max(MIN_PROBLEM_RATING, round100(input.startingRating));
  let gap = Math.max(0, round100(input.targetRating) - start);
  const capped = gap > MAX_RAMP;
  gap = Math.min(gap, MAX_RAMP);
  // With under an hour a day there is less exposure per level: climb a bit slower.
  if (input.hoursPerDay < 1) gap = Math.round(gap * 0.85);
  const end = start + gap;
  const lowRatedBeginner = input.startingRating < 700;

  const centreAt = (progress: number, offset = 0) => Math.max(MIN_PROBLEM_RATING, start + gap * ease(progress) + offset);

  const rangeAt = (progress: number, kind: 'normal' | 'intro' | 'revision' = 'normal', offset = 0): RatingRange => {
    const c = round100(centreAt(progress, offset));
    if (kind === 'revision') return { min: Math.max(MIN_PROBLEM_RATING, c - 200), max: Math.max(MIN_PROBLEM_RATING, c) };
    if (kind === 'intro') return { min: Math.max(MIN_PROBLEM_RATING, c - 200), max: Math.max(MIN_PROBLEM_RATING, c) };
    // Beginners stay on 800s (the easiest rated problems) until the curve moves.
    if (lowRatedBeginner && c <= MIN_PROBLEM_RATING) return { min: MIN_PROBLEM_RATING, max: MIN_PROBLEM_RATING };
    return { min: Math.max(MIN_PROBLEM_RATING, c - 100), max: c + 100 };
  };

  const stretchAt = (progress: number, offset = 0): RatingRange | null => {
    const c = round100(centreAt(progress, offset));
    const max = Math.min(input.benchmark, c + stretchOffset(progress) + 100);
    const min = Math.min(c + stretchOffset(progress), max);
    const normalMax = rangeAt(progress, 'normal', offset).max;
    if (max <= normalMax) return null;
    return { min: Math.max(min, normalMax + 100), max };
  };

  return { start, end, capped, centreAt, rangeAt, stretchAt };
}
