import type { CatalogProblem } from './fetchProblemset.js';

// Stage 5, duplicate exclusion. Covers problems already in this roadmap and
// problems the user excluded by hand ("already solved", "exclude"). Submission
// history is never read.
//
// Div. 1 and Div. 2 rounds often share a problem under two contest IDs with the
// same name, so a name seen in a nearby contest also counts as a duplicate.

const SAME_ROUND_CONTEST_DISTANCE = 2;

export class ExclusionSet {
  private readonly ids = new Set<string>();
  private readonly names = new Map<string, number[]>();

  constructor(problems: Iterable<Pick<CatalogProblem, 'problemId' | 'contestId' | 'name'>> = [], ids: Iterable<string> = []) {
    for (const p of problems) this.add(p);
    for (const id of ids) this.ids.add(id);
  }

  add(problem: Pick<CatalogProblem, 'problemId' | 'contestId' | 'name'>): void {
    this.ids.add(problem.problemId);
    const key = problem.name.trim().toLowerCase();
    const contests = this.names.get(key) ?? [];
    contests.push(problem.contestId);
    this.names.set(key, contests);
  }

  addId(problemId: string): void {
    this.ids.add(problemId);
  }

  has(problem: Pick<CatalogProblem, 'problemId' | 'contestId' | 'name'>): boolean {
    if (this.ids.has(problem.problemId)) return true;
    const contests = this.names.get(problem.name.trim().toLowerCase());
    return !!contests?.some((id) => Math.abs(id - problem.contestId) <= SAME_ROUND_CONTEST_DISTANCE);
  }

  get size(): number {
    return this.ids.size;
  }
}

export function excludePreviouslyAssigned(problems: readonly CatalogProblem[], exclusion: ExclusionSet): CatalogProblem[] {
  return problems.filter((p) => !exclusion.has(p));
}
