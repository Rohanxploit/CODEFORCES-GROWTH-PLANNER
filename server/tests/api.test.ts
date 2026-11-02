import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import { createApp } from '../src/app.js';
import { setServices } from '../src/services/container.js';
import { CodeforcesError } from '../src/services/codeforces.service.js';
import { User } from '../src/models/User.js';
import { DailyPlan } from '../src/models/DailyPlan.js';
import { Roadmap } from '../src/models/Roadmap.js';
import { Progress } from '../src/models/Progress.js';
import { rateLimit } from '../src/middleware/rateLimit.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { makeCatalog } from './fixtures/catalog.js';

let mongo: MongoMemoryServer;
const app = createApp({ corsOrigins: ['http://localhost:5173'] });
const catalog = makeCatalog(1500);

const profiles: Record<string, { rating: number | null }> = {
  rated_user: { rating: 1350 },
  unrated_user: { rating: null },
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  setServices({
    catalog: {
      getProblems: async () => catalog,
      getSnapshot: async () => ({ problems: catalog, updatedAt: new Date(), stale: false }),
    },
    codeforces: {
      getUserInfo: async (handle: string) => {
        const p = profiles[handle];
        if (!p) throw new CodeforcesError('NOT_FOUND', `Codeforces user "${handle}" was not found`);
        return { handle, rating: p.rating, maxRating: p.rating, rank: null, maxRank: null, avatar: null };
      },
      getContests: async () => [
        { id: 3000, name: 'Codeforces Round (Div. 2)', type: 'CF', phase: 'BEFORE', durationSeconds: 7200, startTimeSeconds: Math.floor(Date.now() / 1000) + 86400 },
        { id: 2001, name: 'Codeforces Round 1 (Div. 3)', type: 'ICPC', phase: 'FINISHED', durationSeconds: 7200, startTimeSeconds: 1700000000 },
      ],
    },
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

async function signUp(email: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name: 'Test User', email, password: 'correct-horse-battery' });
  expect(res.status).toBe(201);
  return agent;
}

const START = '2026-01-05';

describe('authentication and security', () => {
  it('hashes passwords and never returns them', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Hash', email: 'hash@test.dev', password: 'super-secret-pw' });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain('super-secret-pw');
    expect(res.body.user.passwordHash).toBeUndefined();
    const stored = await User.findOne({ email: 'hash@test.dev' }).select('+passwordHash');
    expect(stored!.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(res.headers['set-cookie']?.[0]).toMatch(/cgp_token=.*HttpOnly/);
  });

  it('rejects duplicate emails', async () => {
    await request(app).post('/api/auth/register').send({ name: 'A', email: 'dup@test.dev', password: 'password-123' });
    const res = await request(app).post('/api/auth/register').send({ name: 'B', email: 'DUP@test.dev', password: 'password-123' });
    expect(res.status).toBe(409);
  });

  it('rejects invalid login with a generic message', async () => {
    await request(app).post('/api/auth/register').send({ name: 'L', email: 'login@test.dev', password: 'password-123' });
    const wrong = await request(app).post('/api/auth/login').send({ email: 'login@test.dev', password: 'nope-nope' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'nope-nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
    const ok = await request(app).post('/api/auth/login').send({ email: 'LOGIN@test.dev', password: 'password-123' });
    expect(ok.status).toBe(200);
  });

  it('validates input', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: '', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['get', '/api/auth/me'],
    ['get', '/api/roadmaps'],
    ['post', '/api/roadmaps/generate'],
    ['get', '/api/problems'],
    ['get', '/api/contests'],
    ['get', '/api/codeforces/tourist'],
    ['get', '/api/analytics/aaaaaaaaaaaaaaaaaaaaaaaa'],
  ])('protects %s %s', async (method, path) => {
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method]!(path);
    expect(res.status).toBe(401);
  });

  it('rejects forged or malformed tokens', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'cgp_token=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.');
    expect(res.status).toBe(401);
  });

  it('logs out by clearing the cookie', async () => {
    const agent = await signUp('logout@test.dev');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('rate limits repeated attempts', async () => {
    const limited = express();
    limited.post('/x', rateLimit({ windowMs: 60_000, max: 2 }), (_req, res) => {
      res.json({ ok: true });
    });
    limited.use(errorHandler);
    expect((await request(limited).post('/x')).status).toBe(200);
    expect((await request(limited).post('/x')).status).toBe(200);
    const third = await request(limited).post('/x');
    expect(third.status).toBe(429);
    expect(third.headers['retry-after']).toBeDefined();
  });
});

describe('goal endpoints', () => {
  it('analyzes a goal publicly', async () => {
    const res = await request(app).post('/api/goals/analyze').send({ currentRating: 1200, targetRating: 1900 });
    expect(res.status).toBe(200);
    expect(res.body.difficulty).toBe('very-ambitious');
    expect(res.body.benchmark).toBe(2200);
  });

  it('rejects invalid targets', async () => {
    const res = await request(app).post('/api/goals/analyze').send({ currentRating: 1200, targetRating: 99999 });
    expect(res.status).toBe(400);
  });

  it('recommends goals', async () => {
    const res = await request(app).post('/api/goals/recommend').send({ currentRating: 1400 });
    expect(res.body.goals.recommended).toBe(1650);
    expect(res.body.level.rank).toBe('Specialist');
  });
});

describe('codeforces lookups', () => {
  it('returns rating and level for a rated handle', async () => {
    const agent = await signUp('cf@test.dev');
    const res = await agent.get('/api/codeforces/rated_user');
    expect(res.status).toBe(200);
    expect(res.body.level.rank).toBe('Pupil');
  });

  it('returns 404 for an unknown handle and null level for unrated', async () => {
    const agent = await signUp('cf2@test.dev');
    expect((await agent.get('/api/codeforces/nobody_here')).status).toBe(404);
    const unrated = await agent.get('/api/codeforces/unrated_user');
    expect(unrated.body.level).toBeNull();
  });

  it('requires a manual rating to generate a roadmap for an unrated handle', async () => {
    const agent = await signUp('cf3@test.dev');
    const res = await agent.post('/api/roadmaps/generate').send({ codeforcesHandle: 'unrated_user', targetRating: 800, hoursPerDay: 1, daysPerWeek: 5, contestParticipation: false });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNRATED_PROFILE');
    const manual = await agent.post('/api/roadmaps/generate').send({ codeforcesHandle: 'unrated_user', currentRating: 0, targetRating: 400, hoursPerDay: 1, daysPerWeek: 5, contestParticipation: false, startDate: START });
    expect(manual.status).toBe(201);
    expect(manual.body.roadmap.startingLevel.needsFundamentals).toBe(true);
  });

  it('uses the Codeforces rating when the handle is rated', async () => {
    const agent = await signUp('cf4@test.dev');
    const res = await agent.post('/api/roadmaps/generate').send({ codeforcesHandle: 'rated_user', currentRating: 500, targetRating: 1500, hoursPerDay: 2, daysPerWeek: 6, contestParticipation: true, startDate: START });
    expect(res.status).toBe(201);
    expect(res.body.roadmap.startingRating).toBe(1350);
  });
});

describe('roadmap lifecycle', () => {
  let agent: Awaited<ReturnType<typeof signUp>>;
  let roadmapId: string;

  beforeAll(async () => {
    agent = await signUp('journey@test.dev');
    const res = await agent.post('/api/roadmaps/generate').send({ currentRating: 1200, targetRating: 1600, hoursPerDay: 2, daysPerWeek: 6, contestParticipation: true, startDate: START });
    expect(res.status).toBe(201);
    roadmapId = res.body.roadmap.id;
  });

  it('stores 90 days and returns the roadmap with goals', async () => {
    const res = await agent.get(`/api/roadmaps/${roadmapId}`);
    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(90);
    expect(res.body.roadmap).toMatchObject({ startingRating: 1200, targetRating: 1600, problemSolvingBenchmark: 1900, recommendedGoal: 1450, goalDifficulty: 'very-ambitious' });
    expect(res.body.roadmap.seed).toBeUndefined();
    const me = await agent.get('/api/auth/me');
    expect(me.body.activeRoadmapId).toBe(roadmapId);
  });

  it("returns today's day based on the given date", async () => {
    const res = await agent.get(`/api/roadmaps/${roadmapId}/today?date=2026-01-07`);
    expect(res.body.currentDay).toBe(3);
    expect(res.body.day.dayNumber).toBe(3);
    const before = await agent.get(`/api/roadmaps/${roadmapId}/today?date=2025-12-01`);
    expect(before.body.currentDay).toBe(1);
    expect((await agent.get(`/api/roadmaps/${roadmapId}/today?date=bad`)).status).toBe(400);
  });

  it('records progress and completes a day once mandatory problems have outcomes', async () => {
    const { body } = await agent.get(`/api/roadmaps/${roadmapId}/day/2`);
    const day = body.day;
    const [first, second] = day.problems.filter((p: { mandatory: boolean }) => p.mandatory);
    let res = await agent.patch(`/api/progress/${day.id}`).send({ problemId: first.problemId, solvingStatus: 'solved-independently', timeTakenMinutes: 25, confidence: 4 });
    expect(res.status).toBe(200);
    expect(res.body.day.status).toBe('in-progress');
    res = await agent.patch(`/api/progress/${day.id}`).send({ problemId: second.problemId, solvingStatus: 'solved-with-editorial' });
    expect(res.body.day.status).toBe('completed');
    const editorial = res.body.day.progress.find((p: { problemId: string }) => p.problemId === second.problemId);
    expect(editorial.editorialUsed).toBe(true);
  });

  it('rejects progress for a problem not on the day and contradictory input', async () => {
    const { body } = await agent.get(`/api/roadmaps/${roadmapId}/day/2`);
    expect((await agent.patch(`/api/progress/${body.day.id}`).send({ problemId: '99999Z', solvingStatus: 'solved-independently' })).status).toBe(404);
    const p = body.day.problems[0].problemId;
    expect((await agent.patch(`/api/progress/${body.day.id}`).send({ problemId: p, solvingStatus: 'solved-independently', editorialUsed: true })).status).toBe(400);
    expect((await agent.patch(`/api/progress/${body.day.id}`).send({ problemId: p, confidence: 9 })).status).toBe(400);
  });

  it('replaces a problem with a different one on the same day', async () => {
    const { body } = await agent.get(`/api/roadmaps/${roadmapId}/day/9`);
    const old = body.day.problems[0];
    const res = await agent.post('/api/problems/replace').send({ roadmapId, dayNumber: 9, problemId: old.problemId });
    expect(res.status).toBe(200);
    const fresh = res.body.day.problems[0];
    expect(fresh.problemId).not.toBe(old.problemId);
    expect(fresh.role).toBe(old.role);
    expect(fresh.reason).toMatch(/Replacement/);
    const all = await DailyPlan.find({ roadmapId });
    const ids = all.flatMap((d) => d.problems.map((p) => p.problemId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('excludes an already-solved problem and swaps it out', async () => {
    const { body } = await agent.get(`/api/roadmaps/${roadmapId}/day/10`);
    const target = body.day.problems[0].problemId;
    const res = await agent.post('/api/problems/exclude').send({ problemId: target, roadmapId, dayNumber: 10 });
    expect(res.status).toBe(200);
    expect(res.body.user.excludedProblemIds).toContain(target);
    expect(res.body.day.problems.map((p: { problemId: string }) => p.problemId)).not.toContain(target);
  });

  it('adapts difficulty only after repeated feedback', async () => {
    const ids: string[] = [];
    for (const n of [3, 4, 5]) ids.push((await agent.get(`/api/roadmaps/${roadmapId}/day/${n}`)).body.day.id);
    const before = (await agent.get(`/api/roadmaps/${roadmapId}/day/40`)).body.day.difficulty;

    let res = await agent.post(`/api/progress/${ids[0]}/feedback`).send({ feedback: ['too-easy'] });
    expect(res.body.adaptation).toBeNull();
    res = await agent.post(`/api/progress/${ids[1]}/feedback`).send({ feedback: ['too-easy'] });
    expect(res.body.adaptation).toBeNull();
    res = await agent.post(`/api/progress/${ids[2]}/feedback`).send({ feedback: ['too-easy', 'understood'] });
    expect(res.body.adaptation.change).toBe('increase');

    const after = (await agent.get(`/api/roadmaps/${roadmapId}/day/40`)).body.day.difficulty;
    expect(after.max).toBeGreaterThanOrEqual(before.max + 100);
    const roadmap = await Roadmap.findById(roadmapId);
    expect(roadmap!.startingRating).toBe(1200);
    expect(roadmap!.startingLevel.rank).toBe('Pupil');
    // The completed day 2 was kept.
    expect((await agent.get(`/api/roadmaps/${roadmapId}/day/2`)).body.day.status).toBe('completed');
  });

  it('rejects contradictory feedback', async () => {
    const { body } = await agent.get(`/api/roadmaps/${roadmapId}/day/6`);
    expect((await agent.post(`/api/progress/${body.day.id}/feedback`).send({ feedback: ['too-easy', 'too-difficult'] })).status).toBe(400);
  });

  it('marks a rest day complete manually but not a day with open mandatory problems', async () => {
    const { body } = await agent.get(`/api/roadmaps/${roadmapId}`);
    const restDay = body.days.find((d: { type: string }) => d.type === 'rest');
    const rest = (await agent.get(`/api/roadmaps/${roadmapId}/day/${restDay.dayNumber}`)).body.day;
    expect((await agent.patch(`/api/progress/${rest.id}/status`).send({ status: 'completed' })).body.day.status).toBe('completed');
    const learnDay = body.days.find((d: { type: string; dayNumber: number; status: string }) => d.type === 'learn' && d.dayNumber > 20 && d.status === 'pending');
    const open = (await agent.get(`/api/roadmaps/${roadmapId}/day/${learnDay.dayNumber}`)).body.day;
    expect((await agent.patch(`/api/progress/${open.id}/status`).send({ status: 'completed' })).status).toBe(400);
  });

  it('records contests and suggests virtual contests', async () => {
    const res = await agent.post('/api/contests').send({ contestName: 'Codeforces Round 1 (Div. 3)', contestId: 2001, contestDate: '2026-01-10', kind: 'rated', oldRating: 1200, newRating: 1260, problemsSolved: 3, upsolvedProblems: 1, roadmapId });
    expect(res.status).toBe(201);
    const history = await agent.get('/api/contests/history');
    expect(history.body.contests).toHaveLength(1);
    const overview = await agent.get('/api/contests');
    expect(overview.body.upcoming).toHaveLength(1);
    // Already-recorded contest is not suggested again.
    expect(overview.body.virtualSuggestions.map((c: { id: number }) => c.id)).not.toContain(2001);
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.currentRating).toBe(1260);
  });

  it('computes analytics and weekly review from recorded data', async () => {
    const res = await agent.get(`/api/analytics/${roadmapId}?date=2026-01-12`);
    expect(res.status).toBe(200);
    expect(res.body.totals.problemsSolved).toBe(2);
    expect(res.body.solvingBreakdown['solved-independently']).toBe(1);
    expect(res.body.solvingBreakdown['solved-with-editorial']).toBe(1);
    expect(res.body.highestIndependentlySolved).toBeGreaterThanOrEqual(800);
    expect(res.body.contests.rated).toBe(1);
    const review = await agent.get(`/api/analytics/${roadmapId}/weekly-review?week=1&date=2026-01-12`);
    expect(review.body.independentSolves).toBe(1);
    expect(review.body.editorialSolves).toBe(1);
    expect(review.body.feedbackSummary['too-easy']).toBe(3);
    expect(review.body.contests).toHaveLength(1);
    expect(review.body.nextWeek.length).toBe(7);
  });

  it('regenerates untouched future days when settings change', async () => {
    const res = await agent.patch(`/api/roadmaps/${roadmapId}?date=2026-02-01`).send({ hoursPerDay: 1, daysPerWeek: 3 });
    expect(res.status).toBe(200);
    expect(res.body.regeneratedDays).toBeGreaterThan(0);
    expect(res.body.roadmap.mandatoryProblems).toBe(1);
    const day = (await agent.get(`/api/roadmaps/${roadmapId}/day/80`)).body.day;
    if (day.type === 'learn') expect(day.learnMinutes + day.practiceMinutes).toBe(60);
    const all = await DailyPlan.find({ roadmapId });
    const ids = all.flatMap((d) => d.problems.map((p) => p.problemId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('isolates user data', async () => {
    const other = await signUp('intruder@test.dev');
    expect((await other.get(`/api/roadmaps/${roadmapId}`)).status).toBe(404);
    expect((await other.get(`/api/roadmaps/${roadmapId}/day/1`)).status).toBe(404);
    expect((await other.get(`/api/analytics/${roadmapId}`)).status).toBe(404);
    const day = (await agent.get(`/api/roadmaps/${roadmapId}/day/1`)).body.day;
    expect((await other.patch(`/api/progress/${day.id}`).send({ problemId: day.problems[0].problemId, solvingStatus: 'solved-independently' })).status).toBe(404);
    expect((await other.post('/api/problems/replace').send({ roadmapId, dayNumber: 1, problemId: day.problems[0].problemId })).status).toBe(404);
    expect((await other.get('/api/roadmaps')).body.roadmaps).toHaveLength(0);
    expect((await other.get('/api/contests/history')).body.contests).toHaveLength(0);
  });

  it('returns 404 for malformed ids', async () => {
    expect((await agent.get('/api/roadmaps/not-an-id')).status).toBe(400);
    expect((await agent.patch('/api/progress/zzz').send({ problemId: '1A' })).status).toBe(400);
  });

  it('deletes the account and all associated data after password confirmation', async () => {
    expect((await agent.delete('/api/auth/me').send({ password: 'wrong-password' })).status).toBe(401);
    const res = await agent.delete('/api/auth/me').send({ password: 'correct-horse-battery' });
    expect(res.status).toBe(200);
    expect(await Roadmap.countDocuments({ _id: roadmapId })).toBe(0);
    expect(await DailyPlan.countDocuments({ roadmapId })).toBe(0);
    expect(await Progress.countDocuments({ roadmapId })).toBe(0);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
