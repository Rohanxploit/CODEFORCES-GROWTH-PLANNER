import { Schema, model, type Types } from 'mongoose';
import type { SolvingStatus } from '@cgp/shared';

export interface IProgress {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  roadmapId: Types.ObjectId;
  dailyPlanId: Types.ObjectId;
  dayNumber: number;
  problemId: string;
  /** Snapshot for analytics (difficulty progression, highest independent solve). */
  problemRating: number;
  solvingStatus: SolvingStatus;
  /** True only for "solved independently" as reported by the user. */
  independentSolve: boolean;
  editorialUsed: boolean;
  hintRevealed: boolean;
  timeTaken: number | null;
  confidence: number | null;
  notes: string;
  completedAt: Date | null;
  updatedAt: Date;
}

const progressSchema = new Schema<IProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roadmapId: { type: Schema.Types.ObjectId, ref: 'Roadmap', required: true },
    dailyPlanId: { type: Schema.Types.ObjectId, ref: 'DailyPlan', required: true },
    dayNumber: { type: Number, required: true },
    problemId: { type: String, required: true },
    problemRating: { type: Number, required: true },
    solvingStatus: {
      type: String,
      enum: ['not-attempted', 'solved-independently', 'solved-with-hint', 'solved-with-editorial', 'unable-to-solve'],
      default: 'not-attempted',
    },
    independentSolve: { type: Boolean, default: false },
    editorialUsed: { type: Boolean, default: false },
    hintRevealed: { type: Boolean, default: false },
    timeTaken: { type: Number, default: null, min: 0, max: 1440 },
    confidence: { type: Number, default: null, min: 1, max: 5 },
    notes: { type: String, default: '', maxlength: 2000 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true }, versionKey: false },
);

progressSchema.index({ dailyPlanId: 1, problemId: 1 }, { unique: true });
progressSchema.index({ userId: 1, roadmapId: 1 });

export const Progress = model<IProgress>('Progress', progressSchema);
