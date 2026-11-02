import type { ProblemRole, RatingRange } from '@cgp/shared';
import type { CatalogProblem } from './fetchProblemset.js';
import { filterByTopic } from './filterByTopic.js';
import { filterByDifficulty, widenRange } from './filterByDifficulty.js';
import { calculateProblemScore } from './calculateProblemScore.js';
import { ensureVariety } from './ensureVariety.js';
import { excludePreviouslyAssigned, type ExclusionSet } from './excludePreviouslyAssigned.js';

export interface DailySelectionRequest {
  topicName: string;
  /** Codeforces tags for the topic; empty for mixed-topic days. */
  topicTags: readonly string[];
  /** Related tags tried when the main tags have no unused candidates. */
  fallbackTags: readonly string[];
  range: RatingRange;
  stretchRange: RatingRange | null;
  /** 1–3 mandatory problems (core first, then reinforcement). */
  mandatoryCount: number;
  seed: string;
  maxSolvedByRating: ReadonlyMap<number, number>;
}

export interface SelectedProblem {
  problem: CatalogProblem;
  role: ProblemRole;
  mandatory: boolean;
  reason: string;
}

export interface DailySelection {
  problems: SelectedProblem[];
  notes: string[];
}

const WIDEN_STEPS = [0, 100, 200] as const;

interface PickResult {
  problem: CatalogProblem;
  widenedBy: number;
  usedTags: readonly string[];
  fallback: boolean;
  relaxedVariety: boolean;
}

function pick(
  catalog: readonly CatalogProblem[],
  range: RatingRange,
  tagTiers: { tags: readonly string[]; fallback: boolean }[],
  chosen: readonly CatalogProblem[],
  exclusion: ExclusionSet,
  scoreTags: readonly string[],
  seed: string,
  maxSolvedByRating: ReadonlyMap<number, number>,
  widenDirection: 'both' | 'down',
  bonus: (p: CatalogProblem) => number = () => 0,
): PickResult | null {
  const chosenIds = new Set(chosen.map((c) => c.problemId));
  for (const tier of tagTiers) {
    const byTopic = filterByTopic(catalog, tier.tags);
    for (const widenedBy of WIDEN_STEPS) {
      const r = widenRange(range, widenedBy, widenDirection);
      const unused = excludePreviouslyAssigned(filterByDifficulty(byTopic, r), exclusion).filter((p) => !chosenIds.has(p.problemId));
      if (unused.length === 0) continue;
      const { problems: varied, relaxed } = ensureVariety(unused, chosen);
      if (varied.length === 0) continue;

      const centre = (range.min + range.max) / 2;
      const ctx = { topicTags: tier.tags.length ? tier.tags : scoreTags, targetRating: centre, seed, maxSolvedByRating };
      let best: CatalogProblem | null = null;
      let bestScore = -Infinity;
      for (const p of varied) {
        const score = calculateProblemScore(p, ctx) + bonus(p);
        if (score > bestScore || (score === bestScore && best && p.problemId < best.problemId)) {
          best = p;
          bestScore = score;
        }
      }
      if (best) return { problem: best, widenedBy, usedTags: tier.tags, fallback: tier.fallback, relaxedVariety: relaxed };
    }
  }
  return null;
}

function describe(result: PickResult, role: ProblemRole, req: DailySelectionRequest, core: CatalogProblem | null): string {
  const { problem } = result;
  const matched = problem.tags.filter((t) => result.usedTags.includes(t));
  const parts: string[] = [];

  if (role === 'core') {
    parts.push(
      req.topicTags.length === 0
        ? `Mixed practice at ${problem.rating}, inside today's ${req.range.min}–${req.range.max} range.`
        : `Direct practice of ${req.topicName}${matched.length ? ` (tagged ${matched.join(', ')})` : ''}, rated ${problem.rating}, inside today's ${req.range.min}–${req.range.max} range.`,
    );
  } else if (role === 'reinforcement') {
    const extra = core ? problem.tags.filter((t) => !core.tags.includes(t)) : [];
    parts.push(
      extra.length
        ? `Reinforces the same idea from a different angle (also involves ${extra.slice(0, 3).join(', ')}), rated ${problem.rating}.`
        : `A second, independent problem on the same concept from a different contest, rated ${problem.rating}.`,
    );
  } else {
    parts.push(`Optional stretch at ${problem.rating}, above today's range, to build towards harder problems.`);
  }

  if (result.fallback) parts.push(`Few unused ${req.topicName} problems fit, so this uses a related tag (${matched.join(', ') || result.usedTags.join(', ')}).`);
  if (result.widenedBy > 0) parts.push(`The rating range was widened by ${result.widenedBy} because few unused problems matched.`);
  return parts.join(' ');
}

/**
 * Picks the day's problems: core (direct application), reinforcement (same
 * concept, different observation), and an optional stretch. Deterministic for
 * the same catalog, request and exclusions. Chosen problems are added to the
 * exclusion set so later days never repeat them.
 */
export function selectDailyProblems(
  catalog: readonly CatalogProblem[],
  req: DailySelectionRequest,
  exclusion: ExclusionSet,
): DailySelection {
  const notes: string[] = [];
  const selected: SelectedProblem[] = [];
  const chosen: CatalogProblem[] = [];

  const tiers = [{ tags: req.topicTags, fallback: false }];
  if (req.topicTags.length > 0 && req.fallbackTags.length > 0) tiers.push({ tags: req.fallbackTags, fallback: true });

  const accept = (result: PickResult | null, role: ProblemRole, mandatory: boolean) => {
    if (!result) {
      notes.push(`No suitable unused ${role} problem was found for ${req.topicName} at ${req.range.min}–${req.range.max}.`);
      return;
    }
    const core = selected.find((s) => s.role === 'core')?.problem ?? null;
    selected.push({ problem: result.problem, role, mandatory, reason: describe(result, role, req, core) });
    chosen.push(result.problem);
    exclusion.add(result.problem);
  };

  const mandatory = Math.max(1, Math.min(3, req.mandatoryCount));
  const args = [req.seed, req.maxSolvedByRating] as const;

  // Core: favour focused problems (relevance carries most of the score).
  accept(pick(catalog, req.range, tiers, chosen, exclusion, req.topicTags, ...args, 'both'), 'core', true);

  for (let i = 1; i < mandatory; i++) {
    // Reinforcement: small bonus for problems that bring in another tag.
    const coreTags = chosen[0]?.tags ?? [];
    const bonus = (p: CatalogProblem) => (p.tags.some((t) => !coreTags.includes(t)) ? 0.05 : 0);
    accept(pick(catalog, req.range, tiers, chosen, exclusion, req.topicTags, ...args, 'both', bonus), 'reinforcement', true);
  }

  if (req.stretchRange) {
    // Widen only downwards so the stretch never exceeds its cap (the benchmark).
    accept(pick(catalog, req.stretchRange, tiers, chosen, exclusion, req.topicTags, ...args, 'down'), 'stretch', false);
  }

  return { problems: selected, notes };
}

export function estimateMinutes(rating: number, rangeCentre: number, role: ProblemRole): number {
  const base = 25 + ((rating - rangeCentre) / 100) * 10;
  const minutes = role === 'stretch' ? base + 15 : base;
  return Math.round(Math.min(90, Math.max(15, minutes)) / 5) * 5;
}
