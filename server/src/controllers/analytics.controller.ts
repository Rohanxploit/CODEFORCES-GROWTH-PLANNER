import type { RequestHandler } from 'express';
import { z } from 'zod';
import { DailyPlan } from '../models/DailyPlan.js';
import { Progress } from '../models/Progress.js';
import { Contest } from '../models/Contest.js';
import { currentUserId } from '../middleware/auth.js';
import { computeAnalytics, computeWeeklyReview } from '../services/analytics.service.js';
import { currentDayNumber, findOwnedRoadmap } from '../services/roadmap.service.js';
import { toContestDTO } from '../utils/dto.js';
import { dateQuerySchema, weekQuerySchema } from '../validators/index.js';

const roadmapParam = z.object({ roadmapId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id') });

async function load(userId: ReturnType<typeof currentUserId>, roadmapId: string) {
  const roadmap = await findOwnedRoadmap(userId, roadmapId);
  const [days, progress, contests] = await Promise.all([
    DailyPlan.find({ roadmapId: roadmap._id }).sort({ dayNumber: 1 }),
    Progress.find({ roadmapId: roadmap._id, userId }),
    Contest.find({ userId, contestDate: { $gte: roadmap.startDate, $lte: roadmap.endDate } }),
  ]);
  return { roadmap, days, progress, contests };
}

export const analytics: RequestHandler = async (req, res) => {
  const { roadmapId } = roadmapParam.parse(req.params);
  const { date } = dateQuerySchema.parse(req.query);
  const { roadmap, days, progress, contests } = await load(currentUserId(req), roadmapId);
  res.json(computeAnalytics(roadmapId, days, progress, contests, currentDayNumber(roadmap, date)));
};

export const weeklyReview: RequestHandler = async (req, res) => {
  const { roadmapId } = roadmapParam.parse(req.params);
  const { week, date } = weekQuerySchema.parse(req.query);
  const { roadmap, days, progress, contests } = await load(currentUserId(req), roadmapId);
  const currentDay = currentDayNumber(roadmap, date);
  const selectedWeek = week ?? Math.ceil(currentDay / 7);
  res.json(computeWeeklyReview(selectedWeek, days, progress, contests.map(toContestDTO), currentDay));
};
