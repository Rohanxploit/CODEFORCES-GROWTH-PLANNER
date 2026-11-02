import type { AnalyticsDTO, ContestRecordDTO, DayFeedback, SolvingStatus, WeeklyReviewDTO } from '@cgp/shared';
import type { IDailyPlan } from '../models/DailyPlan.js';
import type { IProgress } from '../models/Progress.js';
import type { IContest } from '../models/Contest.js';

// Pure analytics over a roadmap's days, user-reported progress and contest
// records. Problem-solving progress is kept separate from contest rating.

type Day = Pick<IDailyPlan, 'dayNumber' | 'date' | 'week' | 'type' | 'topic' | 'topicId' | 'difficulty' | 'problems' | 'status' | 'feedback'>;
type ProgressRow = Pick<IProgress, 'dayNumber' | 'problemId' | 'problemRating' | 'solvingStatus' | 'completedAt'>;
type ContestRow = Pick<IContest, 'contestName' | 'contestDate' | 'kind' | 'newRating' | 'upsolvedProblems'>;

const SOLVED: readonly SolvingStatus[] = ['solved-independently', 'solved-with-hint', 'solved-with-editorial'];

export const isSolved = (s: SolvingStatus) => SOLVED.includes(s);
const isStudyDay = (d: Day) => d.type !== 'rest';

export function dayNumberFor(startDate: string, date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  return Math.floor(ms / 86_400_000) + 1;
}

export function computeAnalytics(roadmapId: string, days: Day[], progress: ProgressRow[], contests: ContestRow[], currentDay: number): AnalyticsDTO {
  const studyDays = days.filter(isStudyDay);
  const completed = studyDays.filter((d) => d.status === 'completed');
  const mandatory = studyDays.reduce((n, d) => n + d.problems.filter((p) => p.mandatory).length, 0);

  const breakdown: Record<SolvingStatus, number> = {
    'not-attempted': 0,
    'solved-independently': 0,
    'solved-with-hint': 0,
    'solved-with-editorial': 0,
    'unable-to-solve': 0,
  };
  for (const p of progress) breakdown[p.solvingStatus]++;
  const assigned = days.reduce((n, d) => n + d.problems.length, 0);
  breakdown['not-attempted'] = Math.max(0, assigned - progress.filter((p) => p.solvingStatus !== 'not-attempted').length);
  const solved = progress.filter((p) => isSolved(p.solvingStatus));

  // Streaks over study days up to today: a day counts once it is completed.
  let current = 0;
  let longest = 0;
  let run = 0;
  for (const d of studyDays.filter((x) => x.dayNumber <= currentDay)) {
    if (d.status === 'completed') {
      run++;
      longest = Math.max(longest, run);
    } else if (d.dayNumber < currentDay) {
      run = 0;
    }
  }
  current = run;
  const activeDays = new Set(progress.filter((p) => p.solvingStatus !== 'not-attempted').map((p) => p.dayNumber)).size;

  const weeks = [...new Set(days.map((d) => d.week))].sort((a, b) => a - b);
  const solvedByDay = new Map<number, number>();
  for (const p of solved) solvedByDay.set(p.dayNumber, (solvedByDay.get(p.dayNumber) ?? 0) + 1);

  const weekly = weeks.map((week) => {
    const inWeek = studyDays.filter((d) => d.week === week);
    return {
      week,
      plannedDays: inWeek.length,
      completedDays: inWeek.filter((d) => d.status === 'completed').length,
      solved: inWeek.reduce((n, d) => n + (solvedByDay.get(d.dayNumber) ?? 0), 0),
    };
  });

  const topicMap = new Map<string, { topic: string; days: number; completedDays: number; solved: number; assigned: number }>();
  for (const d of studyDays.filter((x) => x.type === 'learn')) {
    const t = topicMap.get(d.topic) ?? { topic: d.topic, days: 0, completedDays: 0, solved: 0, assigned: 0 };
    t.days++;
    if (d.status === 'completed') t.completedDays++;
    t.solved += solvedByDay.get(d.dayNumber) ?? 0;
    t.assigned += d.problems.length;
    topicMap.set(d.topic, t);
  }

  const independentByDay = new Map<number, number[]>();
  for (const p of solved) {
    const list = independentByDay.get(p.dayNumber) ?? [];
    list.push(p.problemRating);
    independentByDay.set(p.dayNumber, list);
  }
  const difficultyProgression = studyDays
    .filter((d) => d.problems.length > 0)
    .map((d) => {
      const ratings = independentByDay.get(d.dayNumber);
      return {
        day: d.dayNumber,
        plannedMin: d.difficulty.min,
        plannedMax: d.difficulty.max,
        solvedRating: ratings ? Math.max(...ratings) : null,
      };
    });

  const independent = progress.filter((p) => p.solvingStatus === 'solved-independently');
  const sortedContests = contests.slice().sort((a, b) => a.contestDate.localeCompare(b.contestDate));

  return {
    roadmapId,
    currentDay,
    totals: {
      studyDays: studyDays.length,
      completedDays: completed.length,
      completionPercent: studyDays.length ? Math.round((completed.length / studyDays.length) * 100) : 0,
      mandatoryProblems: mandatory,
      problemsAttempted: progress.filter((p) => p.solvingStatus !== 'not-attempted').length,
      problemsSolved: solved.length,
    },
    consistency: { currentStreak: current, longestStreak: longest, activeDays },
    weekly,
    topics: [...topicMap.values()],
    solvingBreakdown: breakdown,
    difficultyProgression,
    highestIndependentlySolved: independent.length ? Math.max(...independent.map((p) => p.problemRating)) : null,
    contests: {
      participated: contests.length,
      rated: contests.filter((c) => c.kind === 'rated').length,
      virtual: contests.filter((c) => c.kind === 'virtual').length,
      upsolved: contests.reduce((n, c) => n + c.upsolvedProblems, 0),
      history: sortedContests.map((c) => ({ date: c.contestDate, name: c.contestName, newRating: c.newRating, kind: c.kind })),
    },
  };
}

