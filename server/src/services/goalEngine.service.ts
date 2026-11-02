import type { GoalAssessment, GoalDifficulty, GoalRecommendation } from '@cgp/shared';
import { EXTRAPOLATED_GAINS, GOAL_TABLE, LARGE_GAP_THRESHOLD, type GoalBand } from '../config/heuristics/goals.js';
import { assertValidRating, classifyRating, rankForRating } from './ratingLevel.service.js';
import { calculateBenchmark } from './problemBenchmark.service.js';

export function recommendGoals(currentRating: number, table: readonly GoalBand[] = GOAL_TABLE): GoalRecommendation {
  assertValidRating(currentRating, 'Current rating');
  const band = table.find((b) => currentRating >= b.min && currentRating <= b.max);
  if (band) {
    return {
      conservative: band.conservative,
      recommended: band.recommended,
      stretch: band.stretch,
      extrapolated: false,
    };
  }
  // Above the table: smaller, rounded gains on top of the current rating.
  const round50 = (n: number) => Math.round(n / 50) * 50;
  return {
    conservative: round50(currentRating + EXTRAPOLATED_GAINS.conservative),
    recommended: round50(currentRating + EXTRAPOLATED_GAINS.recommended),
    stretch: round50(currentRating + EXTRAPOLATED_GAINS.stretch),
    extrapolated: true,
  };
}

export function classifyGoalDifficulty(current: number, target: number, goals: GoalRecommendation): GoalDifficulty {
  if (target <= current) return 'maintenance';
  if (target <= goals.conservative) return 'conservative';
  if (target <= goals.recommended) return 'recommended';
  if (target <= goals.stretch) return 'ambitious';
  return 'very-ambitious';
}

export function assessGoal(currentRating: number, targetRating: number): GoalAssessment {
  assertValidRating(currentRating, 'Current rating');
  assertValidRating(targetRating, 'Target rating');

  const current = classifyRating(currentRating);
  const goals = recommendGoals(currentRating);
  const difficulty = classifyGoalDifficulty(currentRating, targetRating, goals);
  const ratingGap = targetRating - currentRating;
  const notes: string[] = [];
  let warning: string | null = null;

  if (difficulty === 'maintenance') {
    notes.push(
      targetRating === currentRating
        ? 'Your target equals your current rating, so this plan is a maintenance plan: it keeps your skills sharp rather than aiming for a rating increase.'
        : 'Your target is below your current rating. This is a maintenance or lower milestone rather than a rating-improvement goal; the plan will still keep you practising at your level.',
    );
  } else if (difficulty === 'ambitious') {
    warning = `+${ratingGap} in 90 days is above the recommended milestone of ${goals.recommended}. It is possible, but it needs consistent practice and good contest results. Consider ${goals.recommended} as your 90-day milestone.`;
  } else if (difficulty === 'very-ambitious') {
    warning = `+${ratingGap} in 90 days is well beyond the stretch goal of ${goals.stretch} for your current rating. The plan will still build towards it, but treat ${goals.recommended} as a realistic 90-day milestone and the rest as a longer-term goal.`;
    if (ratingGap - (goals.stretch - currentRating) >= LARGE_GAP_THRESHOLD) {
      notes.push('This is a very large gap. The practice difficulty will rise gradually rather than jump, so the 90-day plan may end below your target level.');
    }
  }

  if (goals.extrapolated) {
    notes.push('Goals above 2000 are extrapolated from the heuristic table and are less certain.');
  }
  notes.push('These goals are heuristics, not predictions. No plan can guarantee a rating change.');

  return {
    current,
    target: targetRating,
    targetRank: rankForRating(targetRating),
    ratingGap,
    goals,
    benchmark: calculateBenchmark(targetRating),
    difficulty,
    warning,
    notes,
  };
}
