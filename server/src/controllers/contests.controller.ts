import type { RequestHandler } from 'express';
import { Contest } from '../models/Contest.js';
import { Roadmap } from '../models/Roadmap.js';
import { User } from '../models/User.js';
import { currentUserId } from '../middleware/auth.js';
import { getContestOverview } from '../services/contest.service.js';
import { AppError } from '../utils/AppError.js';
import { toContestDTO } from '../utils/dto.js';
import { contestRecordSchema, contestUpdateSchema, idParam } from '../validators/index.js';

export const overview: RequestHandler = async (req, res) => {
  const userId = currentUserId(req);
  const [user, records, roadmap] = await Promise.all([
    User.findById(userId),
    Contest.find({ userId }, { contestId: 1 }),
    Roadmap.findOne({ userId, status: 'active' }).sort({ createdAt: -1 }),
  ]);
  const rating = user?.currentRating ?? roadmap?.startingRating ?? 0;
  const done = new Set(records.map((r) => r.contestId).filter((id): id is number => typeof id === 'number'));
  res.json(await getContestOverview(rating, done));
};

export const record: RequestHandler = async (req, res) => {
  const input = contestRecordSchema.parse(req.body);
  const userId = currentUserId(req);
  if (input.roadmapId && !(await Roadmap.exists({ _id: input.roadmapId, userId }))) {
    throw new AppError(404, 'NOT_FOUND', 'Roadmap not found');
  }
  const contest = await Contest.create({ ...input, userId });
  // A rated result is the user's latest known rating (shown separately from practice progress).
  if (input.kind === 'rated' && typeof input.newRating === 'number') {
    await User.updateOne({ _id: userId }, { $set: { currentRating: input.newRating } });
  }
  res.status(201).json({ contest: toContestDTO(contest) });
};

export const history: RequestHandler = async (req, res) => {
  const contests = await Contest.find({ userId: currentUserId(req) }).sort({ contestDate: -1, createdAt: -1 });
  res.json({ contests: contests.map(toContestDTO) });
};

export const updateRecord: RequestHandler = async (req, res) => {
  const { id } = idParam.parse(req.params);
  const input = contestUpdateSchema.parse(req.body);
  const contest = await Contest.findOneAndUpdate({ _id: id, userId: currentUserId(req) }, { $set: input }, { new: true, runValidators: true });
  if (!contest) throw new AppError(404, 'NOT_FOUND', 'Contest record not found');
  res.json({ contest: toContestDTO(contest) });
};

export const removeRecord: RequestHandler = async (req, res) => {
  const { id } = idParam.parse(req.params);
  const result = await Contest.deleteOne({ _id: id, userId: currentUserId(req) });
  if (result.deletedCount === 0) throw new AppError(404, 'NOT_FOUND', 'Contest record not found');
  res.json({ ok: true });
};
