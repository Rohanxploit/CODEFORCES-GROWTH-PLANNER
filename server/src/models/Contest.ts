import { Schema, model, type Types } from 'mongoose';

export interface IContest {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  roadmapId: Types.ObjectId | null;
  contestId: number | null;
  contestName: string;
  contestDate: string;
  kind: 'rated' | 'virtual';
  oldRating: number | null;
  newRating: number | null;
  problemsSolved: number;
  upsolvedProblems: number;
  notes: string;
}

const contestSchema = new Schema<IContest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roadmapId: { type: Schema.Types.ObjectId, ref: 'Roadmap', default: null },
    contestId: { type: Number, default: null },
    contestName: { type: String, required: true, trim: true, maxlength: 200 },
    contestDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    kind: { type: String, enum: ['rated', 'virtual'], default: 'rated' },
    oldRating: { type: Number, default: null, min: 0, max: 4000 },
    newRating: { type: Number, default: null, min: 0, max: 4000 },
    problemsSolved: { type: Number, default: 0, min: 0, max: 20 },
    upsolvedProblems: { type: Number, default: 0, min: 0, max: 20 },
    notes: { type: String, default: '', maxlength: 2000 },
  },
  { timestamps: true, versionKey: false },
);

contestSchema.index({ userId: 1, contestDate: -1 });

export const Contest = model<IContest>('Contest', contestSchema);
