import { Router } from 'express';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import * as auth from '../controllers/auth.controller.js';
import * as goals from '../controllers/goals.controller.js';
import * as roadmaps from '../controllers/roadmap.controller.js';
import * as problems from '../controllers/problems.controller.js';
import * as progress from '../controllers/progress.controller.js';
import * as contests from '../controllers/contests.controller.js';
import * as analytics from '../controllers/analytics.controller.js';
import { healthRouter } from './health.routes.js';

export function createApiRouter(): Router {
  const api = Router();
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: env.AUTH_RATE_LIMIT });

  api.use('/health', healthRouter);

  // Auth
  api.post('/auth/register', authLimiter, auth.register);
  api.post('/auth/login', authLimiter, auth.login);
  api.post('/auth/logout', auth.logout);
  api.get('/auth/me', requireAuth, auth.me);
  api.patch('/auth/me', requireAuth, auth.updateMe);
  api.delete('/auth/me', requireAuth, authLimiter, auth.deleteMe);
  api.delete('/auth/me/excluded/:problemId', requireAuth, auth.removeExcludedProblem);

  // Goals (pure calculation, public so the landing page can preview it)
  api.post('/goals/analyze', goals.analyzeGoal);
  api.post('/goals/recommend', goals.recommend);

  // Codeforces profile lookup
  api.get('/codeforces/:handle', requireAuth, goals.codeforcesProfile);

  // Roadmaps
  api.post('/roadmaps/generate', requireAuth, roadmaps.generate);
  api.get('/roadmaps', requireAuth, roadmaps.list);
  api.get('/roadmaps/:id', requireAuth, roadmaps.getOne);
  api.patch('/roadmaps/:id', requireAuth, roadmaps.update);
  api.delete('/roadmaps/:id', requireAuth, roadmaps.remove);
  api.get('/roadmaps/:id/today', requireAuth, roadmaps.today);
  api.get('/roadmaps/:id/day/:dayNumber', requireAuth, roadmaps.day);

  // Problems
  api.get('/problems', requireAuth, problems.search);
  api.post('/problems/exclude', requireAuth, problems.exclude);
  api.post('/problems/replace', requireAuth, problems.replace);

  // Progress (:id = daily plan id)
  api.patch('/progress/:id', requireAuth, progress.updateProgress);
  api.patch('/progress/:id/status', requireAuth, progress.updateDayStatus);
  api.post('/progress/:id/feedback', requireAuth, progress.feedback);

  // Contests
  api.get('/contests', requireAuth, contests.overview);
  api.post('/contests', requireAuth, contests.record);
  api.get('/contests/history', requireAuth, contests.history);
  api.patch('/contests/:id', requireAuth, contests.updateRecord);
  api.delete('/contests/:id', requireAuth, contests.removeRecord);

  // Analytics
  api.get('/analytics/:roadmapId', requireAuth, analytics.analytics);
  api.get('/analytics/:roadmapId/weekly-review', requireAuth, analytics.weeklyReview);

  return api;
}
