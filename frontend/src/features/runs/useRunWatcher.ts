// Follows runs started in this browser session, plus runs already in progress when the page
// loads, and toasts once when each one finishes.
// Polls each run by id, so it keeps working when the user switches tabs or pages.
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { runsApi, type Run } from '../../api/runs.ts';
import { RUN_TYPE_LABELS, formatMs, isActive } from './format.ts';

const POLL_INTERVAL_MS = 2000;

function announce(run: Run): void {
  const label = `${RUN_TYPE_LABELS[run.type]} test`;
  const p95 = run.summary?.metrics.http_req_duration?.['p(95)'];
  const detail = p95 === undefined ? undefined : `p95 ${formatMs(p95)}`;
  if (run.status === 'passed')
    toast.success(`${label} passed`, { description: detail, testId: 'toast-run-passed' });
  else if (run.status === 'failed') {
    toast.error(`${label} failed`, {
      description: 'A limit was crossed. See the run for details.',
      testId: 'toast-run-failed',
    });
  } else if (run.status === 'stopped') {
    toast(`${label} stopped`, {
      description: 'Partial results were kept.',
      testId: 'toast-run-stopped',
    });
  } else {
    toast.warning(`${label} could not finish`, {
      description: run.errorMessage?.split('\n')[0] ?? undefined,
      testId: 'toast-run-error',
    });
  }
}

export function useRunWatcher() {
  const queryClient = useQueryClient();
  const [watched, setWatched] = useState<string[]>([]);
  const announced = useRef(new Set<string>());

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
    for (const run of finished) {
      announced.current.add(run.id);
      announce(run);
    }
    const done = new Set(finished.map((run) => run.id));
    setWatched((current) => current.filter((id) => !done.has(id)));
    void queryClient.invalidateQueries({ queryKey: ['runs'] });
    void queryClient.invalidateQueries({ queryKey: ['trend'] });
    // finishedKey changes exactly when the set of newly finished runs changes.
  }, [finishedKey]);

  const watch = useCallback((id: string) => {
    // A stale active list can still name a run that was already announced; never re-add it.
    if (announced.current.has(id)) return;
    setWatched((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  // Also follow runs that were in progress when the page loaded, so a reload does not lose their
  // finish toast. Only the first answer counts: runs started later in other tabs are theirs.
  // Shares the active-runs query (and its polling) with ActiveRunsWidget.
  const active = useQuery({ queryKey: ['runs', 'active'], queryFn: runsApi.active });
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !active.data) return;
    seeded.current = true;
    for (const run of active.data.runs) watch(run.id);
  }, [active.data, watch]);

  return { watch };
}
