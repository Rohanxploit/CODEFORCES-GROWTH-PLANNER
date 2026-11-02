import { Schema, model, type Types } from 'mongoose';
import type { AdaptationEntry, CodeforcesRank, GoalDifficulty, RoadmapStatus, SkillClassification } from '@cgp/shared';

export interface IRoadmap {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  status: RoadmapStatus;
  codeforcesHandle: string | null;
  /** Rating-only starting classification. Never changed by feedback. */
  startingRating: number;
  startingLevel: { rank: CodeforcesRank; classification: SkillClassification; needsFundamentals: boolean };
  targetRating: number;
  conservativeGoal: number;
  recommendedGoal: number;
  stretchGoal: number;
  goalDifficulty: GoalDifficulty;
  problemSolvingBenchmark: number;
  duration: number;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  daysPerWeek: number;
  contestParticipation: boolean;
  mandatoryProblems: number;
  mandatoryProblemsOverride: number | null;
  seed: string;
  difficultyOffset: number;
  practiceStart: number;
  practiceEnd: number;
  rampCapped: boolean;
  topics: string[];
  notes: string[];
  adaptations: AdaptationEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const roadmapSchema = new Schema<IRoadmap>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'archived', 'completed'], default: 'active' },
    codeforcesHandle: { type: String, default: null },
    startingRating: { type: Number, required: true, min: 0, max: 4000 },
    startingLevel: {
      rank: { type: String, required: true },
      classification: { type: String, required: true },
      needsFundamentals: { type: Boolean, required: true },
    },
    targetRating: { type: Number, required: true, min: 0, max: 4000 },
    conservativeGoal: { type: Number, required: true },
    recommendedGoal: { type: Number, required: true },
    stretchGoal: { type: Number, required: true },
    goalDifficulty: { type: String, required: true },
    problemSolvingBenchmark: { type: Number, required: true },
    duration: { type: Number, default: 90 },
    startDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    endDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    hoursPerDay: { type: Number, required: true, min: 0.5, max: 12 },
    daysPerWeek: { type: Number, required: true, min: 1, max: 7 },
    contestParticipation: { type: Boolean, required: true },
    mandatoryProblems: { type: Number, required: true, min: 1, max: 3 },
    mandatoryProblemsOverride: { type: Number, default: null },
    seed: { type: String, required: true },
    difficultyOffset: { type: Number, default: 0 },
    practiceStart: { type: Number, required: true },
    practiceEnd: { type: Number, required: true },
    rampCapped: { type: Boolean, default: false },
    topics: { type: [String], default: [] },
    notes: { type: [String], default: [] },
    adaptations: {
      type: [
        {
          _id: false,
          date: String,
          fromDay: Number,
          change: { type: String, enum: ['increase', 'decrease', 'revision'] },
          offset: Number,
          reason: String,
        },
      ],
      default: [],
    },
  },
  { timestamps: true, versionKey: false },
);

roadmapSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const Roadmap = model<IRoadmap>('Roadmap', roadmapSchema);
