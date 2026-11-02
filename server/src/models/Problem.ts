import { Schema, model } from 'mongoose';

export interface IProblem {
  problemId: string;
  contestId: number;
  index: string;
  name: string;
  rating: number | null;
  tags: string[];
  solvedCount: number | null;
  url: string;
  metadataUpdatedAt: Date;
}

const problemSchema = new Schema<IProblem>(
  {
    problemId: { type: String, required: true, unique: true },
    contestId: { type: Number, required: true },
    index: { type: String, required: true },
    name: { type: String, required: true },
    rating: { type: Number, default: null },
    tags: { type: [String], default: [] },
    solvedCount: { type: Number, default: null },
    url: { type: String, required: true },
    metadataUpdatedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

problemSchema.index({ rating: 1, tags: 1 });
problemSchema.index({ metadataUpdatedAt: -1 });

export const Problem = model<IProblem>('Problem', problemSchema);
