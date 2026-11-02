import type { CatalogProblem } from './fetchProblemset.js';
import { topicRelevance } from './filterByTopic.js';

// Stage 3, quality scoring. Weights are deliberately simple and visible.
export const SCORE_WEIGHTS = {
  relevance: 0.45,
  difficultyFit: 0.25,
  quality: 0.2,
  jitter: 0.1,
} as const;

export interface ScoreContext {
  topicTags: readonly string[];
  /** Rating the pick should be close to (centre of the day's range). */
  targetRating: number;
  /** Per-roadmap seed so users at the same level don't all get identical problems. */
  seed: string;
  /** Highest solved count per rating, so popularity is judged within a rating bucket. */
  maxSolvedByRating: ReadonlyMap<number, number>;
}

/** FNV-1a hash mapped to [0, 1). Deterministic for the same inputs. */
export function seededJitter(seed: string, id: string): number {
  let hash = 0x811c9dc5;
  const input = `${seed}:${id}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x100000000;
}

export function buildSolvedIndex(problems: readonly CatalogProblem[]): Map<number, number> {
  const index = new Map<number, number>();
  for (const p of problems) {
    if (p.rating === null || p.solvedCount === null) continue;
    index.set(p.rating, Math.max(index.get(p.rating) ?? 0, p.solvedCount));
  }
  return index;
}

/**
 * Solved count is a supporting signal only: it is log-scaled and compared to
 * other problems of the same rating, and a missing count gets a neutral value.
 */
export function qualitySignal(problem: CatalogProblem, maxSolvedByRating: ReadonlyMap<number, number>): number {
  let quality = 0.4;
  if (problem.solvedCount !== null && problem.rating !== null) {
    const max = maxSolvedByRating.get(problem.rating) ?? problem.solvedCount;
    quality = max > 0 ? Math.log10(1 + problem.solvedCount) / Math.log10(1 + max) : 0.4;
  }
  if (problem.tags.length === 0) quality -= 0.2;
  return Math.max(0, Math.min(1, quality));
}

export function calculateProblemScore(problem: CatalogProblem, ctx: ScoreContext): number {
  if (problem.rating === null) return -Infinity;
  const relevance = topicRelevance(problem, ctx.topicTags);
  const fit = 1 - Math.min(Math.abs(problem.rating - ctx.targetRating), 400) / 400;
  return (
    SCORE_WEIGHTS.relevance * relevance +
    SCORE_WEIGHTS.difficultyFit * fit +
    SCORE_WEIGHTS.quality * qualitySignal(problem, ctx.maxSolvedByRating) +
    SCORE_WEIGHTS.jitter * seededJitter(ctx.seed, problem.problemId)
  );
}
