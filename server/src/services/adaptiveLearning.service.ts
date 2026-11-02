import type { DayFeedback } from '@cgp/shared';

// Adapts the REMAINING plan from explicit day feedback only, using a rolling
// window so one response never causes a big change. It never touches the
// rating-based starting classification and never looks at submissions.

export const FEEDBACK_SCORES: Record<DayFeedback, number> = {
  'too-easy': 1,
  appropriate: 0,
  'too-difficult': -1,
  'need-revision': -0.5,
  understood: 0.25,
  'need-more-examples': -0.5,
};

const REVISION_SIGNALS: readonly DayFeedback[] = ['need-revision', 'need-more-examples'];

export const ADAPTATION_RULES = {
  window: 5,
  minDays: 3,
  increaseAt: 0.6,
  decreaseAt: -0.6,
  step: 100,
  maxOffset: 200,
  revisionSignalsNeeded: 2,
} as const;

export interface FeedbackDay {
  dayNumber: number;
  topic: string;
  feedback: DayFeedback[];
}

export interface AdaptationDecision {
  action: 'increase' | 'decrease' | 'revision' | 'none';
  newOffset: number;
  reason: string;
  revisionTopics: string[];
}

export function dayScore(feedback: readonly DayFeedback[]): number {
  const sum = feedback.reduce((s, f) => s + FEEDBACK_SCORES[f], 0);
  return Math.max(-1, Math.min(1, sum));
}

/**
 * @param history days with feedback, any order
 * @param lastAdaptationDay day number of the last difficulty change (0 if none);
 *   only feedback after it counts, so changes need fresh evidence.
 */
export function evaluateAdaptation(history: readonly FeedbackDay[], currentOffset: number, lastAdaptationDay = 0): AdaptationDecision {
  const rules = ADAPTATION_RULES;
  const recent = history
    .filter((d) => d.feedback.length > 0 && d.dayNumber > lastAdaptationDay)
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .slice(-rules.window);

  const none: AdaptationDecision = { action: 'none', newOffset: currentOffset, reason: '', revisionTopics: [] };
  if (recent.length < rules.minDays) return none;

  const mean = recent.reduce((s, d) => s + dayScore(d.feedback), 0) / recent.length;

  if (mean >= rules.increaseAt && currentOffset < rules.maxOffset) {
    return {
      action: 'increase',
      newOffset: currentOffset + rules.step,
      reason: `Your last ${recent.length} days of feedback were mostly "too easy", so upcoming problems are ${rules.step} rating points harder.`,
      revisionTopics: [],
    };
  }
  if (mean <= rules.decreaseAt && currentOffset > -rules.maxOffset) {
    return {
      action: 'decrease',
      newOffset: currentOffset - rules.step,
      reason: `Your last ${recent.length} days of feedback were mostly "too difficult", so upcoming problems are ${rules.step} rating points easier.`,
      revisionTopics: [],
    };
  }

  const flagged = recent.filter((d) => d.feedback.some((f) => REVISION_SIGNALS.includes(f)));
  if (flagged.length >= rules.revisionSignalsNeeded) {
    const topics = [...new Set(flagged.map((d) => d.topic))];
    return {
      action: 'revision',
      newOffset: currentOffset,
      reason: `You asked for revision or more examples on ${flagged.length} recent days, so extra revision tasks were added.`,
      revisionTopics: topics,
    };
  }
  return none;
}
