import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { DayStatus, DayType } from '@cgp/shared';
import { api, localDate } from '../services/api';
import { Page, RequireRoadmap } from '../components/RequireAuth';
import { Card, CardTitle, ErrorMessage, PageHeader, Select, Spinner, cx } from '../components/ui';
import { DAY_TYPE_LABELS, STATUS_LABELS, formatDate, formatRange } from '../utils/format';

const PHASES: Record<number, string> = {
  1: 'Foundation',
  2: 'Core problem-solving',
  3: 'Intermediate algorithms',
  4: 'Advanced core topics',
  5: 'Target-level preparation',
  6: 'Benchmark & contest prep',
};

const typeStyle: Record<DayType, string> = {
  learn: 'border-l-blue-500',
  practice: 'border-l-teal-500',
  revision: 'border-l-amber-500',
  contest: 'border-l-violet-500',
  assessment: 'border-l-red-500',
  rest: 'border-l-zinc-300 dark:border-l-zinc-700',
};

export function DayStatusDot({ status, type }: { status: DayStatus; type: DayType }) {
  const color =
    type === 'rest' && status === 'pending'
      ? 'bg-zinc-200 dark:bg-zinc-700'
      : status === 'completed'
        ? 'bg-green-500'
        : status === 'in-progress'
          ? 'bg-amber-500'
          : status === 'skipped'
            ? 'bg-zinc-400'
            : 'border border-zinc-300 dark:border-zinc-600';
  return <span className={cx('inline-block size-2.5 shrink-0 rounded-full', color)} title={STATUS_LABELS[status]} aria-label={STATUS_LABELS[status]} />;
}

export function RoadmapPage() {
  return <RequireRoadmap>{(id) => <Roadmap roadmapId={id} />}</RequireRoadmap>;
}

function Roadmap({ roadmapId }: { roadmapId: string }) {
  const q = useQuery({ queryKey: ['roadmap', roadmapId], queryFn: () => api.roadmap(roadmapId) });
  const [filter, setFilter] = useState<DayType | 'all'>('all');
  const today = localDate();

  const weeks = useMemo(() => {
    const map = new Map<number, NonNullable<typeof q.data>['days']>();
    for (const d of q.data?.days ?? []) map.set(d.week, [...(map.get(d.week) ?? []), d]);
    return [...map.entries()];
  }, [q.data]);

  if (q.isPending) return <Page><Spinner /></Page>;
  if (q.error) return <Page><ErrorMessage error={q.error} onRetry={() => void q.refetch()} /></Page>;
  const { roadmap, topics } = q.data;

  return (
    <Page wide>
      <PageHeader
        title="90-day roadmap"
        description={`${roadmap.startingRating} → ${roadmap.targetRating} · ${formatDate(roadmap.startDate)} to ${formatDate(roadmap.endDate)}`}
        actions={
          <div className="w-44">
            <label htmlFor="filter" className="sr-only">Filter days</label>
            <Select id="filter" value={filter} onChange={(e) => setFilter(e.target.value as DayType | 'all')}>
              <option value="all">All days</option>
              {(Object.keys(DAY_TYPE_LABELS) as DayType[]).map((t) => (
                <option key={t} value={t}>{DAY_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        {(Object.keys(typeStyle) as DayType[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className={cx('h-3 w-1 rounded-sm border-l-4', typeStyle[t])} aria-hidden />
            {DAY_TYPE_LABELS[t]}
          </span>
        ))}
      </div>

      <div className="space-y-6">
        {weeks.map(([week, days]) => (
          <section key={week} aria-labelledby={`w${week}`}>
            <h2 id={`w${week}`} className="mb-2 text-sm font-semibold">
              Week {week} <span className="font-normal text-zinc-500">· {PHASES[days.find((d) => d.type !== 'rest')?.phase ?? days[0]!.phase]}</span>
            </h2>
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {days.map((d) => {
                const dim = filter !== 'all' && d.type !== filter;
                return (
                  <li key={d.dayNumber}>
                    <Link
                      to={`/day/${d.dayNumber}`}
                      className={cx(
                        'block h-full rounded-md border border-l-4 border-zinc-200 bg-white p-2.5 text-sm transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600',
                        typeStyle[d.type],
                        dim && 'opacity-30',
                        d.date === today && 'ring-2 ring-blue-500',
                      )}
                    >
                      <span className="flex items-center justify-between text-xs text-zinc-500">
                        <span className="tabular-nums">Day {d.dayNumber} · {formatDate(d.date)}</span>
                        <DayStatusDot status={d.status} type={d.type} />
                      </span>
                      <span className="mt-1 block font-medium leading-snug">{d.topic}</span>
                      {d.type !== 'rest' && <span className="mt-0.5 block line-clamp-2 text-xs text-zinc-500">{d.subtopic}</span>}
                      {d.problemCount > 0 && <span className="mt-1 block text-xs tabular-nums text-zinc-500">{d.problemCount} problems · {formatRange(d.difficulty)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <Card className="mt-8">
        <CardTitle>Topic sequence</CardTitle>
        <ol className="flex flex-wrap gap-2 text-sm">
          {topics.map((t, i) => (
            <li key={t} className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-800">
              <span className="mr-1 text-xs tabular-nums text-zinc-500">{i + 1}.</span>
              {t}
            </li>
          ))}
        </ol>
      </Card>
    </Page>
  );
}
