import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Clock, ExternalLink, Eye, Lightbulb, RefreshCw, Ban } from 'lucide-react';
import { SOLVING_STATUS_LABELS, type AssignedProblem, type DailyPlanDTO, type ProblemProgressDTO, type SolvingStatus } from '@cgp/shared';
import { api } from '../services/api';
import { ROLE_LABELS, ratingColor } from '../utils/format';
import { Badge, Button, ErrorMessage, Input, Select, Textarea, cx } from './ui';

interface Props {
  problem: AssignedProblem;
  progress?: ProblemProgressDTO;
  day: Pick<DailyPlanDTO, 'id' | 'roadmapId' | 'dayNumber'>;
  blind: boolean;
  onDayChange: (day: DailyPlanDTO) => void;
}

const FINISHED: SolvingStatus[] = ['solved-independently', 'solved-with-hint', 'solved-with-editorial', 'unable-to-solve'];

export function ProblemCard({ problem, progress, day, blind, onDayChange }: Props) {
  const [status, setStatus] = useState<SolvingStatus>(progress?.solvingStatus ?? 'not-attempted');
  const [minutes, setMinutes] = useState(progress?.timeTakenMinutes?.toString() ?? '');
  const [confidence, setConfidence] = useState(progress?.confidence?.toString() ?? '');
  const [notes, setNotes] = useState(progress?.notes ?? '');
  const [showApproach, setShowApproach] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setStatus(progress?.solvingStatus ?? 'not-attempted');
    setMinutes(progress?.timeTakenMinutes?.toString() ?? '');
    setConfidence(progress?.confidence?.toString() ?? '');
    setNotes(progress?.notes ?? '');
  }, [progress]);

  const finished = FINISHED.includes(progress?.solvingStatus ?? 'not-attempted');
  const tagsVisible = !blind || finished || progress?.hintRevealed || showApproach;
  const reasonVisible = !blind || finished || showApproach;

  const save = useMutation({
    mutationFn: () =>
      api.updateProgress(day.id, {
        problemId: problem.problemId,
        solvingStatus: status,
        timeTakenMinutes: minutes === '' ? null : Number(minutes),
        confidence: confidence === '' ? null : Number(confidence),
        notes,
      }),
    onSuccess: ({ day: updated }) => {
      onDayChange(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const revealHint = useMutation({
    mutationFn: () => api.updateProgress(day.id, { problemId: problem.problemId, hintRevealed: true }),
    onSuccess: ({ day: updated }) => onDayChange(updated),
  });
  const replace = useMutation({
    mutationFn: () => api.replaceProblem(day.roadmapId, day.dayNumber, problem.problemId),
    onSuccess: ({ day: updated }) => onDayChange(updated),
  });
  const exclude = useMutation({
    mutationFn: () => api.excludeProblem(problem.problemId, day.roadmapId, day.dayNumber),
    onSuccess: ({ day: updated }) => updated && onDayChange(updated),
  });

  const id = `p-${problem.problemId}`;
  const error = save.error ?? revealHint.error ?? replace.error ?? exclude.error;

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={problem.role === 'stretch' ? 'violet' : 'blue'}>{ROLE_LABELS[problem.role]}</Badge>
            <Badge tone={problem.mandatory ? 'neutral' : 'violet'}>{problem.mandatory ? 'Mandatory' : 'Optional'}</Badge>
            {progress && progress.solvingStatus !== 'not-attempted' && (
              <Badge tone={progress.solvingStatus === 'unable-to-solve' ? 'amber' : 'green'}>{SOLVING_STATUS_LABELS[progress.solvingStatus]}</Badge>
            )}
          </div>
          <h3 id={`${id}-title`} className="text-base font-semibold">
            <a href={problem.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
              {problem.problemId} · {problem.name}
              <ExternalLink className="size-3.5 text-zinc-400" aria-label="(opens Codeforces in a new tab)" />
            </a>
          </h3>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={cx('font-semibold tabular-nums', ratingColor(problem.rating))} title="Codeforces problem rating">
            {problem.rating}
          </span>
          <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400" title="Estimated solving time">
            <Clock className="size-3.5" aria-hidden />~{problem.estimatedMinutes} min
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tagsVisible ? (
          problem.tags.length ? (
            problem.tags.map((t) => (
              <span key={t} className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                {t}
              </span>
            ))
          ) : (
            <span className="text-xs text-zinc-500">No tags on Codeforces</span>
          )
        ) : (
          <>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Tags hidden (Blind Practice)</span>
            <Button variant="ghost" size="sm" onClick={() => revealHint.mutate()} loading={revealHint.isPending}>
              <Lightbulb className="size-3.5" aria-hidden /> Reveal tags as a hint
            </Button>
          </>
        )}
      </div>

      {reasonVisible ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Why this problem: </span>
          {problem.reason}
        </p>
      ) : (
        <Button variant="ghost" size="sm" className="mt-1" onClick={() => setShowApproach(true)}>
          <Eye className="size-3.5" aria-hidden /> Reveal the intended approach
        </Button>
      )}

      <form
        className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-[1fr_7rem_7rem] dark:border-zinc-800"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-1">
          <label htmlFor={`${id}-status`} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Outcome
          </label>
          <Select id={`${id}-status`} value={status} onChange={(e) => setStatus(e.target.value as SolvingStatus)}>
            {Object.entries(SOLVING_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-time`} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Minutes
          </label>
          <Input id={`${id}-time`} type="number" min={0} max={1440} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-conf`} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Confidence
          </label>
          <Select id={`${id}-conf`} value={confidence} onChange={(e) => setConfidence(e.target.value)}>
            <option value="">–</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-3">
          <label htmlFor={`${id}-notes`} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Notes (key idea, mistakes)
          </label>
          <Textarea id={`${id}-notes`} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
          <Button type="submit" size="sm" loading={save.isPending}>
            Save
          </Button>
          {saved && <span className="text-xs text-green-700 dark:text-green-400">Saved</span>}
          <span className="flex-1" />
          <Button type="button" variant="ghost" size="sm" onClick={() => replace.mutate()} loading={replace.isPending} title="Swap for another problem that fits this day">
            <RefreshCw className="size-3.5" aria-hidden /> Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => exclude.mutate()}
            loading={exclude.isPending}
            title="Mark as already solved: it will be excluded from future plans and replaced here"
          >
            <Ban className="size-3.5" aria-hidden /> Already solved
          </Button>
        </div>
      </form>
      {error && (
        <div className="mt-3">
          <ErrorMessage error={error} />
        </div>
      )}
    </article>
  );
}
