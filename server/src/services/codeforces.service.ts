import type { CodeforcesProfile } from '@cgp/shared';

// Thin client for the official Codeforces API (https://codeforces.com/apiHelp).
// Requests go through one queue spaced by `minIntervalMs` (Codeforces allows
// roughly one call per two seconds), with a timeout and a small TTL cache.
// This service never requests submission history.

export type CodeforcesErrorKind = 'NOT_FOUND' | 'INVALID_HANDLE' | 'RATE_LIMITED' | 'TIMEOUT' | 'UNAVAILABLE' | 'BAD_RESPONSE';

export class CodeforcesError extends Error {
  constructor(
    public readonly kind: CodeforcesErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'CodeforcesError';
  }
}

export interface RawProblem {
  contestId?: number;
  index?: string;
  name?: string;
  type?: string;
  rating?: number;
  tags?: string[];
}

export interface RawProblemStatistics {
  contestId?: number;
  index?: string;
  solvedCount?: number;
}

export interface RawProblemsetResult {
  problems: RawProblem[];
  problemStatistics: RawProblemStatistics[];
}

export interface RawContest {
  id: number;
  name: string;
  type: string;
  phase: 'BEFORE' | 'CODING' | 'PENDING_SYSTEM_TEST' | 'SYSTEM_TEST' | 'FINISHED';
  durationSeconds: number;
  startTimeSeconds?: number;
}

interface RawUser {
  handle: string;
  rating?: number;
  maxRating?: number;
  rank?: string;
  maxRank?: string;
  titlePhoto?: string;
  avatar?: string;
}

export interface CodeforcesClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  minIntervalMs?: number;
  timeoutMs?: number;
  now?: () => number;
}

const HANDLE_PATTERN = /^[A-Za-z0-9_.-]{3,24}$/;

export const USER_TTL_MS = 10 * 60 * 1000;
export const CONTEST_TTL_MS = 60 * 60 * 1000;

export class CodeforcesClient {
  private readonly fetchImpl: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;
  private readonly cache = new Map<string, { expires: number; value: unknown }>();

  constructor(private readonly options: CodeforcesClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.minIntervalMs = options.minIntervalMs ?? 2100;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.now = options.now ?? Date.now;
  }

  async getUserInfo(handle: string): Promise<CodeforcesProfile> {
    const trimmed = handle.trim();
    if (!HANDLE_PATTERN.test(trimmed)) {
      throw new CodeforcesError('INVALID_HANDLE', 'Codeforces handles are 3–24 characters: letters, digits, _ . -');
    }
    const users = await this.call<RawUser[]>('user.info', { handles: trimmed }, USER_TTL_MS);
    const user = users[0];
    if (!user) throw new CodeforcesError('NOT_FOUND', `Codeforces user "${trimmed}" was not found`);
    return {
      handle: user.handle,
      rating: typeof user.rating === 'number' ? user.rating : null,
      maxRating: typeof user.maxRating === 'number' ? user.maxRating : null,
      rank: user.rank ?? null,
      maxRank: user.maxRank ?? null,
      avatar: user.titlePhoto ?? user.avatar ?? null,
    };
  }

  /** Full problemset. Not cached here: ProblemCatalog persists it in MongoDB. */
  getProblemset(): Promise<RawProblemsetResult> {
    return this.call<RawProblemsetResult>('problemset.problems', {}, 0);
  }

  getContests(): Promise<RawContest[]> {
    return this.call<RawContest[]>('contest.list', { gym: 'false' }, CONTEST_TTL_MS);
  }

  private async call<T>(method: string, params: Record<string, string>, ttlMs: number): Promise<T> {
    const query = new URLSearchParams(params).toString();
    const url = `${this.options.baseUrl}/${method}${query ? `?${query}` : ''}`;

    const cached = this.cache.get(url);
    if (cached && cached.expires > this.now()) return cached.value as T;

    const result = await this.enqueue(() => this.request<T>(url));
    if (ttlMs > 0) this.cache.set(url, { expires: this.now() + ttlMs, value: result });
    return result;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = async () => {
      const wait = this.lastRequestAt + this.minIntervalMs - this.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.lastRequestAt = this.now();
      return task();
    };
    const next = this.queue.then(run, run);
    // Keep the chain alive even if this task fails.
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async request<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    } catch (error) {
      if (controller.signal.aborted) throw new CodeforcesError('TIMEOUT', 'Codeforces did not respond in time');
      throw new CodeforcesError('UNAVAILABLE', `Could not reach Codeforces: ${(error as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 429) throw new CodeforcesError('RATE_LIMITED', 'Codeforces rate limit reached, try again shortly');

    let body: { status?: string; result?: T; comment?: string };
    try {
      body = (await res.json()) as typeof body;
    } catch {
      if (res.status >= 500) throw new CodeforcesError('UNAVAILABLE', `Codeforces is unavailable (HTTP ${res.status})`);
      throw new CodeforcesError('BAD_RESPONSE', 'Codeforces returned an unreadable response');
    }

    if (body.status === 'OK' && body.result !== undefined) return body.result;

    const comment = body.comment ?? `HTTP ${res.status}`;
    if (/call limit exceeded/i.test(comment)) throw new CodeforcesError('RATE_LIMITED', 'Codeforces rate limit reached, try again shortly');
    if (/not found/i.test(comment)) throw new CodeforcesError('NOT_FOUND', comment.replace(/^handles:\s*/i, ''));
    if (res.status >= 500) throw new CodeforcesError('UNAVAILABLE', `Codeforces is unavailable: ${comment}`);
    throw new CodeforcesError('BAD_RESPONSE', `Codeforces error: ${comment}`);
  }
}

export function codeforcesErrorStatus(kind: CodeforcesErrorKind): number {
  switch (kind) {
    case 'NOT_FOUND':
      return 404;
    case 'INVALID_HANDLE':
      return 400;
    case 'RATE_LIMITED':
      return 429;
    case 'TIMEOUT':
      return 504;
    default:
      return 502;
  }
}
