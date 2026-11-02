import type { CodeforcesRank, DayStatus, DayType, GoalDifficulty, ProblemRole } from '@cgp/shared';

/** Codeforces-style colours for a rating, readable in light and dark themes. */
export function ratingColor(rating: number | null | undefined): string {
  if (rating === null || rating === undefined) return 'text-zinc-500';
  if (rating < 1200) return 'text-zinc-500 dark:text-zinc-400';
  if (rating < 1400) return 'text-green-700 dark:text-green-400';
  if (rating < 1600) return 'text-teal-600 dark:text-teal-400';
  if (rating < 1900) return 'text-blue-700 dark:text-blue-400';
  if (rating < 2100) return 'text-violet-700 dark:text-violet-400';
  if (rating < 2400) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

export function rankFor(rating: number): CodeforcesRank {
  if (rating >= 2300) return 'International Master or above';
  if (rating >= 2100) return 'Master';
  if (rating >= 1900) return 'Candidate Master';
  if (rating >= 1600) return 'Expert';
  if (rating >= 1400) return 'Specialist';
  if (rating >= 1200) return 'Pupil';
  return 'Newbie';
}

export const GOAL_DIFFICULTY: Record<GoalDifficulty, { label: string; tone: 'neutral' | 'green' | 'blue' | 'amber' | 'red' }> = {
  maintenance: { label: 'Maintenance', tone: 'neutral' },
  conservative: { label: 'Conservative', tone: 'green' },
  recommended: { label: 'Recommended', tone: 'blue' },
  ambitious: { label: 'Ambitious', tone: 'amber' },
  'very-ambitious': { label: 'Very ambitious', tone: 'red' },
};

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  learn: 'Learn',
  practice: 'Practice',
  revision: 'Revision',
  contest: 'Contest',
  assessment: 'Assessment',
  rest: 'Rest',
};

export const ROLE_LABELS: Record<ProblemRole, string> = {
  core: 'Core practice',
  reinforcement: 'Reinforcement',
  stretch: 'Optional stretch',
};

export const STATUS_LABELS: Record<DayStatus, string> = {
  pending: 'Not started',
  'in-progress': 'In progress',
  completed: 'Completed',
  skipped: 'Skipped',
};

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatRange(r: { min: number; max: number }): string {
  return r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
}
