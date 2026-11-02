import type { RequestHandler } from 'express';
import { currentUserId } from '../middleware/auth.js';
import { setDayStatus, submitFeedback, updateProblemProgress } from '../services/progress.service.js';
import { toDayDTO } from '../utils/dto.js';
import { dayStatusSchema, feedbackSchema, idParam, progressUpdateSchema } from '../validators/index.js';

// `:id` is the DailyPlan id.

export const updateProgress: RequestHandler = async (req, res) => {
  const { id } = idParam.parse(req.params);
  const update = progressUpdateSchema.parse(req.body);
  const { day, progress } = await updateProblemProgress(currentUserId(req), id, update);
  res.json({ day: toDayDTO(day, progress) });
};

export const updateDayStatus: RequestHandler = async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { status } = dayStatusSchema.parse(req.body);
  const { day, progress } = await setDayStatus(currentUserId(req), id, status);
  res.json({ day: toDayDTO(day, progress) });
};

export const feedback: RequestHandler = async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { feedback: items } = feedbackSchema.parse(req.body);
  const { day, progress, adaptation } = await submitFeedback(currentUserId(req), id, items);
  res.json({ day: toDayDTO(day, progress), adaptation });
};
