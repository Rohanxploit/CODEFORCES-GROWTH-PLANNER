import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ExternalLink, Info } from 'lucide-react';
import { api, localDate } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Page, RequireRoadmap } from '../components/RequireAuth';
import { Badge, Card, CardTitle, ErrorMessage, PageHeader, Spinner, Stat, cx } from '../components/ui';
import { DAY_TYPE_LABELS, GOAL_DIFFICULTY, ROLE_LABELS, formatDate, formatMinutes, formatRange, rankFor, ratingColor } from '../utils/format';
import { DayStatusDot } from './RoadmapPage';

export function DashboardPage() {
  return <RequireRoadmap>{(id) => <Dashboard roadmapId={id} />}</RequireRoadmap>;
}

function Dashboard({ roadmapId }: { roadmapId: string }) {
  const { user } = useAuth();
  const detail = useQuery({ queryKey: ['roadmap', roadmapId], queryFn: () => api.roadmap(roadmapId) });
  const today = useQuery({ queryKey: ['today', roadmapId], queryFn: () => api.today(roadmapId) });

  if (detail.isPending || today.isPending) return <Page><Spinner /></Page>;
  if (detail.error) return <Page><ErrorMessage error={detail.error} onRetry={() => void detail.refetch()} /></Page>;
  if (today.error) return <Page><ErrorMessage error={today.error} onRetry={() => void today.refetch()} /></Page>;

  const { roadmap: r, days, notes } = detail.data;
  const { day, currentDay = 1 } = today.data;
  const studyDays = days.filter((d) => d.type !== 'rest');
  const completed = studyDays.filter((d) => d.status === 'completed').length;
  const week = days.filter((d) => d.week === day.week);
  const diff = GOAL_DIFFICULTY[r.goalDifficulty];
  const latestRating = user?.currentRating ?? r.startingRating;
  const notStarted = localDate() < r.startDate;

  return (
    <Page wide>
      <PageHeader
        title={`Day ${currentDay} of ${r.duration}`}
        description={`${formatDate(r.startDate, { month: 'long', day: 'numeric' })} – ${formatDate(r.endDate, { month: 'long', day: 'numeric', year: 'numeric' })}`}
        actions={
          <Link to="/practice" className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-zinc-950">
            Open today's practice <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      />
      {notStarted && <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">Your challenge starts on {formatDate(r.startDate, { month: 'long', day: 'numeric' })}. Here is day 1.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat label="Starting rating" value={<span className={ratingColor(r.startingRating)}>{r.startingRating}</span>} hint={`${r.startingLevel.rank} · ${r.startingLevel.classification}`} />
          {latestRating !== r.startingRating && <p className="mt-2 text-xs text-zinc-500">Latest recorded rating: <span className={cx('font-medium', ratingColor(latestRating))}>{latestRating}</span> ({rankFor(latestRating)})</p>}
        </Card>
        <Card>
          <Stat label="Target rating" value={<span className={ratingColor(r.targetRating)}>{r.targetRating}</span>} hint={rankFor(r.targetRating)} />
          <div className="mt-2"><Badge tone={diff.tone}>{diff.label}</Badge></div>
        </Card>
        <Card>
          <Stat label="Recommended milestone" value={r.recommendedGoal} hint={`Conservative ${r.conservativeGoal} · Stretch ${r.stretchGoal}`} />
        </Card>
        <Card>
          <Stat label="Problem-solving benchmark" value={r.problemSolvingBenchmark} hint="Target + 300, a long-term training level" />
        </Card>
        <Card>
          <Stat label="Today's practice difficulty" value={formatRange(day.difficulty)} hint={day.stretchDifficulty ? `Optional stretch ${formatRange(day.stretchDifficulty)}` : 'No stretch today'} />
        </Card>
        <Card>
          <Stat label="Completed days" value={`${completed} / ${studyDays.length}`} hint="Study days (rest days excluded)" />
        </Card>
        <Card>
          <Stat label="Remaining days" value={Math.max(0, r.duration - currentDay)} hint={`Ends ${formatDate(r.endDate, { month: 'short', day: 'numeric' })}`} />
        </Card>
        <Card>
          <Stat label="Workload" value={`${r.hoursPerDay} h`} hint={`${r.daysPerWeek} days/week · ${r.mandatoryProblems} mandatory/day`} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle action={<Badge>{DAY_TYPE_LABELS[day.type]}</Badge>}>Today · {formatDate(day.date, { weekday: 'long', month: 'short', day: 'numeric' })}</CardTitle>
          <p className="text-lg font-semibold">{day.topic}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{day.subtopic}</p>
          {day.objective && <p className="mt-2 text-sm">{day.objective}</p>}
          {day.type !== 'rest' && (
            <p className="mt-2 text-xs text-zinc-500">
              Learn {formatMinutes(day.learnMinutes)} · Practice {formatMinutes(day.practiceMinutes)}
            </p>
          )}
          {day.problems.length > 0 ? (
            <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
              {day.problems.map((p) => {
                const prog = day.progress.find((x) => x.problemId === p.problemId);
                return (
                  <li key={p.problemId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="mr-2 text-xs text-zinc-500">{ROLE_LABELS[p.role]}</span>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                        {p.problemId} · {p.name} <ExternalLink className="inline size-3 text-zinc-400" aria-hidden />
                      </a>
                    </span>
                    <span className="flex items-center gap-2">
                      {prog && prog.solvingStatus !== 'not-attempted' && <Badge tone="green">Recorded</Badge>}
                      <span className={cx('tabular-nums font-medium', ratingColor(p.rating))}>{p.rating}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">{day.type === 'rest' ? 'Rest day: no problems assigned.' : day.type === 'contest' ? 'Contest day: see the Contests page for upcoming rounds.' : 'No problems assigned.'}</p>
          )}
        </Card>

        <Card>
          <CardTitle>Week {day.week}</CardTitle>
          <ul className="space-y-1.5">
            {week.map((d) => (
              <li key={d.dayNumber}>
                <Link to={`/day/${d.dayNumber}`} className={cx('flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800', d.dayNumber === currentDay && 'bg-blue-50 dark:bg-blue-500/10')}>
                  <DayStatusDot status={d.status} type={d.type} />
                  <span className="w-12 shrink-0 text-xs tabular-nums text-zinc-500">Day {d.dayNumber}</span>
                  <span className="truncate">{d.topic}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">{week.filter((d) => d.type !== 'rest' && d.status === 'completed').length} of {week.filter((d) => d.type !== 'rest').length} study days completed this week.</p>
        </Card>
      </div>

      {(notes.length > 0 || r.adaptations.length > 0) && (
        <Card className="mt-4">
          <CardTitle>Plan notes</CardTitle>
          <ul className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {r.adaptations.slice().reverse().map((a, i) => (
              <li key={`a${i}`} className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden />Day {a.fromDay}+: {a.reason}</li>
            ))}
            {notes.map((n) => (
              <li key={n} className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />{n}</li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
