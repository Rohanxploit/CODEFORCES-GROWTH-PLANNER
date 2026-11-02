import { z } from 'zod';
import { MAX_RATING, MIN_RATING } from '@cgp/shared';

const rating = z.number().int().min(MIN_RATING).max(MAX_RATING);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Invalid date');
const handle = z.string().trim().regex(/^[A-Za-z0-9_.-]{3,24}$/, 'Codeforces handles are 3–24 characters: letters, digits, _ . -');
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    codeforcesHandle: handle.nullable(),
    preferences: z
      .object({
        theme: z.enum(['light', 'dark', 'system']),
        blindPractice: z.boolean(),
      })
      .partial(),
  })
  .partial();

export const deleteAccountSchema = z.object({ password: z.string().min(1).max(128) });

export const goalAnalyzeSchema = z.object({ currentRating: rating, targetRating: rating });
export const goalRecommendSchema = z.object({ currentRating: rating });

export const generateRoadmapSchema = z
  .object({
    codeforcesHandle: handle.optional(),
    currentRating: rating.optional(),
    targetRating: rating,
    hoursPerDay: z.number().min(0.5).max(12),
    daysPerWeek: z.number().int().min(1).max(7),
    contestParticipation: z.boolean(),
    mandatoryProblems: z.number().int().min(1).max(3).optional(),
    startDate: isoDate.optional(),
  })
  .refine((v) => v.codeforcesHandle !== undefined || v.currentRating !== undefined, {
    message: 'Provide a Codeforces handle or your current rating',
    path: ['currentRating'],
  });

export const updateRoadmapSchema = z
  .object({
    targetRating: rating,
    hoursPerDay: z.number().min(0.5).max(12),
    daysPerWeek: z.number().int().min(1).max(7),
    contestParticipation: z.boolean(),
    mandatoryProblems: z.number().int().min(1).max(3).nullable(),
    status: z.enum(['active', 'archived', 'completed']),
  })
  .partial();

export const dateQuerySchema = z.object({ date: isoDate.optional() });

export const idParam = z.object({ id: objectId });
export const dayParam = z.object({ id: objectId, dayNumber: z.coerce.number().int().min(1).max(90) });

export const problemSearchSchema = z.object({
  tags: z.string().max(200).optional(),
  min: z.coerce.number().int().min(0).max(MAX_RATING).optional(),
  max: z.coerce.number().int().min(0).max(MAX_RATING).optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const excludeProblemSchema = z.object({
  problemId: z.string().regex(/^\d+[A-Z]\d?$/i, 'Invalid problem id'),
  roadmapId: objectId.optional(),
  dayNumber: z.number().int().min(1).max(90).optional(),
});

export const replaceProblemSchema = z.object({
  roadmapId: objectId,
  dayNumber: z.number().int().min(1).max(90),
  problemId: z.string().min(2).max(12),
});

export const progressUpdateSchema = z.object({
  problemId: z.string().min(2).max(12),
  solvingStatus: z.enum(['not-attempted', 'solved-independently', 'solved-with-hint', 'solved-with-editorial', 'unable-to-solve']).optional(),
  editorialUsed: z.boolean().optional(),
  hintRevealed: z.boolean().optional(),
  timeTakenMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  confidence: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(2000).optional(),
});

export const dayStatusSchema = z.object({ status: z.enum(['pending', 'completed', 'skipped']) });

export const feedbackSchema = z.object({
  feedback: z
    .array(z.enum(['too-easy', 'appropriate', 'too-difficult', 'need-revision', 'understood', 'need-more-examples']))
    .min(1)
    .max(6)
    .refine((list) => !(list.includes('too-easy') && list.includes('too-difficult')), 'A day cannot be both too easy and too difficult'),
});

export const contestRecordSchema = z
  .object({
    roadmapId: objectId.nullable().optional(),
    contestId: z.number().int().positive().nullable().optional(),
    contestName: z.string().trim().min(1).max(200),
    contestDate: isoDate,
    kind: z.enum(['rated', 'virtual']).default('rated'),
    oldRating: rating.nullable().optional(),
    newRating: rating.nullable().optional(),
    problemsSolved: z.number().int().min(0).max(20),
    upsolvedProblems: z.number().int().min(0).max(20).default(0),
    notes: z.string().max(2000).default(''),
  });

export const contestUpdateSchema = z.object({
  upsolvedProblems: z.number().int().min(0).max(20).optional(),
  notes: z.string().max(2000).optional(),
  newRating: rating.nullable().optional(),
});

export const weekQuerySchema = z.object({ week: z.coerce.number().int().min(1).max(13).optional(), date: isoDate.optional() });
