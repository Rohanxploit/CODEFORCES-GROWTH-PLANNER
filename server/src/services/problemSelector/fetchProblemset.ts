import type { CodeforcesClient, RawProblemsetResult } from '../codeforces.service.js';

export interface CatalogProblem {
  problemId: string;
  contestId: number;
  index: string;
  name: string;
  rating: number | null;
  tags: string[];
  solvedCount: number | null;
  url: string;
}

export function problemUrl(contestId: number, index: string): string {
  return `https://codeforces.com/problemset/problem/${contestId}/${index}`;
}

export function problemKey(contestId: number, index: string): string {
  return `${contestId}${index}`;
}

/**
 * Turns the raw `problemset.problems` payload into catalog entries. Keeps
 * problems with missing ratings/tags/statistics (the selector decides what to
 * do with them) but drops entries that cannot form a valid link, non-standard
 * problem types, and "*special" (e.g. April Fools) problems.
 */
export function normalizeProblemset(raw: RawProblemsetResult): CatalogProblem[] {
  const solved = new Map<string, number>();
  for (const stat of raw.problemStatistics ?? []) {
    if (typeof stat.contestId === 'number' && stat.index && typeof stat.solvedCount === 'number') {
      solved.set(problemKey(stat.contestId, stat.index), stat.solvedCount);
    }
  }

  const seen = new Set<string>();
  const problems: CatalogProblem[] = [];
  for (const p of raw.problems ?? []) {
    if (typeof p.contestId !== 'number' || !p.index || !p.name) continue;
    if (p.type && p.type !== 'PROGRAMMING') continue;
    const tags = Array.isArray(p.tags) ? p.tags.filter((t) => typeof t === 'string') : [];
    if (tags.includes('*special')) continue;

    const id = problemKey(p.contestId, p.index);
    if (seen.has(id)) continue;
    seen.add(id);

    problems.push({
      problemId: id,
      contestId: p.contestId,
      index: p.index,
      name: p.name,
      rating: typeof p.rating === 'number' ? p.rating : null,
      tags,
      solvedCount: solved.get(id) ?? null,
      url: problemUrl(p.contestId, p.index),
    });
  }
  return problems;
}

export async function fetchProblemset(client: Pick<CodeforcesClient, 'getProblemset'>): Promise<CatalogProblem[]> {
  return normalizeProblemset(await client.getProblemset());
}
