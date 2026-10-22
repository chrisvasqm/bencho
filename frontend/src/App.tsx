import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { m } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError, runsApi, type CreateRunInput, type Run, type RunsPage } from './api/runs.ts';
import { Button, Card, Checkbox, Pagination, ScrollPane, Skeleton } from './components/ui/index.ts';
import { isActive, runTypeVars } from './features/runs/format.ts';
import { LanguageSwitch } from './features/preferences/PreferenceSwitches.tsx';
import { useCopy, type Copy } from './i18n/useCopy.ts';
import { ActiveRunsWidget } from './features/runs/ActiveRunsWidget.tsx';
import { BulkDeleteBar } from './features/runs/BulkDeleteBar.tsx';
import { CompareCard } from './features/runs/CompareCard.tsx';
import { RunDetailCard } from './features/runs/RunDetailCard.tsx';
import { RunFormDrawer } from './features/runs/RunFormDrawer.tsx';
import { RunFilters } from './features/runs/RunFilters.tsx';
import { RunList } from './features/runs/RunList.tsx';
import {
  EMPTY_RUN_FILTERS,
  isFiltering,
  toListFilters,
  type RunFilterValues,
} from './features/runs/filters.ts';
import { runToInput } from './features/runs/input.ts';
import { useRunWatcher } from './features/runs/useRunWatcher.ts';
import { ThemeSwitch } from './features/theme/ThemeSwitch.tsx';

const POLL_INTERVAL_MS = 2000;
const PAGE_SIZE = 8;

/** The form drawer: closed, or open and filled from a run (the newest one, or a chosen one). */
interface FormState {
  open: boolean;
  initial?: Run;
  /** Changes on every open, so the form starts fresh each time. */
  key: number;
}

