import { AlertTriangle, Info } from 'lucide-react';
import type { GoalAssessment } from '@cgp/shared';
import { GOAL_DIFFICULTY, ratingColor } from '../utils/format';
import { Badge, cx } from './ui';

interface Props {
  assessment: GoalAssessment;
  /** When given, the three goals become buttons that set the target. */
  onPickTarget?: (rating: number) => void;
}

export function GoalAssessmentPanel({ assessment: a, onPickTarget }: Props) {
  const diff = GOAL_DIFFICULTY[a.difficulty];
  const goals = [
    { label: 'Conservative', value: a.goals.conservative },
    { label: 'Recommended', value: a.goals.recommended },
    { label: 'Stretch', value: a.goals.stretch },
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Current rating</dt>
          <dd className={cx('font-semibold tabular-nums', ratingColor(a.current.rating))}>
            {a.current.rating} · {a.current.rank}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Starting level</dt>
          <dd className="font-medium">{a.current.classification}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Selected target</dt>
          <dd className={cx('font-semibold tabular-nums', ratingColor(a.target))}>
            {a.target} · {a.targetRank}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Rating gap</dt>
          <dd className="font-medium tabular-nums">{a.ratingGap > 0 ? `+${a.ratingGap}` : a.ratingGap}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Goal difficulty</dt>
          <dd>
            <Badge tone={diff.tone}>{diff.label}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Problem-solving benchmark</dt>
          <dd className="font-medium tabular-nums" title="Target + 300: a long-term training heuristic, not a guarantee">
            {a.benchmark}
          </dd>
        </div>
      </dl>

      <div>
        <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
          90-day milestones for a {a.current.rating} rating{a.goals.extrapolated ? ' (extrapolated above 2000)' : ''}:
        </p>
        <div className="grid grid-cols-3 gap-2">
          {goals.map((g) => {
            const selected = g.value === a.target;
            const content = (
              <>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">{g.label}</span>
                <span className={cx('block text-lg font-semibold tabular-nums', ratingColor(g.value))}>{g.value}</span>
              </>
            );
            const className = cx(
              'rounded-md border p-3 text-left',
              selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-zinc-200 dark:border-zinc-800',
              onPickTarget && 'hover:border-zinc-400 dark:hover:border-zinc-600',
            );
            return onPickTarget ? (
              <button key={g.label} type="button" className={className} onClick={() => onPickTarget(g.value)} aria-pressed={selected}>
                {content}
              </button>
            ) : (
              <div key={g.label} className={className}>
                {content}
              </div>
            );
          })}
        </div>
      </div>

      {a.warning && (
        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{a.warning} You can still continue with your target; the plan will be the best one we can build for it.</p>
        </div>
      )}

      <ul className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {a.notes.map((n) => (
          <li key={n} className="flex gap-1.5">
            <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
            {n}
          </li>
        ))}
        <li className="flex gap-1.5">
          <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
          Solving {a.benchmark}-rated problems is a long-term training benchmark. It is not the same as reaching a {a.target} contest rating.
        </li>
      </ul>
    </div>
  );
}
