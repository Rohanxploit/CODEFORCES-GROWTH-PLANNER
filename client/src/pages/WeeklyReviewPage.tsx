import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DAY_FEEDBACK_LABELS, type DayFeedback } from '@cgp/shared';
import { api, localDate } from '../services/api';
import { Page, RequireRoadmap } from '../components/RequireAuth';
import { Card, CardTitle, ErrorMessage, PageHeader, Select, Spinner, Stat } from '../components/ui';
import { DAY_TYPE_LABELS, formatDate } from '../utils/format';

export function WeeklyReviewPage() {
  return <RequireRoadmap>{(id) => <Review roadmapId={id} />}</RequireRoadmap>;
}

function Review({ roadmapId }: { roadmapId: string }) {
  const roadmap = useQuery({ queryKey: ['roadmap', roadmapId], queryFn: () => api.roadmap(roadmapId) });
  const startDate = roadmap.data?.roadmap.startDate;
  const elapsed = startDate ? Math.floor((Date.parse(localDate()) - Date.parse(startDate)) / 86_400_000) : 0;
  const defaultWeek = Math.min(13, Math.max(1, Math.floor(elapsed / 7) + 1));
  const [week, setWeek] = useState<number | null>(null);
  const selected = week ?? defaultWeek;
  const q = useQuery({ queryKey: ['review', roadmapId, selected], queryFn: () => api.weeklyReview(roadmapId, selected), enabled: !!startDate });

  if (roadmap.isPending || (q.isPending && !!startDate)) return <Page><Spinner /></Page>;
  if (roadmap.error) return <Page><ErrorMessage error={roadmap.error} /></Page>;
  if (q.error) return <Page><ErrorMessage error={q.error} onRetry={() => void q.refetch()} /></Page>;
  const r = q.data!;

  return (
    <Page>
      <PageHeader
        title={`Week ${r.week} review`}
        description={r.startDate ? `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` : undefined}
        actions={
          <div className="w-36">
            <label htmlFor="week" className="sr-only">Week</label>
            <Select id="week" value={selected} onChange={(e) => setWeek(Number(e.target.value))}>
              {Array.from({ length: 13 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><Stat label="Problems completed" value={r.problemsCompleted} /></Card>
        <Card><Stat label="Independent" value={r.independentSolves} hint="Solved without editorial" /></Card>
        <Card><Stat label="With hint" value={r.hintSolves} /></Card>
        <Card><Stat label="Editorial-assisted" value={r.editorialSolves} hint={`${r.unableToSolve} unable to solve`} /></Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Topics covered</CardTitle>
          {r.topicsCovered.length ? (
            <ul className="flex flex-wrap gap-2 text-sm">{r.topicsCovered.map((t) => <li key={t} className="rounded border border-zinc-200 px-2 py-0.5 dark:border-zinc-800">{t}</li>)}</ul>
          ) : <p className="text-sm text-zinc-500">No study days this week.</p>}
        </Card>

        <Card>
          <CardTitle>Feedback summary</CardTitle>
          {Object.keys(r.feedbackSummary).length ? (
            <ul className="space-y-1 text-sm">
              {(Object.entries(r.feedbackSummary) as [DayFeedback, number][]).map(([f, n]) => (
                <li key={f} className="flex justify-between"><span>{DAY_FEEDBACK_LABELS[f]}</span><span className="tabular-nums">{n}</span></li>
              ))}
            </ul>
          ) : <p className="text-sm text-zinc-500">No feedback given this week.</p>}
        </Card>

        <Card>
          <CardTitle>Pending mandatory problems</CardTitle>
          {r.pendingTasks.length ? (
            <ul className="space-y-1 text-sm">
              {r.pendingTasks.map((t) => (
                <li key={`${t.dayNumber}-${t.problemId}`}>
                  <Link to={`/day/${t.dayNumber}`} className="hover:underline">Day {t.dayNumber}: {t.problemId} · {t.name}</Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-zinc-500">Nothing pending up to today.</p>}
        </Card>

        <Card>
          <CardTitle>Contests this week</CardTitle>
          {r.contests.length ? (
            <ul className="space-y-1 text-sm">
              {r.contests.map((c) => (
                <li key={c.id}>
                  {c.contestName} · {c.kind} · solved {c.problemsSolved}, upsolved {c.upsolvedProblems}
                  {c.oldRating !== null && c.newRating !== null && <span className="text-zinc-500"> ({c.oldRating} → {c.newRating})</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-zinc-500">No contests recorded. <Link to="/contests" className="text-blue-600 hover:underline dark:text-blue-400">Record one</Link>.</p>}
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Next week's plan</CardTitle>
        {r.nextWeek.length ? (
          <ol className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {r.nextWeek.map((d) => (
              <li key={d.dayNumber} className="flex gap-3 py-1.5">
                <span className="w-28 shrink-0 tabular-nums text-zinc-500">Day {d.dayNumber} · {formatDate(d.date)}</span>
                <span className="w-20 shrink-0 text-zinc-500">{DAY_TYPE_LABELS[d.type]}</span>
                <Link to={`/day/${d.dayNumber}`} className="hover:underline">{d.topic}</Link>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-zinc-500">This is the final week of the challenge.</p>}
      </Card>
    </Page>
  );
}
