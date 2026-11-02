import { Problem } from '../models/Problem.js';
import { logger } from '../utils/logger.js';
import type { CodeforcesClient } from './codeforces.service.js';
import { CodeforcesError } from './codeforces.service.js';
import { fetchProblemset, type CatalogProblem } from './problemSelector/fetchProblemset.js';

// Keeps a cached copy of the Codeforces problemset so roadmap generation does
// not refetch ~10k problems per request and keeps working during Codeforces
// outages (serving the last good copy).

export interface CatalogRepository {
  load(): Promise<{ problems: CatalogProblem[]; updatedAt: Date | null }>;
  save(problems: CatalogProblem[], updatedAt: Date): Promise<void>;
}

export interface CatalogSnapshot {
  problems: CatalogProblem[];
  updatedAt: Date;
  stale: boolean;
}

export const CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const RETRY_BACKOFF_MS = 10 * 60 * 1000;

export class ProblemCatalog {
  private memory: { problems: CatalogProblem[]; updatedAt: Date } | null = null;
  private inflight: Promise<CatalogSnapshot> | null = null;
  private lastFailureAt = -Infinity;

  constructor(
    private readonly client: Pick<CodeforcesClient, 'getProblemset'>,
    private readonly repository: CatalogRepository,
    private readonly maxAgeMs = CATALOG_MAX_AGE_MS,
    private readonly now: () => number = Date.now,
  ) {}

  async getSnapshot(): Promise<CatalogSnapshot> {
    if (this.memory && this.isFresh(this.memory.updatedAt)) {
      return { ...this.memory, stale: false };
    }
    // After a failed refresh, serve the stale copy for a while instead of
    // hitting Codeforces on every request.
    if (this.memory && this.now() - this.lastFailureAt < RETRY_BACKOFF_MS) {
      return { ...this.memory, stale: true };
    }
    this.inflight ??= this.refresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  async getProblems(): Promise<CatalogProblem[]> {
    return (await this.getSnapshot()).problems;
  }

  private isFresh(updatedAt: Date): boolean {
    return this.now() - updatedAt.getTime() < this.maxAgeMs;
  }

  private async refresh(): Promise<CatalogSnapshot> {
    if (!this.memory) {
      const stored = await this.repository.load();
      if (stored.updatedAt && stored.problems.length > 0) {
        this.memory = { problems: stored.problems, updatedAt: stored.updatedAt };
        if (this.isFresh(stored.updatedAt)) return { ...this.memory, stale: false };
      }
    }

    try {
      const problems = await fetchProblemset(this.client);
      if (problems.length === 0) throw new CodeforcesError('BAD_RESPONSE', 'Codeforces returned an empty problemset');
      const updatedAt = new Date(this.now());
      await this.repository.save(problems, updatedAt);
      this.memory = { problems, updatedAt };
      logger.info(`Problemset refreshed: ${problems.length} problems`);
      return { problems, updatedAt, stale: false };
    } catch (error) {
      this.lastFailureAt = this.now();
      if (this.memory) {
        logger.warn('Problemset refresh failed, serving cached copy', error);
        return { ...this.memory, stale: true };
      }
      throw error;
    }
  }
}

export const mongoCatalogRepository: CatalogRepository = {
  async load() {
    const docs = await Problem.find({}, { _id: 0 }).lean();
    if (docs.length === 0) return { problems: [], updatedAt: null };
    let updatedAt = docs[0]!.metadataUpdatedAt;
    const problems = docs.map((d) => {
      if (d.metadataUpdatedAt < updatedAt) updatedAt = d.metadataUpdatedAt;
      return {
        problemId: d.problemId,
        contestId: d.contestId,
        index: d.index,
        name: d.name,
        rating: d.rating ?? null,
        tags: d.tags ?? [],
        solvedCount: d.solvedCount ?? null,
        url: d.url,
      };
    });
    return { problems, updatedAt };
  },

  async save(problems, updatedAt) {
    const BATCH = 1000;
    for (let i = 0; i < problems.length; i += BATCH) {
      await Problem.bulkWrite(
        problems.slice(i, i + BATCH).map((p) => ({
          updateOne: {
            filter: { problemId: p.problemId },
            update: { $set: { ...p, metadataUpdatedAt: updatedAt } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }
    // Problems removed upstream (rare) would otherwise linger forever.
    await Problem.deleteMany({ metadataUpdatedAt: { $lt: updatedAt } });
  },
};
