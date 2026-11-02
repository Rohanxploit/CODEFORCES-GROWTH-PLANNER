import type { RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const AUTH_COOKIE = 'cgp_token';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production' || env.COOKIE_SAME_SITE === 'none',
  sameSite: env.COOKIE_SAME_SITE,
  path: '/',
});

export function setAuthCookie(res: Response, userId: string): void {
  res.cookie(AUTH_COOKIE, signToken(userId), { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
}

/** Rejects requests without a valid session cookie and sets req.userId. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== 'string' || !token) return next(new AppError(401, 'UNAUTHORIZED', 'Please log in'));
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    const sub = typeof payload === 'object' ? payload.sub : undefined;
    if (!sub || !Types.ObjectId.isValid(sub)) throw new Error('bad subject');
    req.userId = sub;
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Your session has expired, please log in again'));
  }
};

export function currentUserId(req: { userId?: string }): Types.ObjectId {
  if (!req.userId) throw new AppError(401, 'UNAUTHORIZED', 'Please log in');
  return new Types.ObjectId(req.userId);
}
