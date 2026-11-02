import type { RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { Roadmap } from '../models/Roadmap.js';
import { DailyPlan } from '../models/DailyPlan.js';
import { Progress } from '../models/Progress.js';
import { Contest } from '../models/Contest.js';
import { clearAuthCookie, currentUserId, setAuthCookie } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import { toUserDTO } from '../utils/dto.js';
import { deleteAccountSchema, loginSchema, registerSchema, updateUserSchema } from '../validators/index.js';

export const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown, so timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', BCRYPT_ROUNDS);

export const register: RequestHandler = async (req, res) => {
  const { name, email, password } = registerSchema.parse(req.body);
  if (await User.exists({ email: email.toLowerCase() })) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  }
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
  setAuthCookie(res, user._id.toString());
  res.status(201).json({ user: toUserDTO(user) });
};

export const login: RequestHandler = async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  setAuthCookie(res, user._id.toString());
  res.json({ user: toUserDTO(user) });
};

export const logout: RequestHandler = (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
};

export const me: RequestHandler = async (req, res) => {
  const user = await User.findById(currentUserId(req));
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Please log in');
  const activeRoadmap = await Roadmap.findOne({ userId: user._id, status: 'active' }, { _id: 1 }).sort({ createdAt: -1 });
  res.json({ user: toUserDTO(user), activeRoadmapId: activeRoadmap?._id.toString() ?? null });
};

export const updateMe: RequestHandler = async (req, res) => {
  const input = updateUserSchema.parse(req.body);
  const user = await User.findById(currentUserId(req));
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Please log in');
  if (input.name !== undefined) user.name = input.name;
  if (input.codeforcesHandle !== undefined) user.codeforcesHandle = input.codeforcesHandle;
  if (input.preferences?.theme !== undefined) user.preferences.theme = input.preferences.theme;
  if (input.preferences?.blindPractice !== undefined) user.preferences.blindPractice = input.preferences.blindPractice;
  await user.save();
  res.json({ user: toUserDTO(user) });
};

export const removeExcludedProblem: RequestHandler = async (req, res) => {
  const user = await User.findByIdAndUpdate(currentUserId(req), { $pull: { excludedProblemIds: String(req.params.problemId) } }, { new: true });
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Please log in');
  res.json({ user: toUserDTO(user) });
};

/** Deletes the account and every document that belongs to it. */
export const deleteMe: RequestHandler = async (req, res) => {
  const { password } = deleteAccountSchema.parse(req.body);
  const userId = currentUserId(req);
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Please log in');
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect password');

  await Promise.all([Progress.deleteMany({ userId }), DailyPlan.deleteMany({ userId }), Contest.deleteMany({ userId }), Roadmap.deleteMany({ userId })]);
  await User.deleteOne({ _id: userId });
  clearAuthCookie(res);
  res.json({ ok: true });
};
