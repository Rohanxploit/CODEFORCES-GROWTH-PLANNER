import { useQuery } from '@tanstack/react-query';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { SOLVING_STATUS_LABELS, type SolvingStatus } from '@cgp/shared';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { Page, RequireRoadmap } from '../components/RequireAuth';
import { Card, CardTitle, EmptyState, ErrorMessage, PageHeader, Spinner, Stat } from '../components/ui';
import { ratingColor } from '../utils/format';

export function AnalyticsPage() {
  return <RequireRoadmap>{(id) => <Analytics roadmapId={id} />}</RequireRoadmap>;
}

function useChartColors() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    grid: dark ? '#27272a' : '#e4e4e7',
    axis: dark ? '#a1a1aa' : '#71717a',
    primary: dark ? '#60a5fa' : '#2563eb',
    secondary: dark ? '#52525b' : '#d4d4d8',
    accent: dark ? '#4ade80' : '#16a34a',
    tooltipBg: dark ? '#18181b' : '#ffffff',
    tooltipBorder: dark ? '#3f3f46' : '#e4e4e7',
  };
}

const STATUS_COLORS: Record<SolvingStatus, string> = {
  'solved-independently': '#16a34a',
  'solved-with-hint': '#2563eb',
  'solved-with-editorial': '#d97706',
  'unable-to-solve': '#dc2626',
  'not-attempted': '#a1a1aa',
};

function Analytics({ roadmapId }: { roadmapId: string }) {
  const q = useQuery({ queryKey: ['analytics', roadmapId], queryFn: () => api.analytics(roadmapId) });
  const c = useChartColors();
  if (q.isPending) return <Page><Spinner /></Page>;
  if (q.error) return <Page><ErrorMessage error={q.error} onRetry={() => void q.refetch()} /></Page>;
  const a = q.data;
  const tooltip = { contentStyle: { background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 6, fontSize: 12 } };
  const nothingYet = a.totals.problemsAttempted === 0 && a.totals.completedDays === 0;
  const weeklyUntilNow = a.weekly.filter((w) => w.week <= Math.ceil(a.currentDay / 7));
  // The planned band covers the whole plan; solved dots appear as outcomes are recorded.
  const progression = a.difficultyProgression;
  const breakdown = (Object.keys(SOLVING_STATUS_LABELS) as SolvingStatus[])
    .filter((s) => s !== 'not-attempted')
    .map((s) => ({ status: SOLVING_STATUS_LABELS[s], count: a.solvingBreakdown[s], fill: STATUS_COLORS[s] }));
  const ratedHistory = a.contests.history.filter((h) => h.kind === 'rated' && h.newRating !== null);

  return (
    <Page wide>
      <PageHeader title="Progress analytics" description="Problem-solving progress and contest results are tracked separately. Practice progress is not a rating prediction." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><Stat label="Roadmap completion" value={`${a.totals.completionPercent}%`} hint={`${a.totals.completedDays} of ${a.totals.studyDays} study days`} /></Card>
        <Card><Stat label="Current streak" value={a.consistency.currentStreak} hint={`Longest ${a.consistency.longestStreak} · ${a.consistency.activeDays} active days`} /></Card>
        <Card><Stat label="Problems solved" value={a.totals.problemsSolved} hint={`${a.solvingBreakdown['solved-independently']} independently`} /></Card>
        <Card>
          <Stat
            label="Highest independent solve"
            value={a.highestIndependentlySolved !== null ? <span className={ratingColor(a.highestIndependentlySolved)}>{a.highestIndependentlySolved}</span> : '–'}
            hint="User-reported, problem rating"
          />
        </Card>
      </div>

      {nothingYet ? (
        <div className="mt-6">
          <EmptyState title="No progress recorded yet">Record outcomes on your daily problems and the charts will appear here. Nothing is estimated or filled in for you.</EmptyState>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Weekly completion</CardTitle>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyUntilNow} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="week" tickFormatter={(w) => `W${w}`} stroke={c.axis} fontSize={12} />
                  <YAxis allowDecimals={false} stroke={c.axis} fontSize={12} />
                  <Tooltip {...tooltip} labelFormatter={(w) => `Week ${w}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar isAnimationActive={false} dataKey="plannedDays" name="Planned study days" fill={c.secondary} radius={[3, 3, 0, 0]} />
                  <Bar isAnimationActive={false} dataKey="completedDays" name="Completed" fill={c.primary} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardTitle>Solving outcomes</CardTitle>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdown} layout="vertical" margin={{ left: 40, right: 16 }}>
                  <CartesianGrid stroke={c.grid} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke={c.axis} fontSize={12} />
                  <YAxis type="category" dataKey="status" stroke={c.axis} fontSize={12} width={130} />
                  <Tooltip {...tooltip} />
                  <Bar isAnimationActive={false} dataKey="count" name="Problems" radius={[0, 3, 3, 0]}>
                    {breakdown.map((b) => (
                      <Cell key={b.status} fill={b.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardTitle>Difficulty progression</CardTitle>
            <p className="-mt-2 mb-3 text-xs text-zinc-500">Shaded band: planned practice range. Dots: hardest problem you solved that day.</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={progression.map((d) => ({ ...d, band: [d.plannedMin, d.plannedMax] }))} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="day" stroke={c.axis} fontSize={12} tickFormatter={(d) => `D${d}`} />
                  <YAxis domain={['dataMin - 100', 'dataMax + 100']} stroke={c.axis} fontSize={12} />
                  <Tooltip {...tooltip} labelFormatter={(d) => `Day ${d}`} />
                  <Area isAnimationActive={false} dataKey="band" name="Planned range" stroke="none" fill={c.primary} fillOpacity={0.15} />
                  <Scatter isAnimationActive={false} dataKey="solvedRating" name="Hardest solved" fill={c.accent} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Topic progress</CardTitle>
          {a.topics.length === 0 ? (
            <p className="text-sm text-zinc-500">No topic days in this plan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr><th className="py-1.5 font-medium">Topic</th><th className="py-1.5 text-right font-medium">Days done</th><th className="py-1.5 text-right font-medium">Solved</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {a.topics.map((t) => (
                    <tr key={t.topic}>
                      <td className="py-1.5 pr-2">{t.topic}</td>
                      <td className="py-1.5 text-right tabular-nums">{t.completedDays}/{t.days}</td>
                      <td className="py-1.5 text-right tabular-nums">{t.solved}/{t.assigned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Contests and upsolving</CardTitle>
          <dl className="mb-4 grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-zinc-500">Rated</dt><dd className="text-lg font-semibold tabular-nums">{a.contests.rated}</dd></div>
            <div><dt className="text-zinc-500">Virtual</dt><dd className="text-lg font-semibold tabular-nums">{a.contests.virtual}</dd></div>
            <div><dt className="text-zinc-500">Upsolved</dt><dd className="text-lg font-semibold tabular-nums">{a.contests.upsolved}</dd></div>
          </dl>
          {ratedHistory.length >= 2 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ratedHistory} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="date" stroke={c.axis} fontSize={11} />
                  <YAxis domain={['dataMin - 50', 'dataMax + 50']} stroke={c.axis} fontSize={12} />
                  <Tooltip {...tooltip} />
                  <Line isAnimationActive={false} dataKey="newRating" name="Rating after contest" stroke={c.primary} strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Record at least two rated contests to see your contest rating over time.</p>
          )}
        </Card>
      </div>
    </Page>
  );
}
