import { randomUUID } from 'node:crypto';
import { Types, type HydratedDocument } from 'mongoose';
import { CHALLENGE_DURATION_DAYS, type AssignedProblem, type GenerateRoadmapInput } from '@cgp/shared';
import { Roadmap, type IRoadmap } from '../models/Roadmap.js';
import { DailyPlan, type IDailyPlan } from '../models/DailyPlan.js';
import { Progress } from '../models/Progress.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { getServices } from './container.js';
import { addDays, generateRoadmap, type DailyPlanDraft } from './roadmapGenerator.service.js';
import { dayNumberFor } from './analytics.service.js';
import { buildSolvedIndex } from './problemSelector/calculateProblemScore.js';
import { ExclusionSet } from './problemSelector/excludePreviouslyAssigned.js';
import { estimateMinutes, selectDailyProblems } from './problemSelector/selectDailyProblems.js';

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function findOwnedRoadmap(userId: Types.ObjectId, roadmapId: string): Promise<HydratedDocument<IRoadmap>> {
  const roadmap = await Roadmap.findOne({ _id: roadmapId, userId });
  if (!roadmap) throw new AppError(404, 'NOT_FOUND', 'Roadmap not found');
  return roadmap;
}

export async function findOwnedDay(userId: Types.ObjectId, dailyPlanId: string): Promise<HydratedDocument<IDailyPlan>> {
  if (!Types.ObjectId.isValid(dailyPlanId)) throw new AppError(404, 'NOT_FOUND', 'Day not found');
  const day = await DailyPlan.findOne({ _id: dailyPlanId, userId });
  if (!day) throw new AppError(404, 'NOT_FOUND', 'Day not found');
  return day;
}

function draftFields(d: DailyPlanDraft) {
  return {
    dayNumber: d.dayNumber,
    date: d.date,
    week: d.week,
    type: d.type,
    phase: d.phase,
    phaseName: d.phaseName,
    topicId: d.topicId,
    topic: d.topic,
    subtopic: d.subtopic,
    objective: d.objective,
    concept: d.concept,
    whyItMatters: d.whyItMatters,
    prerequisites: d.prerequisites,
    topicTags: d.topicTags,
    fallbackTags: d.fallbackTags,
    learnMinutes: d.learnMinutes,
    practiceMinutes: d.practiceMinutes,
    difficulty: d.difficulty,
    stretchDifficulty: d.stretchDifficulty,
    problems: d.problems,
    revisionTasks: d.revisionTasks,
    ifStuck: d.ifStuck,
    notes: d.notes,
  };
}

/**
 * Resolves the starting rating: from Codeforces when a handle is given and the
 * profile is rated, otherwise the manually entered rating.
 */
async function resolveStartingRating(input: GenerateRoadmapInput): Promise<{ rating: number; handle: string | null }> {
  if (input.codeforcesHandle) {
    const profile = await getServices().codeforces.getUserInfo(input.codeforcesHandle);
    if (profile.rating !== null) return { rating: profile.rating, handle: profile.handle };
    if (input.currentRating === undefined) {
      throw new AppError(422, 'UNRATED_PROFILE', `${profile.handle} has no contest rating yet. Enter a starting rating manually (use 0 if you are new).`);
    }
    return { rating: input.currentRating, handle: profile.handle };
  }
  return { rating: input.currentRating!, handle: null };
}

export async function createRoadmap(userId: Types.ObjectId, input: GenerateRoadmapInput) {
  const { rating, handle } = await resolveStartingRating(input);
  const catalog = await getServices().catalog.getProblems();
  const user = await User.findById(userId);
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Please log in');

  const startDate = input.startDate ?? todayIso();
  const seed = randomUUID();
  const generated = generateRoadmap(catalog, {
    startingRating: rating,
    targetRating: input.targetRating,
    hoursPerDay: input.hoursPerDay,
    daysPerWeek: input.daysPerWeek,
    contestParticipation: input.contestParticipation,
    mandatoryProblems: input.mandatoryProblems,
    startDate,
    seed,
    excludedProblemIds: user.excludedProblemIds,
  });
  const a = generated.assessment;

  await Roadmap.updateMany({ userId, status: 'active' }, { $set: { status: 'archived' } });
  const roadmap = await Roadmap.create({
    userId,
    status: 'active',
    codeforcesHandle: handle,
    startingRating: rating,
    startingLevel: { rank: a.current.rank, classification: a.current.classification, needsFundamentals: a.current.needsFundamentals },
    targetRating: input.targetRating,
    conservativeGoal: a.goals.conservative,
    recommendedGoal: a.goals.recommended,
    stretchGoal: a.goals.stretch,
    goalDifficulty: a.difficulty,
    problemSolvingBenchmark: generated.benchmark,
    duration: CHALLENGE_DURATION_DAYS,
    startDate,
    endDate: addDays(startDate, CHALLENGE_DURATION_DAYS - 1),
    hoursPerDay: input.hoursPerDay,
    daysPerWeek: input.daysPerWeek,
    contestParticipation: input.contestParticipation,
    mandatoryProblems: generated.mandatoryProblems,
    mandatoryProblemsOverride: input.mandatoryProblems ?? null,
    seed,
    practiceStart: generated.practiceStart,
    practiceEnd: generated.practiceEnd,
    rampCapped: generated.rampCapped,
    topics: generated.topics,
    notes: [...a.notes, ...generated.notes],
  });

  await DailyPlan.insertMany(generated.days.map((d) => ({ ...draftFields(d), roadmapId: roadmap._id, userId, status: 'pending', feedback: [] })));

  user.currentRating = rating;
  if (handle) user.codeforcesHandle = handle;
  await user.save();

  return { roadmap, assessment: a, notes: generated.notes };
}

