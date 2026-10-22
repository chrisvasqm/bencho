import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { m } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ApiError,
  RUN_TYPES,
  runsApi,
  type CreateRunInput,
  type Run,
  type RunType,
  type RunsPage,
} from './api/runs.ts';
import { Card, Pagination, Skeleton, Tabs } from './components/ui/index.ts';
import { isActive, runTypeVars } from './features/runs/format.ts';
import { LanguageSwitch } from './features/preferences/PreferenceSwitches.tsx';
import { useCopy, type Copy } from './i18n/useCopy.ts';
import { ActiveRunsWidget } from './features/runs/ActiveRunsWidget.tsx';
import { BulkDeleteBar } from './features/runs/BulkDeleteBar.tsx';
import { RunDetailCard } from './features/runs/RunDetailCard.tsx';
import { RunPanel } from './features/runs/RunPanel.tsx';
import { RunsTable } from './features/runs/RunsTable.tsx';
import { useRunWatcher } from './features/runs/useRunWatcher.ts';
import { ThemeSwitch } from './features/theme/ThemeSwitch.tsx';

const POLL_INTERVAL_MS = 2000;
const PAGE_SIZE = 8;

export function App() {
  const { t } = useCopy();
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
      toast.error(t('app.backendDown'), {
        id: 'backend-down',
        testId: 'toast-backend-down',
        description: t('app.backendDownHint'),
      });
    }
    // Not on `t`: a language switch must not bring back a toast the user closed.
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
      toast.info(t('toast.started', runTypeVars(run.type, t)), {
        description: t('toast.startedHint'),
        testId: 'toast-run-started',
      });
    },
    onError: (error) => {
      toast.error(t('toast.startFailed'), {
        description: describeError(error, t),
        testId: 'toast-run-start-error',
      });
    },
  });

  // Drop deleted runs from every cached list first: otherwise the next render still picks a
  // deleted run (the newest on the page) and fetches it again, which answers 404.
  // Only pages that still hold a deleted run change: a page fetched after the delete is already
  // right, and lowering its total again would count the run twice. The refetch fixes the rest.
  const forgetRuns = (ids: ReadonlySet<string>) => {
    queryClient.setQueriesData<RunsPage>({ queryKey: ['runs'] }, (old) => {
      if (!old) return old;
      const runs = old.runs.filter((item) => !ids.has(item.id));
      return { ...old, runs, total: old.total - (old.runs.length - runs.length) };
    });
    for (const id of ids) {
      queryClient.removeQueries({ queryKey: ['run', id] });
      queryClient.removeQueries({ queryKey: ['points', id] });
    }
  };

  const remove = useMutation({
    mutationFn: (run: Run) => runsApi.remove(run.id),
    onSuccess: (_result, run) => {
      setSelectedId(undefined);
      setCheckedIds((current) => {
        const next = new Set(current);
        next.delete(run.id);
        return next;
      });
      forgetRuns(new Set([run.id]));
      void queryClient.invalidateQueries({ queryKey: ['runs', run.type] });
      toast.success(t('toast.deleted'), { testId: 'toast-run-deleted' });
    },
    onError: (error) => {
      toast.error(t('toast.deleteFailed'), { description: describeError(error, t) });
    },
  });

  const stop = useMutation({
    mutationFn: (run: Run) => runsApi.stop(run.id),
    onSuccess: ({ run }) => {
      // The watcher toasts once k6 has exited and the outcome is stored.
      watch(run.id);
      toast.info(t('toast.stopping', runTypeVars(run.type, t)));
      void queryClient.invalidateQueries({ queryKey: ['run', run.id] });
    },
    onError: (error) => {
      toast.error(t('toast.stopFailed'), { description: describeError(error, t) });
    },
  });

  const removeMany = useMutation({
    mutationFn: (ids: string[]) => runsApi.removeMany(ids),
    onSuccess: ({ deleted, skipped }) => {
      const gone = new Set(deleted);
      if (selectedId && gone.has(selectedId)) setSelectedId(undefined);
      setCheckedIds(new Set());
      forgetRuns(gone);
      void queryClient.invalidateQueries({ queryKey: ['runs', type] });
      const label = t('toast.bulkDeleted', { count: deleted.length });
      if (skipped.length === 0) toast.success(label, { testId: 'toast-runs-deleted' });
      else {
        toast.warning(label, {
          description: t('toast.bulkSkipped', { count: skipped.length }),
          testId: 'toast-runs-partly-deleted',
        });
      }
    },
    onError: (error) => {
      toast.error(t('toast.bulkDeleteFailed'), { description: describeError(error, t) });
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
            <h1 className="text-lg leading-tight font-semibold tracking-tight text-fg">Bencho</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
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
            title={t('app.runsTitle')}
            description={t('app.runsDescription')}
            actions={
              <BulkDeleteBar
                count={checkedIds.size}
                selectionKey={[...checkedIds].sort().join(',')}
                deleting={removeMany.isPending}
                onClear={() => setCheckedIds(new Set())}
                onDelete={() => removeMany.mutate([...checkedIds])}
              />
            }
            headerExtra={
              <Tabs
                label={t('panel.testType')}
                testId="type-tab"
                value={type}
                onChange={selectType}
                items={RUN_TYPES.map((value) => ({ value, label: t(`runType.${value}`) }))}
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
              <p role="alert" data-testid="runs-error" className="text-sm text-danger">
                {t('app.runsLoadError')}
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

          {shownRun ? (
            <m.div
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
            </m.div>
          ) : runs.isPending || (effectiveId && selected.isPending) ? (
            <Card title={<Skeleton className="h-5 w-48" />}>
              <Skeleton className="h-64 w-full" />
            </Card>
          ) : null}
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

/** A translated message for a known error code, else the backend's own (English) message. */
function describeError(error: Error, t: Copy): string {
  if (!(error instanceof ApiError)) return t('errors.offline');
  if (error.code === 'VALIDATION') return t('errors.validation');
  // TOO_MANY_RUNS sends its limit; TARGET_NOT_ALLOWED the refused host.
  const details = (error.details ?? {}) as { max?: number; host?: string };
  return t(`errors.${error.code}` as 'errors.INTERNAL', {
    defaultValue: error.message,
    max: details.max,
    host: details.host,
  });
}
