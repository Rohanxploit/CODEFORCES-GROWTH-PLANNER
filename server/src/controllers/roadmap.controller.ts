import type { RequestHandler } from 'express';
import { Roadmap } from '../models/Roadmap.js';
import { DailyPlan } from '../models/DailyPlan.js';
import { Progress } from '../models/Progress.js';
import { currentUserId } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import { toDayDTO, toDaySummaryDTO, toRoadmapDTO } from '../utils/dto.js';
import { createRoadmap, currentDayNumber, findOwnedRoadmap, regenerateFrom } from '../services/roadmap.service.js';
import { assessGoal } from '../services/goalEngine.service.js';
import { defaultMandatoryProblems } from '../services/roadmapGenerator.service.js';
import { calculateBenchmark } from '../services/problemBenchmark.service.js';
import { dateQuerySchema, dayParam, generateRoadmapSchema, idParam, updateRoadmapSchema } from '../validators/index.js';

export const generate: RequestHandler = async (req, res) => {
  const input = generateRoadmapSchema.parse(req.body);
  const { roadmap, assessment, notes } = await createRoadmap(currentUserId(req), input);
  res.status(201).json({ roadmap: toRoadmapDTO(roadmap), assessment, notes });
};

export const list: RequestHandler = async (req, res) => {
  const roadmaps = await Roadmap.find({ userId: currentUserId(req) }).sort({ createdAt: -1 });
  res.json({ roadmaps: roadmaps.map(toRoadmapDTO) });
};

export const getOne: RequestHandler = async (req, res) => {
  const { id } = idParam.parse(req.params);
  const roadmap = await findOwnedRoadmap(currentUserId(req), id);
  const days = await DailyPlan.find({ roadmapId: roadmap._id }).sort({ dayNumber: 1 });
  res.json({ roadmap: toRoadmapDTO(roadmap), days: days.map(toDaySummaryDTO), notes: roadmap.notes, topics: roadmap.topics });
};

async function sendDay(res: Parameters<RequestHandler>[1], roadmapId: string, userId: ReturnType<typeof currentUserId>, dayNumber: number, extra: object = {}) {
  const roadmap = await findOwnedRoadmap(userId, roadmapId);
  const day = await DailyPlan.findOne({ roadmapId: roadmap._id, dayNumber });
  if (!day) throw new AppError(404, 'NOT_FOUND', 'Day not found');
  const progress = await Progress.find({ dailyPlanId: day._id, userId });
  res.json({ day: toDayDTO(day, progress), roadmap: toRoadmapDTO(roadmap), ...extra });
}

export const today: RequestHandler = async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { date } = dateQuerySchema.parse(req.query);
  const userId = currentUserId(req);
  const roadmap = await findOwnedRoadmap(userId, id);
  const dayNumber = currentDayNumber(roadmap, date);
  await sendDay(res, id, userId, dayNumber, { currentDay: dayNumber });
};

export const day: RequestHandler = async (req, res) => {
  const { id, dayNumber } = dayParam.parse(req.params);
  await sendDay(res, id, currentUserId(req), dayNumber);
};

/** Settings change: updates the roadmap and regenerates untouched days from today. */
export const update: RequestHandler = async (req, res) => {
  const { id } = idParam.parse(req.params);
  const input = updateRoadmapSchema.parse(req.body);
  const { date } = dateQuerySchema.parse(req.query);
  const userId = currentUserId(req);
  const roadmap = await findOwnedRoadmap(userId, id);

  if (input.status) {
    if (input.status === 'active') await Roadmap.updateMany({ userId, status: 'active', _id: { $ne: roadmap._id } }, { $set: { status: 'archived' } });
    roadmap.status = input.status;
  }

  const planChanged = (['targetRating', 'hoursPerDay', 'daysPerWeek', 'contestParticipation', 'mandatoryProblems'] as const).some((k) => input[k] !== undefined);
  if (input.targetRating !== undefined) {
    const a = assessGoal(roadmap.startingRating, input.targetRating);
    roadmap.targetRating = input.targetRating;
    roadmap.goalDifficulty = a.difficulty;
    roadmap.problemSolvingBenchmark = calculateBenchmark(input.targetRating);
  }
  if (input.hoursPerDay !== undefined) roadmap.hoursPerDay = input.hoursPerDay;
  if (input.daysPerWeek !== undefined) roadmap.daysPerWeek = input.daysPerWeek;
  if (input.contestParticipation !== undefined) roadmap.contestParticipation = input.contestParticipation;
  if (input.mandatoryProblems !== undefined) roadmap.mandatoryProblemsOverride = input.mandatoryProblems;
  roadmap.mandatoryProblems = roadmap.mandatoryProblemsOverride ?? defaultMandatoryProblems(roadmap.hoursPerDay);
  await roadmap.save();

  const regeneratedDays = planChanged ? await regenerateFrom(roadmap, currentDayNumber(roadmap, date)) : 0;
  res.json({ roadmap: toRoadmapDTO(roadmap), regeneratedDays });
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = idParam.parse(req.params);
  const userId = currentUserId(req);
  const roadmap = await findOwnedRoadmap(userId, id);
  await Promise.all([Progress.deleteMany({ roadmapId: roadmap._id, userId }), DailyPlan.deleteMany({ roadmapId: roadmap._id, userId })]);
  await Roadmap.deleteOne({ _id: roadmap._id, userId });
  res.json({ ok: true });
};
