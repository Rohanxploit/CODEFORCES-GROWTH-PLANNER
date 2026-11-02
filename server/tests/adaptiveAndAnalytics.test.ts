import { describe, expect, it } from 'vitest';
import type { DayFeedback } from '@cgp/shared';
import { dayScore, evaluateAdaptation } from '../src/services/adaptiveLearning.service.js';
import { computeAnalytics, computeWeeklyReview, dayNumberFor } from '../src/services/analytics.service.js';
import { deriveDayStatus } from '../src/services/progress.service.js';
import { suggestVirtualContests, suitableDivisions, toUpcoming } from '../src/services/contest.service.js';
import type { RawContest } from '../src/services/codeforces.service.js';

const fb = (dayNumber: number, ...feedback: DayFeedback[]) => ({ dayNumber, topic: `T${dayNumber}`, feedback });

describe('evaluateAdaptation', () => {
  it('does nothing on a single response', () => {
    expect(evaluateAdaptation([fb(1, 'too-easy')], 0).action).toBe('none');
    expect(evaluateAdaptation([fb(1, 'too-difficult')], 0).action).toBe('none');
  });

  it('increases after repeated "too easy"', () => {
    const d = evaluateAdaptation([fb(1, 'too-easy'), fb(2, 'too-easy'), fb(3, 'too-easy')], 0);
    expect(d.action).toBe('increase');
    expect(d.newOffset).toBe(100);
  });

  it('decreases after repeated "too difficult"', () => {
    const d = evaluateAdaptation([fb(1, 'too-difficult'), fb(2, 'too-difficult'), fb(3, 'too-difficult', 'need-more-examples')], 0);
    expect(d.action).toBe('decrease');
    expect(d.newOffset).toBe(-100);
  });

  it('maintains difficulty for mixed or appropriate feedback', () => {
    expect(evaluateAdaptation([fb(1, 'too-easy'), fb(2, 'appropriate'), fb(3, 'too-difficult'), fb(4, 'appropriate')], 0).action).toBe('none');
  });

  it('respects the offset limits', () => {
    const easy = [fb(1, 'too-easy'), fb(2, 'too-easy'), fb(3, 'too-easy')];
    expect(evaluateAdaptation(easy, 200).action).toBe('none');
  });

  it('adds revision when revision is requested repeatedly', () => {
    const d = evaluateAdaptation([fb(1, 'need-revision'), fb(2, 'appropriate'), fb(3, 'need-more-examples')], 0);
    expect(d.action).toBe('revision');
    expect(d.revisionTopics).toEqual(['T1', 'T3']);
  });

  it('only counts feedback after the last adaptation', () => {
    const history = [fb(1, 'too-easy'), fb(2, 'too-easy'), fb(3, 'too-easy'), fb(4, 'too-easy')];
    expect(evaluateAdaptation(history, 100, 3).action).toBe('none');
  });

  it('uses a rolling window of recent days', () => {
    const history = [fb(1, 'too-difficult'), fb(2, 'too-difficult'), fb(3, 'too-easy'), fb(4, 'too-easy'), fb(5, 'too-easy'), fb(6, 'too-easy'), fb(7, 'too-easy')];
    expect(evaluateAdaptation(history, 0).action).toBe('increase');
  });

  it('clamps day scores', () => {
    expect(dayScore(['too-easy', 'understood'])).toBe(1);
    expect(dayScore(['too-difficult', 'need-revision'])).toBe(-1);
  });
});

const problem = (problemId: string, mandatory: boolean, rating = 1200) => ({
  problemId,
  contestId: 1,
  index: 'A',
  name: problemId,
  rating,
  tags: [],
  solvedCount: null,
  url: '',
  role: mandatory ? ('core' as const) : ('stretch' as const),
  mandatory,
  reason: '',
  estimatedMinutes: 30,
});

describe('deriveDayStatus', () => {
  const day = { status: 'pending' as const, problems: [problem('1A', true), problem('2A', true), problem('3A', false)] };

  it('is pending with no outcomes, in progress with some, complete when all mandatory have outcomes', () => {
    expect(deriveDayStatus(day, [])).toBe('pending');
    expect(deriveDayStatus(day, [{ problemId: '1A', solvingStatus: 'solved-independently' }])).toBe('in-progress');
    expect(
      deriveDayStatus(day, [
        { problemId: '1A', solvingStatus: 'solved-independently' },
        { problemId: '2A', solvingStatus: 'unable-to-solve' },
      ]),
    ).toBe('completed');
  });

  it('keeps an explicitly skipped day skipped', () => {
    expect(deriveDayStatus({ ...day, status: 'skipped' }, [])).toBe('skipped');
  });
});

