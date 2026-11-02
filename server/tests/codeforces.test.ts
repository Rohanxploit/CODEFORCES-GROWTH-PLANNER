import { describe, expect, it, vi } from 'vitest';
import { CodeforcesClient, CodeforcesError } from '../src/services/codeforces.service.js';
import { ProblemCatalog, type CatalogRepository } from '../src/services/problemCatalog.service.js';
import { normalizeProblemset, problemUrl } from '../src/services/problemSelector/fetchProblemset.js';
import type { CatalogProblem } from '../src/services/problemSelector/fetchProblemset.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function makeClient(fetchImpl: typeof fetch, extra: Partial<ConstructorParameters<typeof CodeforcesClient>[0]> = {}) {
  return new CodeforcesClient({ baseUrl: 'https://cf.test/api', fetchImpl, minIntervalMs: 0, ...extra });
}

describe('CodeforcesClient.getUserInfo', () => {
  it('returns rating and rank for a rated user', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ status: 'OK', result: [{ handle: 'tourist', rating: 3500, maxRating: 3900, rank: 'legendary grandmaster' }] }),
    );
    const profile = await makeClient(fetchImpl as unknown as typeof fetch).getUserInfo('tourist');
    expect(profile).toMatchObject({ handle: 'tourist', rating: 3500, rank: 'legendary grandmaster' });
    expect(fetchImpl).toHaveBeenCalledWith('https://cf.test/api/user.info?handles=tourist', expect.anything());
  });

  it('returns null rating for an unrated profile', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 'OK', result: [{ handle: 'newcomer' }] }));
    const profile = await makeClient(fetchImpl as unknown as typeof fetch).getUserInfo('newcomer');
    expect(profile.rating).toBeNull();
    expect(profile.rank).toBeNull();
  });

  it('maps a missing handle to NOT_FOUND', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 'FAILED', comment: 'handles: User with handle nobody_x not found' }, 400));
    await expect(makeClient(fetchImpl as unknown as typeof fetch).getUserInfo('nobody_x')).rejects.toMatchObject({ kind: 'NOT_FOUND' });
  });

  it('rejects malformed handles without calling the API', async () => {
    const fetchImpl = vi.fn();
    await expect(makeClient(fetchImpl as unknown as typeof fetch).getUserInfo('a b')).rejects.toMatchObject({ kind: 'INVALID_HANDLE' });
    await expect(makeClient(fetchImpl as unknown as typeof fetch).getUserInfo('x')).rejects.toMatchObject({ kind: 'INVALID_HANDLE' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps HTTP 429 and "Call limit exceeded" to RATE_LIMITED', async () => {
    const http429 = vi.fn(async () => new Response('Too many', { status: 429 }));
    await expect(makeClient(http429 as unknown as typeof fetch).getUserInfo('abc')).rejects.toMatchObject({ kind: 'RATE_LIMITED' });

    const callLimit = vi.fn(async () => jsonResponse({ status: 'FAILED', comment: 'Call limit exceeded' }, 503));
    await expect(makeClient(callLimit as unknown as typeof fetch).getUserInfo('abc')).rejects.toMatchObject({ kind: 'RATE_LIMITED' });
  });

  it('times out slow responses', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    await expect(
      makeClient(fetchImpl as unknown as typeof fetch, { timeoutMs: 20 }).getUserInfo('abc'),
    ).rejects.toMatchObject({ kind: 'TIMEOUT' });
  });

  it('reports network failures and 5xx HTML pages as UNAVAILABLE', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(makeClient(down as unknown as typeof fetch).getUserInfo('abc')).rejects.toMatchObject({ kind: 'UNAVAILABLE' });

    const html = vi.fn(async () => new Response('<html>Codeforces is temporarily unavailable</html>', { status: 502 }));
    await expect(makeClient(html as unknown as typeof fetch).getUserInfo('abc')).rejects.toMatchObject({ kind: 'UNAVAILABLE' });
  });

  it('serves repeat lookups from cache until the TTL expires', async () => {
    let now = 0;
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 'OK', result: [{ handle: 'abc', rating: 1234 }] }));
    const client = makeClient(fetchImpl as unknown as typeof fetch, { now: () => now });
    await client.getUserInfo('abc');
    await client.getUserInfo('abc');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    now += 11 * 60 * 1000;
    await client.getUserInfo('abc');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('spaces consecutive requests by the minimum interval', async () => {
    const calls: number[] = [];
    const fetchImpl = vi.fn(async () => {
      calls.push(Date.now());
      return jsonResponse({ status: 'OK', result: [] });
    });
    const client = makeClient(fetchImpl as unknown as typeof fetch, { minIntervalMs: 60 });
    await Promise.all([client.getContests(), client.getProblemset()]);
    expect(calls).toHaveLength(2);
    expect(calls[1]! - calls[0]!).toBeGreaterThanOrEqual(55);
  });
});

