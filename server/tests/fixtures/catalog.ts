// Deterministic synthetic catalog for unit tests only. It mirrors the shape
// of normalized Codeforces data; real data is checked by
// `npm run verify:problemset` against the live API.
import { problemUrl, type CatalogProblem } from '../../src/services/problemSelector/fetchProblemset.js';

export const FIXTURE_TAGS = [
  'implementation',
  'math',
  'greedy',
  'brute force',
  'sortings',
  'strings',
  'constructive algorithms',
  'binary search',
  'two pointers',
  'number theory',
  'dp',
  'data structures',
  'graphs',
  'dfs and similar',
  'trees',
  'bitmasks',
  'dsu',
  'shortest paths',
  'combinatorics',
  'hashing',
  'games',
  'probabilities',
  'divide and conquer',
] as const;

const INDICES = ['A', 'B', 'C', 'D', 'E', 'F'];

export function makeCatalog(contests = 700): CatalogProblem[] {
  const problems: CatalogProblem[] = [];
  for (let c = 1; c <= contests; c++) {
    INDICES.forEach((index, i) => {
      const rating = 800 + ((c * 7 + i * 5) % 23) * 100; // 800..3000
      const tagCount = 1 + ((c + i) % 3);
      const tags = new Set<string>();
      for (let t = 0; t < tagCount; t++) tags.add(FIXTURE_TAGS[(c * 3 + i * 11 + t * 7) % FIXTURE_TAGS.length]!);
      problems.push({
        problemId: `${c}${index}`,
        contestId: c,
        index,
        name: `Synthetic ${c}${index}`,
        rating,
        tags: [...tags],
        solvedCount: (c * 37 + i * 101) % 20000,
        url: problemUrl(c, index),
      });
    });
  }
  return problems;
}
