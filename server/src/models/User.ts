import { Schema, model, type Types } from 'mongoose';
import type { ThemePreference } from '@cgp/shared';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  codeforcesHandle: string | null;
  currentRating: number | null;
  /** Problems the user marked "already solved" or "exclude". Entered manually only. */
  excludedProblemIds: string[];
  preferences: { theme: ThemePreference; blindPractice: boolean };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    // Never returned unless explicitly selected.
    passwordHash: { type: String, required: true, select: false },
    codeforcesHandle: { type: String, default: null, trim: true, maxlength: 24 },
    currentRating: { type: Number, default: null, min: 0, max: 4000 },
    excludedProblemIds: { type: [String], default: [] },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      blindPractice: { type: Boolean, default: false },
    },
  },
  { timestamps: true, versionKey: false },
);

export const User = model<IUser>('User', userSchema);
