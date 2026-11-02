import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CalendarDays, EyeOff, Gauge, ListChecks, RefreshCw, Target, Trophy } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { GoalAssessmentPanel } from '../components/GoalAssessmentPanel';
import { Card, ErrorMessage, Field, Input, Spinner } from '../components/ui';
import { useDebounced } from '../hooks/useDebounced';

const STEPS = [
  { title: 'Enter your rating', body: 'Use your Codeforces handle (we read only your current rating) or type a rating manually.' },
  { title: 'Pick a target', body: 'See conservative, recommended and stretch milestones for 90 days, with honest warnings for ambitious goals.' },
  { title: 'Set your schedule', body: 'Hours per day, days per week and whether you can join rated contests shape the workload.' },
  { title: 'Follow the plan', body: 'Every day tells you what to learn, which real Codeforces problems to solve, and what to do if you get stuck.' },
];

const FEATURES = [
  { icon: Target, title: 'Rating-based starting point', body: 'Your initial level comes only from your current rating. No submission history is analysed.' },
  { icon: Gauge, title: 'Gradual difficulty', body: 'Practice starts near your rating and climbs smoothly towards your target, with easier revision days built in.' },
  { icon: ListChecks, title: 'Real problems, chosen for a reason', body: 'Problems come from the official Codeforces problemset, filtered by topic, difficulty, quality and variety.' },
  { icon: EyeOff, title: 'Blind Practice', body: 'Hide tags and hints until you finish or ask for them, so you practise finding the idea yourself.' },
  { icon: RefreshCw, title: 'Adapts to your feedback', body: 'Repeated "too easy" or "too difficult" feedback adjusts the remaining days. One answer never overreacts.' },
  { icon: Trophy, title: 'Contests and upsolving', body: 'Contest days, virtual contest suggestions, result tracking and upsolving tasks.' },
  { icon: BarChart3, title: 'Honest analytics', body: 'Independent solves, editorial-assisted solves and contest results are tracked separately.' },
  { icon: CalendarDays, title: 'Fits your week', body: 'Rest days, weekly revision and a workload sized to the time you actually have.' },
];

const PHASES = [
  ['Foundation', 'Implementation, arrays, strings, sorting, basic maths. Only for ratings that need it.'],
  ['Core problem-solving', 'Brute force, greedy, prefix sums, two pointers, binary search, number theory basics.'],
  ['Intermediate algorithms', 'Binary search on the answer, bits, constructive, recursion, first DP and graphs.'],
  ['Advanced core topics', 'BFS/DFS, DSU, trees, shortest paths, intermediate DP, data structures.'],
  ['Target-level preparation', 'Mixed problems around your target difficulty and timed solving.'],
  ['Benchmark and contest preparation', 'Stretch problems towards target + 300, virtual contests, final assessment.'],
];

export function LandingPage() {
  const { user } = useAuth();
  const ctaTo = user ? '/dashboard' : '/register';

  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pt-24">
        <p className="mb-4 inline-flex rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          A personalised 90-day Codeforces challenge
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Don't guess what to practice. Know exactly what to solve next.</h1>
        <p className="mt-5 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Codeforces Growth Planner turns your current rating and target into a day-by-day plan: the concept to learn, two real problems to solve, an optional stretch, and what to revise.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={ctaTo} className="inline-flex h-11 items-center rounded-md bg-blue-600 px-5 font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-zinc-950 dark:hover:bg-blue-400">
            {user ? 'Go to your dashboard' : 'Build my 90-day plan'}
          </Link>
          <a href="#goal-preview" className="inline-flex h-11 items-center rounded-md border border-zinc-300 px-5 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
            Check a goal first
          </a>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50 py-16 dark:border-zinc-800 dark:bg-zinc-900/40" aria-labelledby="how">
        <div className="mx-auto max-w-6xl px-4">
          <h2 id="how" className="text-2xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Step {i + 1}</span>
                <h3 className="mt-1 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="features">
        <h2 id="features" className="text-2xl font-semibold tracking-tight">What you get</h2>
        <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <Icon className="size-5 text-blue-600 dark:text-blue-400" aria-hidden />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50 py-16 dark:border-zinc-800 dark:bg-zinc-900/40" aria-labelledby="challenge">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2">
          <div>
            <h2 id="challenge" className="text-2xl font-semibold tracking-tight">The 90-day challenge</h2>
            <p className="mt-3 text-zinc-600 dark:text-zinc-400">
              Plans use six phases as a general structure. A beginner spends weeks on foundations; an Expert skips straight to advanced topics. Topics you already know become short revision days instead of disappearing.
            </p>
            <p className="mt-3 text-zinc-600 dark:text-zinc-400">
              <strong className="text-zinc-900 dark:text-zinc-100">The target + 300 benchmark.</strong> To compete at rating X, it helps to work towards solving problems around X + 300 on your own. It is a long-term stretch level for optional problems, not a daily requirement and not a promise of a rating.
            </p>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              Example: from 1200 aiming for 1600, practice starts around 1100–1300 and moves towards 1500–1700, with optional stretch problems up to 1900 near the end. Exact ranges are computed for every user.
            </p>
          </div>
          <ol className="space-y-3">
            {PHASES.map(([name, body], i) => (
              <li key={name} className="flex gap-4 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold dark:bg-zinc-800">{i + 1}</span>
                <div>
                  <h3 className="font-medium">{name}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <GoalPreview />

      <section className="mx-auto max-w-6xl px-4 pb-24 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Ready to stop guessing?</h2>
        <p className="mx-auto mt-2 max-w-xl text-zinc-600 dark:text-zinc-400">Create a free account, enter your rating and get your first day of practice in a minute.</p>
        <Link to={ctaTo} className="mt-6 inline-flex h-11 items-center rounded-md bg-blue-600 px-5 font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-zinc-950 dark:hover:bg-blue-400">
          {user ? 'Go to your dashboard' : 'Start the 90-day challenge'}
        </Link>
        <p className="mt-4 text-xs text-zinc-500">No plan can guarantee a rating change. Contest results depend on many things beyond practice.</p>
      </section>
    </main>
  );
}

function GoalPreview() {
  const [current, setCurrent] = useState('1200');
  const [target, setTarget] = useState('1600');
  const c = useDebounced(current, 300);
  const t = useDebounced(target, 300);
  const valid = /^\d{1,4}$/.test(c) && /^\d{1,4}$/.test(t) && Number(c) <= 4000 && Number(t) <= 4000;

  const q = useQuery({
    queryKey: ['goal-preview', c, t],
    queryFn: () => api.analyzeGoal(Number(c), Number(t)),
    enabled: valid,
  });

  return (
    <section id="goal-preview" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16" aria-labelledby="preview">
      <h2 id="preview" className="text-2xl font-semibold tracking-tight">Goal recommendation preview</h2>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Try any combination. This uses the same goal engine as the app.</p>
      <Card className="mt-6">
        <div className="mb-6 grid max-w-md grid-cols-2 gap-4">
          <Field label="Current rating" htmlFor="pv-current">
            <Input id="pv-current" inputMode="numeric" value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Target rating" htmlFor="pv-target">
            <Input id="pv-target" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
        {!valid ? (
          <p className="text-sm text-zinc-500">Enter ratings between 0 and 4000.</p>
        ) : q.isPending ? (
          <Spinner label="Assessing goal…" />
        ) : q.error ? (
          <ErrorMessage error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          <GoalAssessmentPanel assessment={q.data} onPickTarget={(v) => setTarget(String(v))} />
        )}
      </Card>
    </section>
  );
}
