import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RoadmapDTO, ThemePreference } from '@cgp/shared';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Page } from '../components/RequireAuth';
import { Badge, Button, Card, CardTitle, ErrorMessage, Field, Input, PageHeader, Select, Spinner } from '../components/ui';
import { formatDate } from '../utils/format';

export function SettingsPage() {
  const { user, activeRoadmapId } = useAuth();
  if (!user) return null;
  return (
    <Page>
      <PageHeader title="Settings" />
      <div className="space-y-4">
        <ProfileSettings />
        {activeRoadmapId && <RoadmapSettings roadmapId={activeRoadmapId} />}
        <RoadmapManagement />
        <ExcludedProblems />
        <DeleteAccount />
      </div>
    </Page>
  );
}

function ProfileSettings() {
  const { user, refresh } = useAuth();
  const { preference, setTheme } = useTheme();
  const [name, setName] = useState(user!.name);
  const [handle, setHandle] = useState(user!.codeforcesHandle ?? '');
  const [blind, setBlind] = useState(user!.preferences.blindPractice);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => api.updateMe({ name, codeforcesHandle: handle.trim() || null, preferences: { theme: preference, blindPractice: blind } }),
    onSuccess: async () => {
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <Card>
      <CardTitle>Profile and preferences</CardTitle>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Name" htmlFor="s-name"><Input id="s-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email" htmlFor="s-email"><Input id="s-email" value={user!.email} disabled /></Field>
        <Field label="Codeforces handle" htmlFor="s-handle" hint="Used to read your current rating when you create a new plan.">
          <Input id="s-handle" value={handle} onChange={(e) => setHandle(e.target.value)} />
        </Field>
        <Field label="Theme" htmlFor="s-theme">
          <Select id="s-theme" value={preference} onChange={(e) => setTheme(e.target.value as ThemePreference)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" className="size-4" checked={blind} onChange={(e) => setBlind(e.target.checked)} />
          Use Blind Practice by default (hide tags and hints)
        </label>
        {save.error && <div className="sm:col-span-2"><ErrorMessage error={save.error} /></div>}
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" loading={save.isPending}>Save</Button>
          {saved && <span className="text-sm text-green-700 dark:text-green-400">Saved</span>}
        </div>
      </form>
    </Card>
  );
}

function RoadmapSettings({ roadmapId }: { roadmapId: string }) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['roadmap', roadmapId], queryFn: () => api.roadmap(roadmapId) });
  const r = q.data?.roadmap;
  const [target, setTarget] = useState('');
  const [hours, setHours] = useState(2);
  const [days, setDays] = useState(6);
  const [contests, setContests] = useState(true);
  const [mandatory, setMandatory] = useState('auto');
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!r) return;
    setTarget(String(r.targetRating));
    setHours(r.hoursPerDay);
    setDays(r.daysPerWeek);
    setContests(r.contestParticipation);
    setMandatory(r.mandatoryProblemsOverride === null ? 'auto' : String(r.mandatoryProblemsOverride));
  }, [r]);

  const save = useMutation({
    mutationFn: () =>
      api.updateRoadmap(roadmapId, {
        targetRating: Number(target),
        hoursPerDay: hours,
        daysPerWeek: days,
        contestParticipation: contests,
        mandatoryProblems: mandatory === 'auto' ? null : Number(mandatory),
      }),
    onSuccess: ({ regeneratedDays }) => {
      setResult(`Saved. ${regeneratedDays} upcoming day${regeneratedDays === 1 ? '' : 's'} regenerated; days you already started were kept.`);
      void queryClient.invalidateQueries();
    },
  });

  if (q.isPending) return <Card><Spinner /></Card>;
  if (q.error) return <Card><ErrorMessage error={q.error} /></Card>;

  return (
    <Card>
      <CardTitle>Current roadmap</CardTitle>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Changes apply from today onwards. Your starting rating ({r!.startingRating}, {r!.startingLevel.rank}) stays as it was.
      </p>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setResult(null);
          save.mutate();
        }}
      >
        <Field label="Target rating" htmlFor="r-target"><Input id="r-target" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, '').slice(0, 4))} /></Field>
        <Field label="Hours per day" htmlFor="r-hours">
          <Select id="r-hours" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {[0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8].map((h) => <option key={h} value={h}>{h}</option>)}
          </Select>
        </Field>
        <Field label="Days per week" htmlFor="r-days">
          <Select id="r-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        </Field>
        <Field label="Mandatory problems per day" htmlFor="r-mand">
          <Select id="r-mand" value={mandatory} onChange={(e) => setMandatory(e.target.value)}>
            <option value="auto">Auto (from hours)</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" className="size-4" checked={contests} onChange={(e) => setContests(e.target.checked)} />
          I can take part in rated contests
        </label>
        {save.error && <div className="sm:col-span-2"><ErrorMessage error={save.error} /></div>}
        {result && <p className="text-sm text-green-700 sm:col-span-2 dark:text-green-400" role="status">{result}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" loading={save.isPending} disabled={!/^\d{1,4}$/.test(target) || Number(target) > 4000}>Update plan</Button>
        </div>
      </form>
    </Card>
  );
}

