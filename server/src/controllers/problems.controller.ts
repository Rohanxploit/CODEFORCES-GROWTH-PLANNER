import type { RequestHandler } from 'express';
import type { CatalogProblemDTO } from '@cgp/shared';
import { User } from '../models/User.js';
import { currentUserId } from '../middleware/auth.js';
import { getServices } from '../services/container.js';
import { replaceProblem } from '../services/roadmap.service.js';
import { AppError } from '../utils/AppError.js';
import { toDayDTO, toUserDTO } from '../utils/dto.js';
import { excludeProblemSchema, problemSearchSchema, replaceProblemSchema } from '../validators/index.js';

export const search: RequestHandler = async (req, res) => {
  const { tags, min, max, q, limit } = problemSearchSchema.parse(req.query);
  const snapshot = await getServices().catalog.getSnapshot();
  const tagList = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const query = q?.trim().toLowerCase();

  const results: CatalogProblemDTO[] = [];
  for (const p of snapshot.problems) {
    if (min !== undefined && (p.rating === null || p.rating < min)) continue;
    if (max !== undefined && (p.rating === null || p.rating > max)) continue;
    if (tagList.length && !tagList.every((t) => p.tags.includes(t))) continue;
    if (query && !p.name.toLowerCase().includes(query) && p.problemId.toLowerCase() !== query) continue;
    results.push(p);
    if (results.length >= limit) break;
  }
  res.json({ problems: results, catalogUpdatedAt: snapshot.updatedAt.toISOString(), stale: snapshot.stale });
};

/** Manual "already solved / exclude". Optionally swaps it out of a roadmap day. */
export const exclude: RequestHandler = async (req, res) => {
  const { problemId, roadmapId, dayNumber } = excludeProblemSchema.parse(req.body);
  const userId = currentUserId(req);
  if (roadmapId && dayNumber) {
    const day = await replaceProblem(userId, roadmapId, dayNumber, problemId, true);
    const user = await User.findById(userId);
    res.json({ user: user ? toUserDTO(user) : null, day: toDayDTO(day) });
    return;
  }
  const user = await User.findByIdAndUpdate(userId, { $addToSet: { excludedProblemIds: problemId } }, { new: true });
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Please log in');
  res.json({ user: toUserDTO(user), day: null });
};

export const replace: RequestHandler = async (req, res) => {
  const { roadmapId, dayNumber, problemId } = replaceProblemSchema.parse(req.body);
  const day = await replaceProblem(currentUserId(req), roadmapId, dayNumber, problemId);
  res.json({ day: toDayDTO(day) });
};
