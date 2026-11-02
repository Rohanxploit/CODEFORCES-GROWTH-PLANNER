import { describe, expect, it } from 'vitest';
import type { CatalogProblem } from '../src/services/problemSelector/fetchProblemset.js';
import { filterByTopic, topicRelevance } from '../src/services/problemSelector/filterByTopic.js';
import { filterByDifficulty } from '../src/services/problemSelector/filterByDifficulty.js';
import { buildSolvedIndex, calculateProblemScore, qualitySignal, seededJitter } from '../src/services/problemSelector/calculateProblemScore.js';
import { ensureVariety, isVaried, tagSimilarity } from '../src/services/problemSelector/ensureVariety.js';
import { ExclusionSet, excludePreviouslyAssigned } from '../src/services/problemSelector/excludePreviouslyAssigned.js';
import { selectDailyProblems, type DailySelectionRequest } from '../src/services/problemSelector/selectDailyProblems.js';
import { makeCatalog } from './fixtures/catalog.js';

function p(id: string, rating: number | null, tags: string[], solvedCount: number | null = 1000, name = `P ${id}`): CatalogProblem {
  const contestId = Number.parseInt(id, 10);
  const index = id.replace(/^\d+/, '');
  return { problemId: id, contestId, index, name, rating, tags, solvedCount, url: `https://codeforces.com/problemset/problem/${contestId}/${index}` };
}

const catalog = makeCatalog();
const solvedIndex = buildSolvedIndex(catalog);

function request(overrides: Partial<DailySelectionRequest> = {}): DailySelectionRequest {
  return {
    topicName: 'Greedy',
    topicTags: ['greedy'],
    fallbackTags: ['sortings'],
    range: { min: 1100, max: 1300 },
    stretchRange: { min: 1400, max: 1500 },
    mandatoryCount: 2,
    seed: 'seed-1',
    maxSolvedByRating: solvedIndex,
    ...overrides,
  };
}

describe('filterByTopic', () => {
  it('keeps only problems with a matching tag', () => {
    const list = [p('1A', 800, ['greedy']), p('2A', 800, ['dp']), p('3A', 800, ['dp', 'greedy'])];
    expect(filterByTopic(list, ['greedy']).map((x) => x.problemId)).toEqual(['1A', '3A']);
  });

  it('ranks focused problems as more relevant', () => {
    expect(topicRelevance(p('1A', 800, ['greedy']), ['greedy'])).toBe(1);
    expect(topicRelevance(p('1A', 800, ['greedy', 'dp', 'math', 'graphs']), ['greedy'])).toBeCloseTo(0.625);
    expect(topicRelevance(p('1A', 800, ['dp']), ['greedy'])).toBe(0);
  });

  it('handles problems with missing tags', () => {
    expect(filterByTopic([p('1A', 800, [])], ['greedy'])).toEqual([]);
    expect(filterByTopic([p('1A', 800, [])], [])).toHaveLength(1);
  });
});

describe('filterByDifficulty', () => {
  it('filters by inclusive range and drops unrated problems', () => {
    const list = [p('1A', 900, []), p('2A', 1000, []), p('3A', 1200, []), p('4A', null, [])];
    expect(filterByDifficulty(list, { min: 1000, max: 1200 }).map((x) => x.problemId)).toEqual(['2A', '3A']);
  });
});

describe('calculateProblemScore', () => {
  it('treats missing solved counts as neutral, not zero', () => {
    const idx = new Map([[1000, 10000]]);
    expect(qualitySignal(p('1A', 1000, ['math'], null), idx)).toBeCloseTo(0.4);
    expect(qualitySignal(p('1A', 1000, ['math'], 10000), idx)).toBeCloseTo(1);
  });

  it('scores unrated problems as unusable', () => {
    const ctx = { topicTags: ['math'], targetRating: 1000, seed: 's', maxSolvedByRating: new Map() };
    expect(calculateProblemScore(p('1A', null, ['math']), ctx)).toBe(-Infinity);
  });

  it('prefers relevant problems close to the target rating', () => {
    const ctx = { topicTags: ['math'], targetRating: 1000, seed: 's', maxSolvedByRating: new Map([[1000, 1000], [1400, 1000]]) };
    expect(calculateProblemScore(p('1A', 1000, ['math']), ctx)).toBeGreaterThan(calculateProblemScore(p('2A', 1400, ['math']), ctx));
    expect(calculateProblemScore(p('1A', 1000, ['math']), ctx)).toBeGreaterThan(calculateProblemScore(p('2A', 1000, ['dp']), ctx));
  });

  it('jitter is deterministic and seed-dependent', () => {
    expect(seededJitter('a', '1A')).toBe(seededJitter('a', '1A'));
    expect(seededJitter('a', '1A')).not.toBe(seededJitter('b', '1A'));
  });
});

describe('ensureVariety', () => {
  it('measures tag similarity', () => {
    expect(tagSimilarity(['a', 'b'], ['a', 'b'])).toBe(1);
    expect(tagSimilarity(['a', 'b'], ['a', 'c'])).toBeCloseTo(1 / 3);
  });

  it('rejects same contest, same name, or identical tag sets', () => {
    const core = p('10A', 1000, ['greedy']);
    expect(isVaried(p('10B', 1000, ['greedy', 'math']), [core])).toBe(false);
    expect(isVaried(p('20A', 1000, ['greedy']), [core])).toBe(false);
    expect(isVaried(p('20A', 1000, ['greedy', 'math'], 1, 'P 10A'), [core])).toBe(false);
    expect(isVaried(p('20A', 1000, ['greedy', 'math']), [core])).toBe(true);
  });

  it('relaxes to distinct problems when nothing strictly varied exists', () => {
    const core = p('10A', 1000, ['greedy']);
    const result = ensureVariety([p('20A', 1000, ['greedy'])], [core]);
    expect(result.relaxed).toBe(true);
    expect(result.problems).toHaveLength(1);
  });
});

