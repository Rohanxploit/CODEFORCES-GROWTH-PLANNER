import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../services/api';

/** Real round trip to /api/health — confirms client, server and database wiring. */
export function ServerStatus() {
  const { data, error, isPending } = useQuery({ queryKey: ['health'], queryFn: getHealth });

  let dot = 'bg-zinc-400';
  let label = 'Checking server…';
  if (error) {
    dot = 'bg-red-500';
    label = `Server unreachable: ${error.message}`;
  } else if (data) {
    dot = data.database === 'connected' ? 'bg-green-500' : 'bg-amber-500';
    label = `Server online · database ${data.database}`;
  }

  return (
    <p className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400" role="status" aria-busy={isPending}>
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      {label}
    </p>
  );
}
