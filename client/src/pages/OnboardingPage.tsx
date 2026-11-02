import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import type { CodeforcesProfile, RatingLevel } from '@cgp/shared';
import { api, localDate } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { GoalAssessmentPanel } from '../components/GoalAssessmentPanel';
import { Page } from '../components/RequireAuth';
import { Button, Card, ErrorMessage, Field, Input, Select, Spinner, cx } from '../components/ui';
import { useDebounced } from '../hooks/useDebounced';
import { ratingColor } from '../utils/format';

type Source = 'handle' | 'manual';
const STEPS = ['Current level', 'Target', 'Schedule', 'Review'];
const HOURS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

export function OnboardingPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  // Step 1
  const [source, setSource] = useState<Source>('handle');
  const [handle, setHandle] = useState(user?.codeforcesHandle ?? '');
  const [profile, setProfile] = useState<{ profile: CodeforcesProfile; level: RatingLevel | null } | null>(null);
  const [manualRating, setManualRating] = useState('');

  // Step 2
  const [target, setTarget] = useState('');

  // Step 3
  const [hours, setHours] = useState(2);
  const [daysPerWeek, setDaysPerWeek] = useState(6);
  const [contests, setContests] = useState(true);
  const [mandatory, setMandatory] = useState<'auto' | '1' | '2' | '3'>('auto');
  const [startDate, setStartDate] = useState(localDate());

  const lookup = useMutation({
    mutationFn: (h: string) => api.codeforcesProfile(h.trim()),
    onSuccess: (data) => setProfile(data),
    onError: () => setProfile(null),
  });

  const needsManual = source === 'manual' || (profile !== null && profile.profile.rating === null);
  // A rated handle wins; otherwise the manually entered rating is used.
  const handleRating = source === 'handle' ? (profile?.profile.rating ?? null) : null;
  const currentRating = handleRating ?? (needsManual && manualRating !== '' ? Number(manualRating) : null);
  const ratingValid = currentRating !== null && Number.isInteger(currentRating) && currentRating >= 0 && currentRating <= 4000;
  const step1Done = ratingValid && (source === 'manual' || profile !== null);

  const debouncedTarget = useDebounced(target, 250);
  const targetNum = Number(debouncedTarget);
  const targetValid = /^\d{1,4}$/.test(debouncedTarget) && targetNum <= 4000;
  const assessment = useQuery({
    queryKey: ['assess', currentRating, debouncedTarget],
    queryFn: () => api.analyzeGoal(currentRating!, targetNum),
    enabled: ratingValid && targetValid,
  });
  const recommended = useQuery({
    queryKey: ['recommend', currentRating],
    queryFn: () => api.recommendGoals(currentRating!),
    enabled: ratingValid && step >= 1,
  });

  const generate = useMutation({
    mutationFn: () =>
      api.generateRoadmap({
        codeforcesHandle: source === 'handle' && profile ? profile.profile.handle : undefined,
        currentRating: currentRating ?? undefined,
        targetRating: Number(target),
        hoursPerDay: hours,
        daysPerWeek,
        contestParticipation: contests,
        mandatoryProblems: mandatory === 'auto' ? undefined : Number(mandatory),
        startDate,
      }),
    onSuccess: async () => {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
      await refresh();
      navigate('/dashboard');
    },
  });

  const onLookup = (e: FormEvent) => {
    e.preventDefault();
    if (handle.trim()) lookup.mutate(handle);
  };

  return (
    <Page>
      <h1 className="text-2xl font-semibold tracking-tight">Build your 90-day plan</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Your starting level comes only from your current rating. Your schedule decides the workload.</p>

      <ol className="mt-6 mb-6 flex flex-wrap gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className={cx('flex items-center gap-2 rounded-full px-3 py-1 text-sm', i === step ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-zinc-950' : i < step ? 'bg-zinc-200 dark:bg-zinc-800' : 'text-zinc-500')} aria-current={i === step ? 'step' : undefined}>
            {i < step ? <Check className="size-3.5" aria-hidden /> : <span className="tabular-nums">{i + 1}</span>}
            {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card>
          <div className="mb-5 inline-flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-800" role="tablist">
            {(['handle', 'manual'] as Source[]).map((s) => (
              <button key={s} type="button" role="tab" aria-selected={source === s} onClick={() => setSource(s)} className={cx('rounded px-3 py-1.5 text-sm', source === s ? 'bg-zinc-100 font-medium dark:bg-zinc-800' : 'text-zinc-600 dark:text-zinc-400')}>
                {s === 'handle' ? 'Codeforces handle' : 'Enter rating manually'}
              </button>
            ))}
          </div>

          {source === 'handle' && (
            <form onSubmit={onLookup} className="flex max-w-md items-end gap-2">
              <div className="flex-1">
                <Field label="Codeforces handle" htmlFor="handle" hint="Only your current rating is read. Submission history is never accessed.">
                  <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="e.g. tourist" autoComplete="off" />
                </Field>
              </div>
              <Button type="submit" variant="secondary" loading={lookup.isPending} disabled={!handle.trim()} className="mb-[22px]">
                Look up
              </Button>
            </form>
          )}
          {lookup.error && <div className="mt-3 max-w-md"><ErrorMessage error={lookup.error} /></div>}

          {source === 'handle' && profile && (
            <div className="mt-4 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
              <p className="font-medium">{profile.profile.handle}</p>
              {profile.level ? (
                <p className="mt-1">
                  Current rating <span className={cx('font-semibold', ratingColor(profile.level.rating))}>{profile.level.rating}</span> · {profile.level.rank} · classified as <strong>{profile.level.classification}</strong>
                </p>
              ) : (
                <p className="mt-1 text-amber-700 dark:text-amber-300">This profile has no contest rating yet. Enter a starting rating below (use 0 if you are new to competitive programming).</p>
              )}
            </div>
          )}

          {needsManual && (
            <div className="mt-4 max-w-xs">
              <Field label="Current rating" htmlFor="manual" hint="0–4000. Use 0 if you have never competed.">
                <Input id="manual" inputMode="numeric" value={manualRating} onChange={(e) => setManualRating(e.target.value.replace(/\D/g, '').slice(0, 4))} />
              </Field>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button onClick={() => setStep(1)} disabled={!step1Done}>Continue</Button>
          </div>
        </Card>
      )}

      {step === 1 && ratingValid && (
        <Card>
          <div className="max-w-xs">
            <Field label="Target rating after 90 days" htmlFor="target" hint={recommended.data ? `Recommended for ${currentRating}: ${recommended.data.goals.recommended}` : undefined}>
              <Input id="target" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder={recommended.data ? String(recommended.data.goals.recommended) : ''} />
            </Field>
          </div>
          <div className="mt-6">
            {!targetValid ? (
              <p className="text-sm text-zinc-500">Enter a target between 0 and 4000 to see the assessment.</p>
            ) : assessment.isPending ? (
              <Spinner label="Assessing your goal…" />
            ) : assessment.error ? (
              <ErrorMessage error={assessment.error} />
            ) : (
              <GoalAssessmentPanel assessment={assessment.data} onPickTarget={(v) => setTarget(String(v))} />
            )}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={() => setStep(2)} disabled={!targetValid || !assessment.data || target !== debouncedTarget}>
              Continue with {target || '…'}
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Study hours per day" htmlFor="hours" hint="Sets daily learning and problem time.">
              <Select id="hours" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>
                ))}
              </Select>
            </Field>
            <Field label="Mandatory problems per day" htmlFor="mandatory" hint="Auto: 1 under 1.5 h, 2 by default, 3 from 4 h.">
              <Select id="mandatory" value={mandatory} onChange={(e) => setMandatory(e.target.value as typeof mandatory)}>
                <option value="auto">Auto</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </Select>
            </Field>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium" id="days-label">Study days per week</span>
              <div className="flex gap-1" role="radiogroup" aria-labelledby="days-label">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <button key={d} type="button" role="radio" aria-checked={daysPerWeek === d} onClick={() => setDaysPerWeek(d)} className={cx('size-10 rounded-md border text-sm tabular-nums', daysPerWeek === d ? 'border-blue-500 bg-blue-50 font-semibold text-blue-800 dark:bg-blue-500/15 dark:text-blue-200' : 'border-zinc-300 dark:border-zinc-700')}>
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500">Other days become rest days.</p>
            </div>
            <Field label="Start date" htmlFor="start" hint="Day 1 of the challenge.">
              <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <label className="flex items-start gap-3 sm:col-span-2">
              <input type="checkbox" className="mt-1 size-4" checked={contests} onChange={(e) => setContests(e.target.checked)} />
              <span>
                <span className="block text-sm font-medium">I can take part in rated Codeforces contests</span>
                <span className="block text-xs text-zinc-500">If not, the plan uses virtual contests and timed practice instead.</span>
              </span>
            </label>
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={!startDate}>Continue</Button>
          </div>
        </Card>
      )}

      {step === 3 && assessment.data && (
        <Card>
          <h2 className="mb-4 font-semibold">Review</h2>
          <GoalAssessmentPanel assessment={assessment.data} />
          <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-4 text-sm sm:grid-cols-4 dark:border-zinc-800">
            <div><dt className="text-zinc-500">Hours per day</dt><dd className="font-medium">{hours}</dd></div>
            <div><dt className="text-zinc-500">Days per week</dt><dd className="font-medium">{daysPerWeek}</dd></div>
            <div><dt className="text-zinc-500">Contests</dt><dd className="font-medium">{contests ? 'Rated rounds' : 'Virtual only'}</dd></div>
            <div><dt className="text-zinc-500">Starts</dt><dd className="font-medium">{startDate}</dd></div>
          </dl>
          {generate.error && <div className="mt-4"><ErrorMessage error={generate.error} /></div>}
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => generate.mutate()} loading={generate.isPending}>
              {generate.isPending ? 'Selecting problems…' : 'Generate my 90-day roadmap'}
            </Button>
          </div>
          <p className="mt-3 text-xs text-zinc-500">The first plan may take a few seconds while the Codeforces problemset is loaded.</p>
        </Card>
      )}
    </Page>
  );
}
