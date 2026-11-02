import { Schema, model, type Types } from 'mongoose';
import type { AssignedProblem, DayFeedback, DayStatus, DayType, RatingRange } from '@cgp/shared';

export interface IDailyPlan {
  _id: Types.ObjectId;
  roadmapId: Types.ObjectId;
  userId: Types.ObjectId;
  dayNumber: number;
  date: string;
  week: number;
  type: DayType;
  phase: number;
  phaseName: string;
  topicId: string | null;
  topic: string;
  subtopic: string;
  objective: string;
  concept: string;
  whyItMatters: string;
  prerequisites: string[];
  topicTags: string[];
  fallbackTags: string[];
  learnMinutes: number;
  practiceMinutes: number;
  difficulty: RatingRange;
  stretchDifficulty: RatingRange | null;
  /** Snapshot of the assigned problems' metadata at generation time. */
  problems: AssignedProblem[];
  revisionTasks: string[];
  ifStuck: string[];
  notes: string[];
  status: DayStatus;
  feedback: DayFeedback[];
  feedbackAt: Date | null;
}

const rangeSchema = new Schema<RatingRange>({ min: Number, max: Number }, { _id: false });

const assignedProblemSchema = new Schema<AssignedProblem>(
  {
    problemId: { type: String, required: true },
    contestId: { type: Number, required: true },
    index: { type: String, required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true },
    tags: { type: [String], default: [] },
    solvedCount: { type: Number, default: null },
    url: { type: String, required: true },
    role: { type: String, enum: ['core', 'reinforcement', 'stretch'], required: true },
    mandatory: { type: Boolean, required: true },
    reason: { type: String, required: true },
    estimatedMinutes: { type: Number, required: true },
  },
  { _id: false },
);

const dailyPlanSchema = new Schema<IDailyPlan>(
  {
    roadmapId: { type: Schema.Types.ObjectId, ref: 'Roadmap', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dayNumber: { type: Number, required: true, min: 1, max: 90 },
    date: { type: String, required: true },
    week: { type: Number, required: true },
    type: { type: String, enum: ['learn', 'practice', 'revision', 'contest', 'assessment', 'rest'], required: true },
    phase: { type: Number, required: true },
    phaseName: { type: String, required: true },
    topicId: { type: String, default: null },
    topic: { type: String, required: true },
    subtopic: { type: String, default: '' },
    objective: { type: String, default: '' },
    concept: { type: String, default: '' },
    whyItMatters: { type: String, default: '' },
    prerequisites: { type: [String], default: [] },
    topicTags: { type: [String], default: [] },
    fallbackTags: { type: [String], default: [] },
    learnMinutes: { type: Number, default: 0 },
    practiceMinutes: { type: Number, default: 0 },
    difficulty: { type: rangeSchema, required: true },
    stretchDifficulty: { type: rangeSchema, default: null },
    problems: { type: [assignedProblemSchema], default: [] },
    revisionTasks: { type: [String], default: [] },
    ifStuck: { type: [String], default: [] },
    notes: { type: [String], default: [] },
    status: { type: String, enum: ['pending', 'in-progress', 'completed', 'skipped'], default: 'pending' },
    feedback: { type: [String], default: [] },
    feedbackAt: { type: Date, default: null },
  },
  { versionKey: false },
);

dailyPlanSchema.index({ roadmapId: 1, dayNumber: 1 }, { unique: true });
dailyPlanSchema.index({ userId: 1 });

export const DailyPlan = model<IDailyPlan>('DailyPlan', dailyPlanSchema);