export function App() {
  const { t } = useCopy();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<RunFilterValues>(EMPTY_RUN_FILTERS);
  const listFilters = toListFilters(filters);
  const listKey = JSON.stringify(listFilters);
  const [selectedId, setSelectedId] = useState<string>();
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());
  const [form, setForm] = useState<FormState>({ open: false, key: 0 });
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
    queryKey: ['runs', 'page', listKey, page],
    queryFn: () => runsApi.list(page, PAGE_SIZE, listFilters),
    placeholderData: (previous) => previous,
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

  // While the next page's runs load, keep showing the last run instead of blinking empty.
  const [lastShown, setLastShown] = useState<Run>();
  if (selectedRun && selectedRun !== lastShown) setLastShown(selectedRun);
  const loadingNext = runs.isPending || (Boolean(effectiveId) && selected.isPending);
  const shownRun = selectedRun ?? (loadingNext ? lastShown : undefined);

  // Two ticked runs are compared in place of the selected run's results. Each has its own
  // query, so a run ticked on another page stays known after that page leaves the cache.
  const selectionKey = [...checkedIds].sort().join(',');
  const checkable = list.filter((run) => !isActive(run.status));
  const checkedOnPage = checkable.filter((run) => checkedIds.has(run.id)).length;
  const allChecked = checkable.length > 0 && checkedOnPage === checkable.length;
  const toggleAll = () => {
    const next = new Set(checkedIds);
    for (const run of checkable) {
      if (allChecked) next.delete(run.id);
      else next.add(run.id);
    }
    setCheckedIds(next);
  };
  const comparedIds = checkedIds.size === 2 ? selectionKey.split(',') : [];
  const comparedQueries = useQueries({
    queries: comparedIds.map((id) => ({
      queryKey: ['run', id],
      queryFn: () => runsApi.get(id),
      initialData: () => {
        const run = list.find((item) => item.id === id);
        return run ? { run } : undefined;
      },
      // Only finished runs can be ticked, and a finished run never changes.
      staleTime: Infinity,
    })),
  });
  const compared = comparedQueries
    .map((query) => query.data?.run)
    .filter((run): run is Run => run !== undefined);
  const comparing = comparedIds.length === 2 && compared.length === 2;

  const create = useMutation({
    mutationFn: (input: CreateRunInput) => runsApi.create(input),
    onSuccess: ({ run }) => {
      watch(run.id);
      setForm((current) => ({ ...current, open: false }));
      // The new run goes on top of the unfiltered list; filters could hide it.
      setFilters(EMPTY_RUN_FILTERS);
      setPage(1);
      setSelectedId(run.id);
      setCheckedIds(new Set());
      void queryClient.invalidateQueries({ queryKey: ['runs'] });
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

  // New run opens the form with the newest run's settings, or the defaults when there is none.
  // Page 1 of the unfiltered list is newest first, so it already holds that run; another page
  // or a filtered list needs one fetch.
  // Each open or close of the form counts; a fetch for an earlier open gives up when a later
  // action (Reuse, a close, another New run) came first.
  const formRequest = useRef(0);
  const openNewRun = async () => {
    const request = ++formRequest.current;
    const newest =
      page === 1 && !isFiltering(filters) && runs.data && !runs.isPlaceholderData
        ? list[0]
        : await runsApi
            .list(1, 1)
            .then((result) => result.runs[0])
            .catch(() => undefined);
    if (formRequest.current !== request) return;
    setForm((current) => ({ open: true, initial: newest, key: current.key + 1 }));
  };
  const openChange = (run: Run) => {
    formRequest.current += 1;
    setForm((current) => ({ open: true, initial: run, key: current.key + 1 }));
  };

  // Drop deleted runs from every cached list first: otherwise the next render still picks a
  // deleted run (the newest on the page) and fetches it again, which answers 404.
  // Only pages that still hold a deleted run change: a page fetched after the delete is already
  // right, and lowering its total again would count the run twice. The refetch fixes the rest.
  const forgetRuns = (ids: ReadonlySet<string>) => {
    queryClient.setQueriesData<RunsPage>({ queryKey: ['runs', 'page'] }, (old) => {
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
      void queryClient.invalidateQueries({ queryKey: ['runs'] });
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
      void queryClient.invalidateQueries({ queryKey: ['runs'] });
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

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="relative z-10 shrink-0 bg-surface shadow-card">
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

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 p-4 lg:min-h-0 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card
          ref={runsCardRef}
          className="lg:min-h-0"
          bodyClassName="p-0"
          scrollBody
          headerExtra={
            <div className="flex flex-col gap-2">
              <h2 className="sr-only">{t('app.runsTitle')}</h2>
              <Button
                size="md"
                className="w-full"
                onClick={() => void openNewRun()}
                disabled={!defaults.data}
                data-testid="new-run"
              >
                <Plus size={16} aria-hidden />
                {t('app.newRun')}
              </Button>
              <RunFilters
                values={filters}
                onChange={(next) => {
                  setFilters(next);
                  setPage(1);
                  setSelectedId(undefined);
                }}
              />
              <div className="flex min-h-8 items-center gap-2 text-xs text-fg-muted">
                <Checkbox
                  aria-label={t('runs.selectAll')}
                  data-testid="select-all-runs"
                  checked={allChecked}
                  indeterminate={checkedOnPage > 0 && !allChecked}
                  disabled={runs.isPending || checkable.length === 0}
                  onChange={toggleAll}
                />
                {checkedIds.size > 0 ? (
                  <BulkDeleteBar
                    count={checkedIds.size}
                    selectionKey={selectionKey}
                    deleting={removeMany.isPending}
                    onClear={() => setCheckedIds(new Set())}
                    onDelete={() => removeMany.mutate([...checkedIds])}
                  />
                ) : (
                  <span>{t('runs.compareHint')}</span>
                )}
              </div>
            </div>
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
            <p role="alert" data-testid="runs-error" className="px-4 py-3 text-sm text-danger">
              {t('app.runsLoadError')}
            </p>
          ) : (
            <RunList
              runs={list}
              loading={runs.isPending}
              selectedId={comparing ? undefined : selectedRun?.id}
              onSelect={(run) => setSelectedId(run.id)}
              pageSize={PAGE_SIZE}
              listKey={`${listKey}:${page}`}
              emptyText={t(isFiltering(filters) ? 'runs.emptyFiltered' : 'runs.empty')}
              checkedIds={checkedIds}
              onCheckedChange={setCheckedIds}
            />
          )}
        </Card>

        <ScrollPane
          className="min-w-0"
          testId="results-pane"
          labels={{ toTop: t('app.scrollToTop'), toBottom: t('app.scrollToBottom') }}
        >
          {comparing ? (
            <m.div
              key={selectionKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            >
              <CompareCard runs={compared as [Run, Run]} onClose={() => setCheckedIds(new Set())} />
            </m.div>
          ) : shownRun ? (
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
                starting={create.isPending}
                onRunAgain={(run) => create.mutate(runToInput(run))}
                onChange={openChange}
                canChange={Boolean(defaults.data)}
              />
            </m.div>
          ) : runs.isPending || (effectiveId && selected.isPending) ? (
            <Card title={<Skeleton className="h-5 w-48" />}>
              <Skeleton className="h-64 w-full" />
            </Card>
          ) : null}
        </ScrollPane>
      </main>

      <RunFormDrawer
        key={form.key}
        open={form.open}
        onOpenChange={(open) => {
          formRequest.current += 1;
          setForm((current) => ({ ...current, open }));
        }}
        defaults={defaults.data}
        initial={form.initial}
        submitting={create.isPending}
        onSubmit={async (input) => {
          await create.mutateAsync(input).catch(() => undefined);
        }}
      />

      <ActiveRunsWidget
        anchorRef={runsCardRef}
        onOpen={(run) => {
          setPage(1);
          setSelectedId(run.id);
          setCheckedIds(new Set());
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
