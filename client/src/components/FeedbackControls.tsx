import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { DAY_FEEDBACK_LABELS, type AdaptationEntry, type DailyPlanDTO, type DayFeedback } from '@cgp/shared';
import { api } from '../services/api';
import { Button, ErrorMessage, cx } from './ui';

const EXCLUSIVE: DayFeedback[] = ['too-easy', 'appropriate', 'too-difficult'];

export function FeedbackControls({ day, onDayChange, onAdapted }: { day: DailyPlanDTO; onDayChange: (d: DailyPlanDTO) => void; onAdapted: (a: AdaptationEntry) => void }) {
  const [selected, setSelected] = useState<DayFeedback[]>(day.feedback);
  useEffect(() => setSelected(day.feedback), [day.feedback]);

  const send = useMutation({
    mutationFn: () => api.sendFeedback(day.id, selected),
    onSuccess: ({ day: updated, adaptation }) => {
      onDayChange(updated);
      if (adaptation) onAdapted(adaptation);
    },
  });

  const toggle = (f: DayFeedback) => {
    setSelected((cur) => {
      if (cur.includes(f)) return cur.filter((x) => x !== f);
      // Difficulty answers are mutually exclusive.
      const base = EXCLUSIVE.includes(f) ? cur.filter((x) => !EXCLUSIVE.includes(x)) : cur;
      return [...base, f];
    });
  };

  const changed = selected.slice().sort().join() !== day.feedback.slice().sort().join();

  return (
    <div>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
        How did today go? Feedback across several days adjusts the rest of your plan. A single answer never changes it on its own.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Day feedback">
        {(Object.keys(DAY_FEEDBACK_LABELS) as DayFeedback[]).map((f) => {
          const on = selected.includes(f);
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(f)}
              className={cx(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                on
                  ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-200'
                  : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
              )}
            >
              {DAY_FEEDBACK_LABELS[f]}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={() => send.mutate()} disabled={selected.length === 0 || !changed} loading={send.isPending}>
          {day.feedback.length ? 'Update feedback' : 'Send feedback'}
        </Button>
        {!changed && day.feedback.length > 0 && <span className="text-xs text-zinc-500">Feedback saved</span>}
      </div>
      {send.error && (
        <div className="mt-3">
          <ErrorMessage error={send.error} />
        </div>
      )}
    </div>
  );
}