/**
 * Regenerates days from `fromDay` onwards, keeping any day the user has
 * started, completed or given feedback on. Kept problems are excluded from
 * the new selection so nothing repeats.
 */
export async function regenerateFrom(roadmap: IRoadmap, fromDay: number): Promise<number> {
  const user = await User.findById(roadmap.userId);
  const days = await DailyPlan.find({ roadmapId: roadmap._id }).sort({ dayNumber: 1 });
  const touched = new Set(
    (await Progress.find({ roadmapId: roadmap._id, solvingStatus: { $ne: 'not-attempted' } }, { dailyPlanId: 1 })).map((p) => p.dailyPlanId.toString()),
  );
  const isKept = (d: IDailyPlan) => d.dayNumber < fromDay || d.status !== 'pending' || d.feedback.length > 0 || touched.has(d._id.toString());
  const kept = days.filter(isKept);
  const replaceable = days.filter((d) => !isKept(d));
  if (replaceable.length === 0) return 0;

  const catalog = await getServices().catalog.getProblems();
  const generated = generateRoadmap(catalog, {
    startingRating: roadmap.startingRating,
    targetRating: roadmap.targetRating,
    hoursPerDay: roadmap.hoursPerDay,
    daysPerWeek: roadmap.daysPerWeek,
    contestParticipation: roadmap.contestParticipation,
    mandatoryProblems: roadmap.mandatoryProblemsOverride ?? undefined,
    startDate: roadmap.startDate,
    seed: roadmap.seed,
    excludedProblemIds: user?.excludedProblemIds ?? [],
    keptProblems: kept.flatMap((d) => d.problems),
    difficultyOffset: roadmap.difficultyOffset,
    offsetFromDay: fromDay,
  });

  await DailyPlan.bulkWrite(
    replaceable.map((d) => ({
      updateOne: {
        filter: { _id: d._id },
        update: { $set: { ...draftFields(generated.days[d.dayNumber - 1]!), status: 'pending', feedback: [], feedbackAt: null } },
      },
    })),
  );
  await Progress.deleteMany({ dailyPlanId: { $in: replaceable.map((d) => d._id) } });
  return replaceable.length;
}

export function currentDayNumber(roadmap: Pick<IRoadmap, 'startDate'>, date = todayIso()): number {
  return Math.min(CHALLENGE_DURATION_DAYS, Math.max(1, dayNumberFor(roadmap.startDate, date)));
}

/** Picks a replacement for one problem on a day with the same selection rules. */
export async function replaceProblem(userId: Types.ObjectId, roadmapId: string, dayNumber: number, problemId: string, alsoExclude = false) {
  const roadmap = await findOwnedRoadmap(userId, roadmapId);
  const day = await DailyPlan.findOne({ roadmapId: roadmap._id, dayNumber, userId });
  if (!day) throw new AppError(404, 'NOT_FOUND', 'Day not found');
  const idx = day.problems.findIndex((p) => p.problemId === problemId);
  if (idx < 0) throw new AppError(404, 'NOT_FOUND', 'That problem is not assigned on this day');
  const old = day.problems[idx]!;

  const user = await User.findById(userId);
  if (alsoExclude && user && !user.excludedProblemIds.includes(problemId)) {
    user.excludedProblemIds.push(problemId);
    await user.save();
  }

  const allDays = await DailyPlan.find({ roadmapId: roadmap._id }, { problems: 1 });
  const exclusion = new ExclusionSet(
    allDays.flatMap((d) => d.problems),
    [...(user?.excludedProblemIds ?? []), problemId],
  );

  const catalog = (await getServices().catalog.getProblems()).filter((p) => p.rating !== null);
  const range = old.role === 'stretch' && day.stretchDifficulty ? day.stretchDifficulty : day.difficulty;
  const { problems } = selectDailyProblems(
    catalog,
    {
      topicName: day.topic,
      topicTags: day.topicTags,
      fallbackTags: day.fallbackTags,
      range,
      stretchRange: null,
      mandatoryCount: 1,
      seed: `${roadmap.seed}:replace:${dayNumber}:${problemId}`,
      maxSolvedByRating: buildSolvedIndex(catalog),
    },
    exclusion,
  );
  const pick = problems[0];
  if (!pick) throw new AppError(409, 'NO_REPLACEMENT', 'No unused problem fits this day. Try again after excluding fewer problems.');

  const replacement: AssignedProblem = {
    problemId: pick.problem.problemId,
    contestId: pick.problem.contestId,
    index: pick.problem.index,
    name: pick.problem.name,
    rating: pick.problem.rating!,
    tags: pick.problem.tags,
    solvedCount: pick.problem.solvedCount,
    url: pick.problem.url,
    role: old.role,
    mandatory: old.mandatory,
    reason: `Replacement for ${old.name}. ${pick.reason}`,
    estimatedMinutes: estimateMinutes(pick.problem.rating!, (range.min + range.max) / 2, old.role),
  };
  day.problems.splice(idx, 1, replacement);
  await day.save();
  await Progress.deleteMany({ dailyPlanId: day._id, problemId });
  return day;
}
