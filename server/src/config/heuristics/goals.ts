// Initial 90-day goal heuristics. These are product assumptions, not validated
// predictions: keep them here as data so they can be tuned later from real
// outcome data without touching engine code.

export interface GoalBand {
  min: number;
  max: number;
  conservative: number;
  recommended: number;
  stretch: number;
}

export const GOAL_TABLE: readonly GoalBand[] = [
  { min: 0, max: 199, conservative: 300, recommended: 400, stretch: 600 },
  { min: 200, max: 399, conservative: 400, recommended: 600, stretch: 800 },
  { min: 400, max: 599, conservative: 600, recommended: 800, stretch: 1000 },
  { min: 600, max: 799, conservative: 750, recommended: 950, stretch: 1150 },
  { min: 800, max: 999, conservative: 900, recommended: 1050, stretch: 1200 },
  { min: 1000, max: 1199, conservative: 1100, recommended: 1250, stretch: 1400 },
  { min: 1200, max: 1399, conservative: 1300, recommended: 1450, stretch: 1550 },
  { min: 1400, max: 1599, conservative: 1500, recommended: 1650, stretch: 1750 },
  { min: 1600, max: 1799, conservative: 1700, recommended: 1850, stretch: 1950 },
  { min: 1800, max: 1999, conservative: 1900, recommended: 2050, stretch: 2150 },
];

/** Gains used above the table (2000+), where progress is usually slower. */
export const EXTRAPOLATED_GAINS = { conservative: 50, recommended: 100, stretch: 150 } as const;

/** A target this far above the stretch goal also gets a large-gap note. */
export const LARGE_GAP_THRESHOLD = 600;
