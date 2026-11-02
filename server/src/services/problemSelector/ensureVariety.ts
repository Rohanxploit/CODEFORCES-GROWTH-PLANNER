import type { CatalogProblem } from './fetchProblemset.js';

// Stage 4, variety: problems on the same day should not need exactly the same
// observation. Tags are a rough proxy for that, so the rule is conservative.

export const MAX_TAG_SIMILARITY = 0.75;

export function tagSimilarity(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const intersection = b.filter((tag) => setA.has(tag)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

/** Strict check: different contest, different name and a different tag mix. */
export function isVaried(candidate: CatalogProblem, chosen: readonly CatalogProblem[]): boolean {
  return chosen.every(
    (c) =>
      c.contestId !== candidate.contestId &&
      c.name.toLowerCase() !== candidate.name.toLowerCase() &&
      tagSimilarity(c.tags, candidate.tags) < MAX_TAG_SIMILARITY,
  );
}

/** Relaxed check used when the strict one leaves no candidates. */
export function isDistinct(candidate: CatalogProblem, chosen: readonly CatalogProblem[]): boolean {
  return chosen.every((c) => c.contestId !== candidate.contestId && c.name.toLowerCase() !== candidate.name.toLowerCase());
}

export function ensureVariety(candidates: readonly CatalogProblem[], chosen: readonly CatalogProblem[]): { problems: CatalogProblem[]; relaxed: boolean } {
  const strict = candidates.filter((p) => isVaried(p, chosen));
  if (strict.length > 0 || chosen.length === 0) return { problems: strict, relaxed: false };
  return { problems: candidates.filter((p) => isDistinct(p, chosen)), relaxed: true };
}