describe('ExclusionSet', () => {
  it('excludes ids and same-named problems from adjacent Div. 1/Div. 2 rounds', () => {
    const set = new ExclusionSet([p('1900A', 1000, [], 1, 'Shared Problem')], ['5A']);
    const list = [p('1901C', 1000, [], 1, 'Shared Problem'), p('1500A', 1000, [], 1, 'Shared Problem'), p('5A', 800, []), p('6A', 800, [])];
    expect(excludePreviouslyAssigned(list, set).map((x) => x.problemId)).toEqual(['1500A', '6A']);
  });
});

describe('selectDailyProblems', () => {
  it('selects core, reinforcement and an optional stretch with valid metadata', () => {
    const { problems, notes } = selectDailyProblems(catalog, request(), new ExclusionSet());
    expect(notes).toEqual([]);
    expect(problems.map((s) => [s.role, s.mandatory])).toEqual([
      ['core', true],
      ['reinforcement', true],
      ['stretch', false],
    ]);
    for (const s of problems) {
      expect(s.problem.rating).not.toBeNull();
      expect(s.problem.url).toBe(`https://codeforces.com/problemset/problem/${s.problem.contestId}/${s.problem.index}`);
      expect(s.reason.length).toBeGreaterThan(10);
    }
  });

  it('respects topic and difficulty for mandatory problems', () => {
    const { problems } = selectDailyProblems(catalog, request(), new ExclusionSet());
    for (const s of problems.filter((x) => x.mandatory)) {
      expect(s.problem.tags).toContain('greedy');
      expect(s.problem.rating).toBeGreaterThanOrEqual(1100);
      expect(s.problem.rating).toBeLessThanOrEqual(1300);
    }
    const stretch = problems.find((x) => x.role === 'stretch')!;
    expect(stretch.problem.rating).toBeGreaterThanOrEqual(1400);
    expect(stretch.problem.rating).toBeLessThanOrEqual(1500);
  });

  it('keeps the day varied', () => {
    const { problems } = selectDailyProblems(catalog, request(), new ExclusionSet());
    const contests = new Set(problems.map((s) => s.problem.contestId));
    expect(contests.size).toBe(problems.length);
  });

  it('never repeats problems across days and honours manual exclusions', () => {
    const exclusion = new ExclusionSet([], ['1A']);
    const seen = new Set<string>();
    for (let day = 0; day < 20; day++) {
      const { problems } = selectDailyProblems(catalog, request({ seed: 'roadmap-x' }), exclusion);
      for (const s of problems) {
        expect(seen.has(s.problem.problemId)).toBe(false);
        expect(s.problem.problemId).not.toBe('1A');
        seen.add(s.problem.problemId);
      }
    }
  });

  it('is deterministic for the same seed and differs across seeds', () => {
    const a = selectDailyProblems(catalog, request({ seed: 'u1' }), new ExclusionSet()).problems.map((s) => s.problem.problemId);
    const b = selectDailyProblems(catalog, request({ seed: 'u1' }), new ExclusionSet()).problems.map((s) => s.problem.problemId);
    const c = selectDailyProblems(catalog, request({ seed: 'u2' }), new ExclusionSet()).problems.map((s) => s.problem.problemId);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('supports a single mandatory problem for limited study time', () => {
    const { problems } = selectDailyProblems(catalog, request({ mandatoryCount: 1 }), new ExclusionSet());
    expect(problems.filter((s) => s.mandatory)).toHaveLength(1);
  });

  it('falls back to related tags and widens the range, and explains why', () => {
    const tiny = [p('1A', 1500, ['sortings']), p('2A', 1300, ['sortings', 'math']), p('3A', 1600, ['sortings'])];
    const { problems } = selectDailyProblems(tiny, request({ stretchRange: null }), new ExclusionSet());
    expect(problems).toHaveLength(2);
    expect(problems[0]!.reason).toMatch(/related tag/);
    expect(problems.some((s) => /widened/.test(s.reason))).toBe(true);
  });

  it('reports when no candidate exists instead of inventing one', () => {
    const { problems, notes } = selectDailyProblems([p('1A', 3000, ['games'])], request(), new ExclusionSet());
    expect(problems).toEqual([]);
    expect(notes.length).toBeGreaterThan(0);
  });

  it('ignores problems without ratings', () => {
    const { problems } = selectDailyProblems([p('1A', null, ['greedy']), p('2A', 1200, ['greedy'])], request({ stretchRange: null, mandatoryCount: 1 }), new ExclusionSet());
    expect(problems.map((s) => s.problem.problemId)).toEqual(['2A']);
  });

  it('caps the stretch problem at its range maximum (benchmark)', () => {
    const list = [p('1A', 1200, ['greedy']), p('2A', 1900, ['greedy']), p('3A', 1700, ['greedy'])];
    const { problems } = selectDailyProblems(list, request({ mandatoryCount: 1, stretchRange: { min: 1800, max: 1800 } }), new ExclusionSet());
    const stretch = problems.find((s) => s.role === 'stretch');
    expect(stretch?.problem.problemId).toBe('3A');
  });
});