describe('normalizeProblemset', () => {
  const raw = {
    problems: [
      { contestId: 1, index: 'A', name: 'Rated', type: 'PROGRAMMING', rating: 800, tags: ['math'] },
      { contestId: 1, index: 'B', name: 'No rating', type: 'PROGRAMMING', tags: ['greedy'] },
      { contestId: 1, index: 'C', name: 'No tags', type: 'PROGRAMMING', rating: 1200 },
      { contestId: 2, index: 'A', name: 'April fools', type: 'PROGRAMMING', rating: 1500, tags: ['*special'] },
      { contestId: 3, index: 'A', name: 'Question', type: 'QUESTION', rating: 800, tags: [] },
      { index: 'Z', name: 'No contest', rating: 800, tags: [] },
      { contestId: 1, index: 'A', name: 'Rated duplicate', rating: 800, tags: [] },
    ],
    problemStatistics: [{ contestId: 1, index: 'A', solvedCount: 5000 }],
  };

  it('keeps valid problems and handles missing metadata', () => {
    const problems = normalizeProblemset(raw);
    expect(problems.map((p) => p.problemId)).toEqual(['1A', '1B', '1C']);
    expect(problems[0]).toMatchObject({ rating: 800, solvedCount: 5000, url: 'https://codeforces.com/problemset/problem/1/A' });
    expect(problems[1]).toMatchObject({ rating: null, solvedCount: null });
    expect(problems[2]!.tags).toEqual([]);
  });

  it('builds official problem URLs', () => {
    expect(problemUrl(1915, 'F')).toBe('https://codeforces.com/problemset/problem/1915/F');
    expect(problemUrl(1, 'A1')).toBe('https://codeforces.com/problemset/problem/1/A1');
  });
});

describe('ProblemCatalog', () => {
  const sample = {
    problems: [{ contestId: 1, index: 'A', name: 'A', type: 'PROGRAMMING', rating: 800, tags: ['math'] }],
    problemStatistics: [],
  };

  function memoryRepo(initial: CatalogProblem[] = [], updatedAt: Date | null = null): CatalogRepository & { saves: number } {
    const repo = {
      saves: 0,
      problems: initial,
      updatedAt,
      async load() {
        return { problems: repo.problems, updatedAt: repo.updatedAt };
      },
      async save(problems: CatalogProblem[], at: Date) {
        repo.saves++;
        repo.problems = problems;
        repo.updatedAt = at;
      },
    };
    return repo;
  }

  it('fetches once and then serves from memory', async () => {
    const client = { getProblemset: vi.fn(async () => sample) };
    const repo = memoryRepo();
    const catalog = new ProblemCatalog(client, repo);
    await catalog.getProblems();
    await catalog.getProblems();
    expect(client.getProblemset).toHaveBeenCalledTimes(1);
    expect(repo.saves).toBe(1);
  });

  it('uses a fresh database copy without calling Codeforces', async () => {
    const client = { getProblemset: vi.fn() };
    const stored = normalizeProblemset(sample);
    const catalog = new ProblemCatalog(client, memoryRepo(stored, new Date()), 1000 * 60);
    const snap = await catalog.getSnapshot();
    expect(snap.problems).toHaveLength(1);
    expect(client.getProblemset).not.toHaveBeenCalled();
  });

  it('falls back to a stale copy when Codeforces is unavailable', async () => {
    const client = {
      getProblemset: vi.fn(async () => {
        throw new CodeforcesError('UNAVAILABLE', 'down');
      }),
    };
    const stored = normalizeProblemset(sample);
    const catalog = new ProblemCatalog(client, memoryRepo(stored, new Date(0)), 1000);
    const snap = await catalog.getSnapshot();
    expect(snap.stale).toBe(true);
    expect(snap.problems).toHaveLength(1);
    // Backoff: a second call does not hit Codeforces again.
    await catalog.getSnapshot();
    expect(client.getProblemset).toHaveBeenCalledTimes(1);
  });

  it('throws when there is no cached copy and Codeforces fails', async () => {
    const client = {
      getProblemset: vi.fn(async () => {
        throw new CodeforcesError('TIMEOUT', 'slow');
      }),
    };
    await expect(new ProblemCatalog(client, memoryRepo()).getProblems()).rejects.toMatchObject({ kind: 'TIMEOUT' });
  });

  it('deduplicates concurrent refreshes', async () => {
    const client = { getProblemset: vi.fn(async () => sample) };
    const catalog = new ProblemCatalog(client, memoryRepo());
    await Promise.all([catalog.getProblems(), catalog.getProblems(), catalog.getProblems()]);
    expect(client.getProblemset).toHaveBeenCalledTimes(1);
  });
});
