import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, EyeOff, Info } from 'lucide-react';
import type { AdaptationEntry, DailyPlanDTO } from '@cgp/shared';
import { api, type DayResponse } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Page, RequireRoadmap } from '../components/RequireAuth';
import { ProblemCard } from '../components/ProblemCard';
import { FeedbackControls } from '../components/FeedbackControls';
import { Badge, Button, Card, CardTitle, ErrorMessage, Spinner } from '../components/ui';
import { DAY_TYPE_LABELS, STATUS_LABELS, formatDate, formatMinutes, formatRange } from '../utils/format';

export function TodayPage() {
  return <RequireRoadmap>{(id) => <DayView roadmapId={id} />}</RequireRoadmap>;
}

export function DayPage() {
  const { dayNumber } = useParams();
  const n = Number(dayNumber);
  if (!Number.isInteger(n) || n < 1 || n > 90) {
    return (
      <Page>
        <ErrorMessage error={new Error('Day must be between 1 and 90')} />
      </Page>
    );
  }
  return <RequireRoadmap>{(id) => <DayView roadmapId={id} dayNumber={n} />}</RequireRoadmap>;
}

function DayView({ roadmapId, dayNumber }: { roadmapId: string; dayNumber?: number }) {
  const queryClient = useQueryClient();
  const { user, refresh } = useAuth();
  const key = dayNumber ? ['day', roadmapId, dayNumber] : ['today', roadmapId];
  const q = useQuery({ queryKey: key, queryFn: () => (dayNumber ? api.day(roadmapId, dayNumber) : api.today(roadmapId)) });
  const [adaptation, setAdaptation] = useState<AdaptationEntry | null>(null);

  const blindPref = user?.preferences.blindPractice ?? false;
  const toggleBlind = useMutation({
    mutationFn: () => api.updateMe({ preferences: { blindPractice: !blindPref } }),
    onSuccess: () => refresh(),
  });

  const onDayChange = (day: DailyPlanDTO) => {
    queryClient.setQueryData<DayResponse>(key, (old) => (old ? { ...old, day } : old));
    // Other views (dashboard, roadmap grid, analytics) read summaries of this day.
    void queryClient.invalidateQueries({ predicate: (qq) => ['roadmap', 'analytics', 'review', 'today', 'day'].includes(String(qq.queryKey[0])) && JSON.stringify(qq.queryKey) !== JSON.stringify(key) });
  };

  const setStatus = useMutation({
    mutationFn: (status: 'pending' | 'completed' | 'skipped') => api.setDayStatus(q.data!.day.id, status),
    onSuccess: ({ day }) => onDayChange(day),
  });

  if (q.isPending) return <Page><Spinner /></Page>;
  if (q.error) return <Page><ErrorMessage error={q.error} onRetry={() => void q.refetch()} /></Page>;

  const { day } = q.data;
  const blind = blindPref;
  const hideTopic = blind && ['practice', 'assessment', 'revision'].includes(day.type);
  const mandatory = day.problems.filter((p) => p.mandatory);
  const optional = day.problems.filter((p) => !p.mandatory);

  return (
    <Page>
      <nav className="mb-4 flex items-center justify-between text-sm" aria-label="Day navigation">
        {day.dayNumber > 1 ? (
          <Link to={`/day/${day.dayNumber - 1}`} className="inline-flex items-center gap-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            <ChevronLeft className="size-4" aria-hidden /> Day {day.dayNumber - 1}
          </Link>
        ) : <span />}
        <Link to="/roadmap" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">All days</Link>
        {day.dayNumber < 90 ? (
          <Link to={`/day/${day.dayNumber + 1}`} className="inline-flex items-center gap-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Day {day.dayNumber + 1} <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : <span />}
      </nav>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span>Day {day.dayNumber} · {formatDate(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          <Badge>{DAY_TYPE_LABELS[day.type]}</Badge>
          <Badge tone="neutral">Phase {day.phase}: {day.phaseName}</Badge>
          <Badge tone={day.status === 'completed' ? 'green' : day.status === 'in-progress' ? 'amber' : 'neutral'}>{STATUS_LABELS[day.status]}</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{hideTopic ? 'Mixed problems (topic hidden)' : day.topic}</h1>
        {!hideTopic && <p className="text-zinc-600 dark:text-zinc-400">{day.subtopic}</p>}
      </header>

      {adaptation && (
        <div className="mb-4 flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200" role="status">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>Plan adjusted from day {adaptation.fromDay}: {adaptation.reason}</p>
        </div>
      )}

      {day.type !== 'rest' && day.type !== 'contest' && (
        <Card className="mb-4">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-zinc-500">Learning</dt><dd className="font-medium">{formatMinutes(day.learnMinutes)}</dd></div>
            <div><dt className="text-zinc-500">Problem solving</dt><dd className="font-medium">{formatMinutes(day.practiceMinutes)}</dd></div>
            <div><dt className="text-zinc-500">Practice range</dt><dd className="font-medium tabular-nums">{formatRange(day.difficulty)}</dd></div>
            <div><dt className="text-zinc-500">Stretch range</dt><dd className="font-medium tabular-nums">{day.stretchDifficulty ? formatRange(day.stretchDifficulty) : '–'}</dd></div>
          </dl>
        </Card>
      )}

      {!hideTopic && (
        <Card className="mb-4">
          <CardTitle>Concept</CardTitle>
          {day.objective && <p className="mb-2 text-sm"><span className="font-medium">Objective: </span>{day.objective}</p>}
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{day.concept}</p>
          {day.whyItMatters && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"><span className="font-medium text-zinc-800 dark:text-zinc-200">Why it matters: </span>{day.whyItMatters}</p>}
          {day.prerequisites.length > 0 && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"><span className="font-medium text-zinc-800 dark:text-zinc-200">Prerequisites: </span>{day.prerequisites.join(', ')}</p>}
        </Card>
      )}

      {day.problems.length > 0 && (
        <section className="mb-4" aria-labelledby="problems">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="problems" className="font-semibold">Problems</h2>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" checked={blind} onChange={() => toggleBlind.mutate()} disabled={toggleBlind.isPending} />
              <EyeOff className="size-4" aria-hidden /> Blind Practice
            </label>
          </div>
          {blind && <p className="mb-3 text-xs text-zinc-500">Tags and the selection reason are hidden until you record an outcome, ask for a hint, or reveal the approach.</p>}
          <div className="space-y-3">
            {[...mandatory, ...optional].map((p) => (
              <ProblemCard key={p.problemId} problem={p} progress={day.progress.find((x) => x.problemId === p.problemId)} day={day} blind={blind} onDayChange={onDayChange} />
            ))}
          </div>
        </section>
      )}

      {(day.type === 'rest' || day.type === 'contest') && (
        <Card className="mb-4">
          <CardTitle>{day.type === 'rest' ? 'Rest day' : 'Contest day'}</CardTitle>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{day.objective}</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{day.concept}</p>
          {day.type === 'contest' && (
            <Link to="/contests" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">See upcoming rounds and record a result</Link>
          )}
          <div className="mt-4 flex gap-2">
            {day.status !== 'completed' ? (
              <Button size="sm" onClick={() => setStatus.mutate('completed')} loading={setStatus.isPending}>Mark as done</Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setStatus.mutate('pending')} loading={setStatus.isPending}>Mark as not done</Button>
            )}
          </div>
          {setStatus.error && <div className="mt-3"><ErrorMessage error={setStatus.error} /></div>}
        </Card>
      )}

      {day.revisionTasks.length > 0 && (
        <Card className="mb-4">
          <CardTitle>Revision</CardTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {day.revisionTasks.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </Card>
      )}

      {day.ifStuck.length > 0 && (
        <Card className="mb-4">
          <CardTitle>If you get stuck</CardTitle>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {day.ifStuck.map((t) => <li key={t}>{t}</li>)}
          </ol>
        </Card>
      )}

      {day.type !== 'rest' && (
        <Card className="mb-4">
          <CardTitle>Feedback</CardTitle>
          <FeedbackControls day={day} onDayChange={onDayChange} onAdapted={(a) => { setAdaptation(a); void queryClient.invalidateQueries(); }} />
        </Card>
      )}

      {day.problems.some((p) => p.mandatory) && day.status !== 'completed' && (
        <div className="flex justify-end">
          {day.status === 'skipped' ? (
            <Button variant="ghost" size="sm" onClick={() => setStatus.mutate('pending')}>Undo skip</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setStatus.mutate('skipped')}>Skip this day</Button>
          )}
        </div>
      )}
    </Page>
  );
}