export function computeWeeklyReview(
  week: number,
  days: Day[],
  progress: ProgressRow[],
  contests: ContestRecordDTO[],
  currentDay: number,
): WeeklyReviewDTO {
  const inWeek = days.filter((d) => d.week === week);
  const dayNumbers = new Set(inWeek.map((d) => d.dayNumber));
  const weekProgress = progress.filter((p) => dayNumbers.has(p.dayNumber));
  const statusOf = new Map(weekProgress.map((p) => [`${p.dayNumber}:${p.problemId}`, p.solvingStatus]));

  const feedbackSummary: Partial<Record<DayFeedback, number>> = {};
  for (const d of inWeek) for (const f of d.feedback) feedbackSummary[f] = (feedbackSummary[f] ?? 0) + 1;

  const pendingTasks = inWeek
    .filter((d) => d.dayNumber <= currentDay)
    .flatMap((d) =>
      d.problems
        .filter((p) => p.mandatory && (statusOf.get(`${d.dayNumber}:${p.problemId}`) ?? 'not-attempted') === 'not-attempted')
        .map((p) => ({ dayNumber: d.dayNumber, problemId: p.problemId, name: p.name })),
    );

  const startDate = inWeek[0]?.date ?? '';
  const endDate = inWeek[inWeek.length - 1]?.date ?? '';
  const count = (s: SolvingStatus) => weekProgress.filter((p) => p.solvingStatus === s).length;

  return {
    week,
    startDate,
    endDate,
    topicsCovered: [...new Set(inWeek.filter((d) => d.type !== 'rest').map((d) => d.topic))],
    problemsCompleted: weekProgress.filter((p) => isSolved(p.solvingStatus)).length,
    independentSolves: count('solved-independently'),
    hintSolves: count('solved-with-hint'),
    editorialSolves: count('solved-with-editorial'),
    unableToSolve: count('unable-to-solve'),
    pendingTasks,
    feedbackSummary,
    contests: contests.filter((c) => c.contestDate >= startDate && c.contestDate <= endDate),
    nextWeek: days
      .filter((d) => d.week === week + 1)
      .map((d) => ({ dayNumber: d.dayNumber, date: d.date, type: d.type, topic: d.topic })),
  };
}
