import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ApiError,
  RUN_TYPES,
  runsApi,
  type CreateRunInput,
  type Run,
  type RunType,
} from './api/runs.ts';
import { Card, Pagination, Skeleton, Tabs } from './components/ui/index.ts';
import { RUN_TYPE_LABELS, isActive } from './features/runs/format.ts';
import { ActiveRunsWidget } from './features/runs/ActiveRunsWidget.tsx';
import { BulkDeleteBar } from './features/runs/BulkDeleteBar.tsx';
import { RunDetailCard } from './features/runs/RunDetailCard.tsx';
import { RunPanel } from './features/runs/RunPanel.tsx';
import { RunsTable } from './features/runs/RunsTable.tsx';
import { useRunWatcher } from './features/runs/useRunWatcher.ts';
import { ThemeSwitch } from './features/theme/ThemeSwitch.tsx';

const POLL_INTERVAL_MS = 2000;

const TrendCard = lazy(() =>
  import('./features/runs/TrendCard.tsx').then((module) => ({ default: module.TrendCard })),
);
const PAGE_SIZE = 8;

export function App() {
  const [type, setType] = useState<RunType>('load');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string>();
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());
  const runsCardRef = useRef<HTMLElement>(null);
  const queryClient = useQueryClient();
  const { watch } = useRunWatcher();

  const defaults = useQuery({
    queryKey: ['defaults'],
    queryFn: runsApi.defaults,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (defaults.isError) {
      toast.error('Bencho cannot reach the backend', {
        id: 'backend-down',
        description: 'Start the stack with docker compose up, then reload.',
      });
    }
  }, [defaults.isError]);

  const runs = useQuery({
    queryKey: ['runs', type, page],
    queryFn: () => runsApi.list(type, page, PAGE_SIZE),
    placeholderData: (previous) => (previous?.runs[0]?.type === type ? previous : undefined),
    refetchInterval: (query) =>
      query.state.data?.runs.some((run) => isActive(run.status)) ? POLL_INTERVAL_MS : false,
  });
  const list = runs.data?.runs ?? [];
  const total = runs.data?.total ?? 0;

  // A page past the end (runs deleted elsewhere): step back to the last page that has runs.
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (runs.data && page > lastPage) setPage(lastPage);
  }, [runs.data, page, lastPage]);

  // Fall back to the newest run on the page when nothing is picked (or the pick was deleted).
  const effectiveId = selectedId ?? list[0]?.id;
  const selected = useQuery({
    queryKey: ['run', effectiveId],
    queryFn: () => runsApi.get(effectiveId!),
    enabled: Boolean(effectiveId),
    initialData: () => {
      const run = list.find((item) => item.id === effectiveId);
      return run ? { run } : undefined;
    },
    refetchInterval: (query) =>
      query.state.data && isActive(query.state.data.run.status) ? POLL_INTERVAL_MS : false,
  });
  const selectedRun: Run | undefined = selected.data?.run;

  // While the next type's runs load, keep showing the last run instead of blinking empty.
  const [lastShown, setLastShown] = useState<Run>();
  if (selectedRun && selectedRun !== lastShown) setLastShown(selectedRun);
  const loadingNext = runs.isPending || (Boolean(effectiveId) && selected.isPending);
  const shownRun = selectedRun ?? (loadingNext ? lastShown : undefined);

  const create = useMutation({
    mutationFn: (input: CreateRunInput) => runsApi.create(input),
    onSuccess: ({ run }) => {
      watch(run.id);
      setPage(1);
      setSelectedId(run.id);
      void queryClient.invalidateQueries({ queryKey: ['runs', run.type] });
      void queryClient.invalidateQueries({ queryKey: ['runs', 'active'] });
      toast.info(`${RUN_TYPE_LABELS[run.type]} test started`, {
        description: 'You will get a message when it finishes.',
      });
    },
    onError: (error) => {
      toast.error('The run did not start', { description: describeError(error) });
    },
  });

  const remove = useMutation({
    mutationFn: (run: Run) => runsApi.remove(run.id),
    onSuccess: (_result, run) => {
      setSelectedId(undefined);
      setCheckedIds((current) => {
        const next = new Set(current);
        next.delete(run.id);
        return next;
      });
      queryClient.removeQueries({ queryKey: ['run', run.id] });
      queryClient.removeQueries({ queryKey: ['points', run.id] });
      void queryClient.invalidateQueries({ queryKey: ['runs', run.type] });
      void queryClient.invalidateQueries({ queryKey: ['trend', run.type] });
      toast.success('Run deleted');
    },
    onError: (error) => {
      toast.error('The run was not deleted', { description: describeError(error) });
    },
  });

  const stop = useMutation({
    mutationFn: (run: Run) => runsApi.stop(run.id),
    onSuccess: ({ run }) => {
      // The watcher toasts once k6 has exited and the outcome is stored.
      watch(run.id);
      toast.info(`Stopping ${RUN_TYPE_LABELS[run.type].toLowerCase()} test…`);
      void queryClient.invalidateQueries({ queryKey: ['run', run.id] });
    },
    onError: (error) => {
      toast.error('The run did not stop', { description: describeError(error) });
    },
  });

  const removeMany = useMutation({
    mutationFn: (ids: string[]) => runsApi.removeMany(ids),
    onSuccess: ({ deleted, skipped }) => {
      const gone = new Set(deleted);
      if (selectedId && gone.has(selectedId)) setSelectedId(undefined);
      setCheckedIds(new Set());
      for (const id of deleted) {
        queryClient.removeQueries({ queryKey: ['run', id] });
        queryClient.removeQueries({ queryKey: ['points', id] });
      }
      void queryClient.invalidateQueries({ queryKey: ['runs', type] });
      void queryClient.invalidateQueries({ queryKey: ['trend', type] });
      const label = `${deleted.length} ${deleted.length === 1 ? 'run' : 'runs'} deleted`;
      if (skipped.length === 0) toast.success(label);
      else {
        toast.warning(label, {
          description: `${skipped.length} could not be deleted: still running or already gone.`,
        });
      }
    },
    onError: (error) => {
      toast.error('The runs were not deleted', { description: describeError(error) });
    },
  });

  const selectType = (next: RunType) => {
    setType(next);
    setPage(1);
    setSelectedId(undefined);
    setCheckedIds(new Set());
  };

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="shrink-0 bg-surface">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-lg leading-tight font-semibold tracking-tight text-fg">Bencho</h1>
              <p className="hidden max-w-[60ch] text-xs text-fg-muted sm:block">
                Load, stress and spike tests with k6. Every run is kept by type.
              </p>
            </div>
          </div>
          <ThemeSwitch />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 p-4 lg:min-h-0 lg:grid-cols-[400px_minmax(0,1fr)]">
        <RunPanel
          defaults={defaults.data}
          type={type}
          onTypeChange={selectType}
          submitting={create.isPending}
          onSubmit={async (input) => {
            await create.mutateAsync(input).catch(() => undefined);
          }}
          className="lg:min-h-0"
        />

        <div className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <Card
            ref={runsCardRef}
            title="Runs"
            description="Newest first. Select a run to see its numbers."
            actions={
              <BulkDeleteBar
                count={checkedIds.size}
                deleting={removeMany.isPending}
                onClear={() => setCheckedIds(new Set())}
                onDelete={() => removeMany.mutate([...checkedIds])}
              />
            }
            headerExtra={
              <Tabs
                label="Test type"
                value={type}
                onChange={selectType}
                items={RUN_TYPES.map((value) => ({ value, label: RUN_TYPE_LABELS[value] }))}
              />
            }
            footer={
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={(next) => {
                  setPage(next);
                  setSelectedId(undefined);
                }}
                loading={runs.isFetching}
              />
            }
          >
            {runs.isError ? (
              <p role="alert" className="text-sm text-danger">
                Could not load runs. Bencho tries again on the next update.
              </p>
            ) : (
              <RunsTable
                runs={list}
                loading={runs.isPending}
                selectedId={selectedRun?.id}
                onSelect={(run) => setSelectedId(run.id)}
                pageSize={PAGE_SIZE}
                listKey={`${type}:${page}`}
                checkedIds={checkedIds}
                onCheckedChange={setCheckedIds}
              />
            )}
          </Card>

          {/* Swap in place: no exit phase, so the trend card below never jumps up and back. */}
          {shownRun ? (
            <motion.div
              key={shownRun.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            >
              <RunDetailCard
                run={shownRun}
                deleting={remove.isPending}
                onDelete={(run) => remove.mutate(run)}
                stopping={stop.isPending}
                onStop={(run) => stop.mutate(run)}
              />
            </motion.div>
          ) : runs.isPending || (effectiveId && selected.isPending) ? (
            <Card title={<Skeleton className="h-5 w-48" />}>
              <Skeleton className="h-64 w-full" />
            </Card>
          ) : null}

          <Suspense
            fallback={
              <Card title="Trend">
                <Skeleton className="h-56 w-full" />
              </Card>
            }
          >
            <TrendCard type={type} />
          </Suspense>
        </div>
      </main>

      <ActiveRunsWidget
        anchorRef={runsCardRef}
        onOpen={(run) => {
          setType(run.type);
          setPage(1);
          setSelectedId(run.id);
          runsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--logo-bg)" />
      <rect x="7" y="17" width="4" height="8" rx="1.5" fill="var(--logo-fg)" />
      <rect x="14" y="11" width="4" height="14" rx="1.5" fill="var(--logo-fg)" />
      <rect x="21" y="6" width="4" height="19" rx="1.5" fill="var(--logo-bar)" />
    </svg>
  );
}

function describeError(error: Error): string {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION') return 'The backend rejected one of the values.';
    return error.message;
  }
  return 'Bencho cannot reach the backend. Check that the stack is running.';
}
