import type { RequestHandler } from 'express';
import { assessGoal, recommendGoals } from '../services/goalEngine.service.js';
import { classifyRating } from '../services/ratingLevel.service.js';
import { getServices } from '../services/container.js';
import { goalAnalyzeSchema, goalRecommendSchema } from '../validators/index.js';

export const analyzeGoal: RequestHandler = (req, res) => {
  const { currentRating, targetRating } = goalAnalyzeSchema.parse(req.body);
  res.json(assessGoal(currentRating, targetRating));
};

export const recommend: RequestHandler = (req, res) => {
  const { currentRating } = goalRecommendSchema.parse(req.body);
  res.json({ level: classifyRating(currentRating), goals: recommendGoals(currentRating) });
};

/** Profile lookup. Only rating/rank are read; submissions are never requested. */
export const codeforcesProfile: RequestHandler = async (req, res) => {
  const profile = await getServices().codeforces.getUserInfo(String(req.params.handle));
  res.json({ profile, level: profile.rating !== null ? classifyRating(profile.rating) : null });
};