describe('analytics', () => {
  const days = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    dayNumber: n,
    date: `2026-01-0${n}`.replace('-010', '-10'),
    week: n <= 7 ? 1 : 2,
    type: n === 7 ? ('rest' as const) : ('learn' as const),
    topic: n <= 3 ? 'Greedy' : 'Sorting',
    topicId: null,
    difficulty: { min: 1100, max: 1300 },
    problems: n === 7 ? [] : [problem(`${n}A`, true, 1100 + n * 10), problem(`${n}B`, false, 1500)],
    status: n <= 2 || n === 4 ? ('completed' as const) : ('pending' as const),
    feedback: n === 1 ? (['too-easy'] as DayFeedback[]) : [],
  }));
  const progress = [
    { dayNumber: 1, problemId: '1A', problemRating: 1110, solvingStatus: 'solved-independently' as const, completedAt: new Date() },
    { dayNumber: 1, problemId: '1B', problemRating: 1500, solvingStatus: 'solved-with-hint' as const, completedAt: new Date() },
    { dayNumber: 2, problemId: '2A', problemRating: 1120, solvingStatus: 'solved-with-editorial' as const, completedAt: new Date() },
    { dayNumber: 4, problemId: '4A', problemRating: 1140, solvingStatus: 'unable-to-solve' as const, completedAt: new Date() },
  ];

  it('separates solving outcomes and reports the highest independent solve', () => {
    const a = computeAnalytics('r', days, progress, [], 5);
    expect(a.totals.studyDays).toBe(7);
    expect(a.totals.completedDays).toBe(3);
    expect(a.totals.problemsSolved).toBe(3);
    expect(a.solvingBreakdown['solved-independently']).toBe(1);
    expect(a.solvingBreakdown['unable-to-solve']).toBe(1);
    expect(a.highestIndependentlySolved).toBe(1110);
    expect(a.consistency.longestStreak).toBe(2);
    expect(a.topics.find((t) => t.topic === 'Greedy')!.solved).toBe(3);
  });

  it('keeps contest results separate from practice', () => {
    const a = computeAnalytics('r', days, [], [{ contestName: 'R1', contestDate: '2026-01-04', kind: 'rated', newRating: 1250, upsolvedProblems: 2 }], 5);
    expect(a.totals.problemsSolved).toBe(0);
    expect(a.contests.rated).toBe(1);
    expect(a.contests.upsolved).toBe(2);
  });

  it('builds a weekly review with pending tasks and next week', () => {
    const r = computeWeeklyReview(1, days, progress, [], 5);
    expect(r.independentSolves).toBe(1);
    expect(r.hintSolves).toBe(1);
    expect(r.editorialSolves).toBe(1);
    expect(r.pendingTasks.map((t) => t.problemId)).toEqual(['3A', '5A']);
    expect(r.feedbackSummary['too-easy']).toBe(1);
    expect(r.nextWeek).toHaveLength(1);
  });

  it('computes day numbers across months', () => {
    expect(dayNumberFor('2026-01-30', '2026-02-02')).toBe(4);
  });
});

describe('contest suggestions', () => {
  const contests: RawContest[] = [
    { id: 1, name: 'Codeforces Round 900 (Div. 4)', type: 'ICPC', phase: 'FINISHED', durationSeconds: 8400, startTimeSeconds: 100 },
    { id: 2, name: 'Codeforces Round 901 (Div. 3)', type: 'ICPC', phase: 'FINISHED', durationSeconds: 8400, startTimeSeconds: 200 },
    { id: 3, name: 'Codeforces Round 902 (Div. 1)', type: 'CF', phase: 'FINISHED', durationSeconds: 7200, startTimeSeconds: 300 },
    { id: 4, name: 'Educational Codeforces Round 150', type: 'ICPC', phase: 'FINISHED', durationSeconds: 7200, startTimeSeconds: 400 },
    { id: 5, name: 'Codeforces Round 903 (Div. 2)', type: 'CF', phase: 'BEFORE', durationSeconds: 7200, startTimeSeconds: 4_000_000_000 },
  ];

  it('suggests divisions by rating only', () => {
    expect(suitableDivisions(1000).test('Codeforces Round (Div. 4)')).toBe(true);
    expect(suitableDivisions(2000).test('Codeforces Round (Div. 4)')).toBe(false);
    expect(suggestVirtualContests(contests, 1000, new Set()).map((c) => c.id)).toEqual([2, 1]);
    expect(suggestVirtualContests(contests, 1500, new Set([4])).map((c) => c.id)).toEqual([2]);
  });

  it('lists only future contests as upcoming', () => {
    expect(toUpcoming(contests).map((c) => c.id)).toEqual([5]);
  });
});
