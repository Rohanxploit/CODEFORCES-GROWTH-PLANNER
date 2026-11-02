import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Trash2 } from 'lucide-react';
import { api, localDate } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Page } from '../components/RequireAuth';
import { Button, Card, CardTitle, EmptyState, ErrorMessage, Field, Input, PageHeader, Select, Spinner, Textarea } from '../components/ui';
import { ratingColor } from '../utils/format';

export function ContestsPage() {
  const queryClient = useQueryClient();
  const { activeRoadmapId, refresh } = useAuth();
  const overview = useQuery({ queryKey: ['contests'], queryFn: api.contests });
  const history = useQuery({ queryKey: ['contest-history'], queryFn: api.contestHistory });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['contest-history'] });
    void queryClient.invalidateQueries({ queryKey: ['contests'] });
    void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    void queryClient.invalidateQueries({ queryKey: ['review'] });
    void refresh();
  };

  const updateUpsolved = useMutation({ mutationFn: ({ id, n }: { id: string; n: number }) => api.updateContest(id, { upsolvedProblems: n }), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteContest(id), onSuccess: invalidate });

  return (
    <Page wide>
      <PageHeader title="Contests" description="Contest rating is separate from practice. Record results here and upsolve what you missed." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Upcoming Codeforces rounds</CardTitle>
          {overview.isPending ? <Spinner /> : overview.error ? <ErrorMessage error={overview.error} /> : !overview.data.available ? (
            <p className="text-sm text-zinc-500">Contest information from Codeforces is unavailable right now. Check codeforces.com/contests.</p>
          ) : overview.data.upcoming.length === 0 ? (
            <p className="text-sm text-zinc-500">No upcoming rounds are listed.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {overview.data.upcoming.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{c.name} <ExternalLink className="inline size-3 text-zinc-400" aria-hidden /></a>
                  <span className="text-zinc-500">
                    {new Date(c.startTime).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {Math.round(c.durationSeconds / 60)} min
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Virtual contest suggestions</CardTitle>
          {overview.isPending ? <Spinner /> : overview.data?.virtualSuggestions.length ? (
            <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {overview.data.virtualSuggestions.map((c) => (
                <li key={c.id} className="py-2">
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{c.name} <ExternalLink className="inline size-3 text-zinc-400" aria-hidden /></a>
                  <p className="text-xs text-zinc-500">{c.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No suggestions available right now.</p>
          )}
          <p className="mt-3 text-xs text-zinc-500">On Codeforces, open the contest page and choose "Virtual participation". Keep the real time limit and don't look at the editorial until it ends.</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardTitle>Record a contest</CardTitle>
          <RecordForm roadmapId={activeRoadmapId} onSaved={invalidate} />
        </Card>

        <Card>
          <CardTitle>History</CardTitle>
          {history.isPending ? <Spinner /> : history.error ? <ErrorMessage error={history.error} /> : history.data.contests.length === 0 ? (
            <EmptyState title="No contests recorded">After a rated round or a virtual contest, record it here to track results and upsolving.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    <th className="py-1.5 font-medium">Date</th>
                    <th className="py-1.5 font-medium">Contest</th>
                    <th className="py-1.5 text-right font-medium">Rating</th>
                    <th className="py-1.5 text-right font-medium">Solved</th>
                    <th className="py-1.5 text-right font-medium">Upsolved</th>
                    <th className="py-1.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {history.data.contests.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 pr-2 tabular-nums text-zinc-500">{c.contestDate}</td>
                      <td className="py-2 pr-2">
                        {c.contestName} <span className="text-xs text-zinc-500">({c.kind})</span>
                        {c.notes && <p className="text-xs text-zinc-500">{c.notes}</p>}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {c.oldRating !== null && c.newRating !== null ? (
                          <span className={ratingColor(c.newRating)}>{c.oldRating} → {c.newRating}</span>
                        ) : '–'}
                      </td>
                      <td className="py-2 text-right tabular-nums">{c.problemsSolved}</td>
                      <td className="py-2 text-right">
                        <label className="sr-only" htmlFor={`up-${c.id}`}>Upsolved problems for {c.contestName}</label>
                        <Input
                          id={`up-${c.id}`}
                          type="number"
                          min={0}
                          max={20}
                          className="ml-auto h-8 w-16 text-right"
                          defaultValue={c.upsolvedProblems}
                          onBlur={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isInteger(n) && n >= 0 && n <= 20 && n !== c.upsolvedProblems) updateUpsolved.mutate({ id: c.id, n });
                          }}
                        />
                      </td>
                      <td className="py-2 text-right">
                        <button type="button" className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800" aria-label={`Delete ${c.contestName}`} onClick={() => remove.mutate(c.id)}>
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(updateUpsolved.error || remove.error) && <div className="mt-3"><ErrorMessage error={updateUpsolved.error ?? remove.error} /></div>}
        </Card>
      </div>
    </Page>
  );
}

function RecordForm({ roadmapId, onSaved }: { roadmapId: string | null; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(localDate());
  const [kind, setKind] = useState<'rated' | 'virtual'>('rated');
  const [oldRating, setOldRating] = useState('');
  const [newRating, setNewRating] = useState('');
  const [solved, setSolved] = useState('0');
  const [upsolved, setUpsolved] = useState('0');
  const [notes, setNotes] = useState('');

  const save = useMutation({
    mutationFn: () =>
      api.recordContest({
        roadmapId,
        contestName: name,
        contestDate: date,
        kind,
        oldRating: kind === 'rated' && oldRating ? Number(oldRating) : null,
        newRating: kind === 'rated' && newRating ? Number(newRating) : null,
        problemsSolved: Number(solved),
        upsolvedProblems: Number(upsolved),
        notes,
      }),
    onSuccess: () => {
      setName('');
      setOldRating('');
      setNewRating('');
      setSolved('0');
      setUpsolved('0');
      setNotes('');
      onSaved();
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4);

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Contest name" htmlFor="c-name">
        <Input id="c-name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder="Codeforces Round … (Div. 2)" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="c-date"><Input id="c-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Type" htmlFor="c-kind">
          <Select id="c-kind" value={kind} onChange={(e) => setKind(e.target.value as 'rated' | 'virtual')}>
            <option value="rated">Rated</option>
            <option value="virtual">Virtual</option>
          </Select>
        </Field>
        {kind === 'rated' && (
          <>
            <Field label="Old rating" htmlFor="c-old"><Input id="c-old" inputMode="numeric" value={oldRating} onChange={(e) => setOldRating(digits(e.target.value))} /></Field>
            <Field label="New rating" htmlFor="c-new"><Input id="c-new" inputMode="numeric" value={newRating} onChange={(e) => setNewRating(digits(e.target.value))} /></Field>
          </>
        )}
        <Field label="Problems solved" htmlFor="c-solved"><Input id="c-solved" type="number" min={0} max={20} required value={solved} onChange={(e) => setSolved(e.target.value)} /></Field>
        <Field label="Upsolved later" htmlFor="c-up"><Input id="c-up" type="number" min={0} max={20} value={upsolved} onChange={(e) => setUpsolved(e.target.value)} /></Field>
      </div>
      <Field label="Observations" htmlFor="c-notes"><Textarea id="c-notes" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What went well, what to practise next" /></Field>
      {save.error && <ErrorMessage error={save.error} />}
      <Button type="submit" loading={save.isPending} disabled={!name.trim()}>Save result</Button>
    </form>
  );
}
