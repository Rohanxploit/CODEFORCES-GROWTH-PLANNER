import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';

// Small fixed-window limiter for auth endpoints. In-memory is enough for a
// single Render instance; move to a shared store if the API is scaled out.

export function rateLimit({ windowMs, max, now = Date.now }: { windowMs: number; max: number; now?: () => number }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const t = now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    }
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - t) / 1000));
      return next(new AppError(429, 'TOO_MANY_REQUESTS', 'Too many attempts, please try again later'));
    }
    next();
  };
}