function RoadmapManagement() {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['roadmaps'], queryFn: api.roadmaps });
  const after = async () => {
    await queryClient.invalidateQueries();
    await refresh();
  };
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: RoadmapDTO['status'] }) => api.updateRoadmap(id, { status }), onSuccess: after });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteRoadmap(id), onSuccess: after });

  return (
    <Card>
      <CardTitle action={<Button size="sm" variant="secondary" onClick={() => navigate('/onboarding')}>New roadmap</Button>}>Your roadmaps</CardTitle>
      {q.isPending ? <Spinner /> : q.error ? <ErrorMessage error={q.error} /> : q.data.roadmaps.length === 0 ? (
        <p className="text-sm text-zinc-500">No roadmaps yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {q.data.roadmaps.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {r.startingRating} → {r.targetRating} · from {formatDate(r.startDate, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                <Badge tone={r.status === 'active' ? 'green' : 'neutral'}>{r.status}</Badge>
              </span>
              <span className="flex gap-1">
                {r.status !== 'active' && <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: r.id, status: 'active' })}>Make active</Button>}
                {r.status === 'active' && <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: r.id, status: 'archived' })}>Archive</Button>}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm('Delete this roadmap and all its progress? This cannot be undone.')) remove.mutate(r.id);
                  }}
                >
                  Delete
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {(setStatus.error || remove.error) && <div className="mt-3"><ErrorMessage error={setStatus.error ?? remove.error} /></div>}
    </Card>
  );
}

function ExcludedProblems() {
  const { user, refresh } = useAuth();
  const remove = useMutation({ mutationFn: (id: string) => api.removeExcluded(id), onSuccess: () => refresh() });
  const ids = user?.excludedProblemIds ?? [];
  return (
    <Card>
      <CardTitle>Excluded problems</CardTitle>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">Problems you marked as already solved. They are never assigned in new or regenerated plans.</p>
      {ids.length === 0 ? (
        <p className="text-sm text-zinc-500">None yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {ids.map((id) => (
            <li key={id} className="inline-flex items-center gap-1 rounded border border-zinc-200 py-0.5 pl-2 pr-1 text-sm dark:border-zinc-800">
              {id}
              <button type="button" className="rounded px-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label={`Allow ${id} again`} onClick={() => remove.mutate(id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DeleteAccount() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const remove = useMutation({
    mutationFn: () => api.deleteMe(password),
    onSuccess: async () => {
      await logout();
      navigate('/');
    },
  });
  return (
    <Card className="border-red-200 dark:border-red-500/30">
      <CardTitle>Delete account</CardTitle>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">Permanently deletes your account, roadmaps, progress and contest records.</p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (window.confirm('Delete your account and all data permanently?')) remove.mutate();
        }}
      >
        <div className="w-64">
          <Field label="Confirm with your password" htmlFor="del-pw">
            <Input id="del-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>
        <Button type="submit" variant="danger" loading={remove.isPending} disabled={!password}>Delete account</Button>
      </form>
      {remove.error && <div className="mt-3"><ErrorMessage error={remove.error} /></div>}
    </Card>
  );
}
