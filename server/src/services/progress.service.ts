import type { Types } from 'mongoose';
import type { AdaptationEntry, DayFeedback, DayStatus, SolvingStatus } from '@cgp/shared';
import { DailyPlan, type IDailyPlan } from '../models/DailyPlan.js';
import { Progress, type IProgress } from '../models/Progress.js';
import { Roadmap } from '../models/Roadmap.js';
import { AppError } from '../utils/AppError.js';
import { evaluateAdaptation } from './adaptiveLearning.service.js';
import { isSolved } from './analytics.service.js';
import { findOwnedDay, regenerateFrom, todayIso } from './roadmap.service.js';

export interface ProgressUpdate {
  problemId: string;
  solvingStatus?: SolvingStatus;
  editorialUsed?: boolean;
  hintRevealed?: boolean;
  timeTakenMinutes?: number | null;
  confidence?: number | null;
  notes?: string;
}

/** A day is complete once every mandatory problem has an outcome (solved or not). */
export function deriveDayStatus(day: Pick<IDailyPlan, 'problems' | 'status'>, progress: Pick<IProgress, 'problemId' | 'solvingStatus'>[]): DayStatus {
  if (day.status === 'skipped') return 'skipped';
  const statusOf = new Map(progress.map((p) => [p.problemId, p.solvingStatus]));
  const mandatory = day.problems.filter((p) => p.mandatory);
  const attempted = progress.filter((p) => p.solvingStatus !== 'not-attempted');
  if (mandatory.length > 0 && mandatory.every((p) => (statusOf.get(p.problemId) ?? 'not-attempted') !== 'not-attempted')) return 'completed';
  if (attempted.length > 0) return 'in-progress';
  return mandatory.length === 0 && day.status === 'completed' ? 'completed' : 'pending';
}

export async function updateProblemProgress(userId: Types.ObjectId, dailyPlanId: string, update: ProgressUpdate) {
  const day = await findOwnedDay(userId, dailyPlanId);
  const problem = day.problems.find((p) => p.problemId === update.problemId);
  if (!problem) throw new AppError(404, 'NOT_FOUND', 'That problem is not assigned on this day');

  const set: Partial<IProgress> = {};
  if (update.solvingStatus !== undefined) {
    set.solvingStatus = update.solvingStatus;
    set.independentSolve = update.solvingStatus === 'solved-independently';
    set.completedAt = isSolved(update.solvingStatus) || update.solvingStatus === 'unable-to-solve' ? new Date() : null;
    if (update.solvingStatus === 'solved-with-editorial') set.editorialUsed = true;
  }
  if (update.editorialUsed !== undefined) set.editorialUsed = update.editorialUsed;
  if (update.hintRevealed !== undefined) set.hintRevealed = update.hintRevealed;
  if (update.timeTakenMinutes !== undefined) set.timeTaken = update.timeTakenMinutes;
  if (update.confidence !== undefined) set.confidence = update.confidence;
  if (update.notes !== undefined) set.notes = update.notes;
  // Using the editorial means the solve was not independent.
  if (set.editorialUsed && (set.solvingStatus ?? '') === 'solved-independently') {
    throw new AppError(400, 'VALIDATION_ERROR', "A solve that used the editorial can't be recorded as independent");
  }

  await Progress.findOneAndUpdate(
    { dailyPlanId: day._id, problemId: problem.problemId, userId },
    {
      $set: set,
      $setOnInsert: { roadmapId: day.roadmapId, dayNumber: day.dayNumber, problemRating: problem.rating },
    },
    { upsert: true, runValidators: true },
  );

  const progress = await Progress.find({ dailyPlanId: day._id, userId });
  day.status = deriveDayStatus(day, progress);
  await day.save();
  return { day, progress };
}

export async function setDayStatus(userId: Types.ObjectId, dailyPlanId: string, status: 'pending' | 'completed' | 'skipped') {
  const day = await findOwnedDay(userId, dailyPlanId);
  const progress = await Progress.find({ dailyPlanId: day._id, userId });
  if (status === 'completed' && day.problems.some((p) => p.mandatory)) {
    const derived = deriveDayStatus({ ...day.toObject(), status: 'pending' }, progress);
    if (derived !== 'completed') throw new AppError(400, 'INCOMPLETE_DAY', 'Record an outcome for each mandatory problem first');
  }
  day.status = status === 'pending' ? deriveDayStatus({ ...day.toObject(), status: 'pending' }, progress) : status;
  await day.save();
  return { day, progress };
}

/**
 * Stores the day's feedback, then evaluates rolling feedback. A difficulty
 * change regenerates the untouched future days; a revision signal adds
 * revision tasks to the next study days.
 */
export async function submitFeedback(userId: Types.ObjectId, dailyPlanId: string, feedback: DayFeedback[]) {
  const day = await findOwnedDay(userId, dailyPlanId);
  day.feedback = [...new Set(feedback)];
  day.feedbackAt = new Date();
  await day.save();

  const roadmap = await Roadmap.findOne({ _id: day.roadmapId, userId });
  if (!roadmap) throw new AppError(404, 'NOT_FOUND', 'Roadmap not found');

  const history = await DailyPlan.find({ roadmapId: roadmap._id, feedback: { $ne: [] } }, { dayNumber: 1, topic: 1, feedback: 1 });
  const lastChange = [...roadmap.adaptations].reverse().find((a) => a.change !== 'revision');
  const lastRevision = [...roadmap.adaptations].reverse().find((a) => a.change === 'revision');
  const decision = evaluateAdaptation(
    history.map((d) => ({ dayNumber: d.dayNumber, topic: d.topic, feedback: d.feedback })),
    roadmap.difficultyOffset,
    Math.max(lastChange ? lastChange.fromDay - 1 : 0, lastRevision ? lastRevision.fromDay - 1 : 0),
  );

  let adaptation: AdaptationEntry | null = null;
  const fromDay = day.dayNumber + 1;
  if (decision.action !== 'none' && fromDay <= roadmap.duration) {
    adaptation = { date: todayIso(), fromDay, change: decision.action, offset: decision.newOffset, reason: decision.reason };
    if (decision.action === 'increase' || decision.action === 'decrease') {
      roadmap.difficultyOffset = decision.newOffset;
      roadmap.adaptations.push(adaptation);
      await roadmap.save();
      await regenerateFrom(roadmap, fromDay);
    } else {
      const upcoming = await DailyPlan.find({ roadmapId: roadmap._id, dayNumber: { $gte: fromDay }, type: { $in: ['learn', 'practice', 'revision'] } })
        .sort({ dayNumber: 1 })
        .limit(2);
      for (const next of upcoming) {
        next.revisionTasks.push(
          `Extra revision (from your feedback): revisit ${decision.revisionTopics.join(', ')}. Re-read the concept and solve one earlier problem again without notes.`,
        );
        await next.save();
      }
      roadmap.adaptations.push(adaptation);
      await roadmap.save();
    }
  }

  const progress = await Progress.find({ dailyPlanId: day._id, userId });
  return { day, progress, adaptation };
}
