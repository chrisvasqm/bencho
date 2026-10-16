// Follows runs started in this browser session and toasts once when each one finishes.
// Polls each run by id, so it keeps working when the user switches tabs or pages.
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { runsApi, type Run } from '../../api/runs.ts';
import { RUN_TYPE_LABELS, formatMs, isActive } from './format.ts';

const POLL_INTERVAL_MS = 2000;

function announce(run: Run): void {
  const label = `${RUN_TYPE_LABELS[run.type]} test`;
  const p95 = run.summary?.metrics.http_req_duration?.['p(95)'];
  const detail = p95 === undefined ? undefined : `p95 ${formatMs(p95)}`;
  if (run.status === 'passed') toast.success(`${label} passed`, { description: detail });
  else if (run.status === 'failed') {
    toast.error(`${label} failed`, {
      description: 'A limit was crossed. See the run for details.',
    });
  } else {
    toast.warning(`${label} could not finish`, {
      description: run.errorMessage?.split('\n')[0] ?? undefined,
    });
  }
}

export function useRunWatcher() {
  const queryClient = useQueryClient();
  const [watched, setWatched] = useState<string[]>([]);

  const results = useQueries({
    queries: watched.map((id) => ({
      queryKey: ['run', id],
      queryFn: () => runsApi.get(id),
      refetchInterval: POLL_INTERVAL_MS,
    })),
  });

  const finished = results
    .map((result) => result.data?.run)
    .filter((run): run is Run => run !== undefined && !isActive(run.status));
  const finishedKey = finished.map((run) => run.id).join(',');

  useEffect(() => {
    if (finished.length === 0) return;
    for (const run of finished) announce(run);
    const done = new Set(finished.map((run) => run.id));
    setWatched((current) => current.filter((id) => !done.has(id)));
    void queryClient.invalidateQueries({ queryKey: ['runs'] });
    void queryClient.invalidateQueries({ queryKey: ['trend'] });
    // finishedKey changes exactly when the set of newly finished runs changes.
  }, [finishedKey]);

  const watch = useCallback((id: string) => {
    setWatched((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  return { watch };
}
