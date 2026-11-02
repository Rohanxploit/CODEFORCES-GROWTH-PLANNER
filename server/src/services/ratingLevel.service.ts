import { MAX_RATING, MIN_RATING, type CodeforcesRank, type RatingLevel, type SkillClassification } from '@cgp/shared';

// The initial level is derived from the current rating ONLY. No submission
// history, solve counts or tags are ever consulted here.

interface RatingBand {
  min: number;
  rank: CodeforcesRank;
  classification: SkillClassification;
}

// Ordered from highest to lowest so the first match wins.
const BANDS: readonly RatingBand[] = [
  { min: 2300, rank: 'International Master or above', classification: 'Advanced training' },
  { min: 2100, rank: 'Master', classification: 'High-level training' },
  { min: 1900, rank: 'Candidate Master', classification: 'Advanced problem solver' },
  { min: 1600, rank: 'Expert', classification: 'Advanced' },
  { min: 1400, rank: 'Specialist', classification: 'Intermediate' },
  { min: 1200, rank: 'Pupil', classification: 'Basic problem solver' },
  { min: 0, rank: 'Newbie', classification: 'Beginner' },
];

export const FUNDAMENTALS_THRESHOLD = 200;

export function assertValidRating(rating: number, label = 'Rating'): void {
  if (!Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    throw new RangeError(`${label} must be a whole number between ${MIN_RATING} and ${MAX_RATING}`);
  }
}

export function rankForRating(rating: number): CodeforcesRank {
  return (BANDS.find((band) => rating >= band.min) ?? BANDS[BANDS.length - 1]!).rank;
}

export function classifyRating(rating: number): RatingLevel {
  assertValidRating(rating);
  const band = BANDS.find((b) => rating >= b.min)!;
  return {
    rating,
    rank: band.rank,
    classification: band.classification,
    needsFundamentals: rating < FUNDAMENTALS_THRESHOLD,
  };
}
