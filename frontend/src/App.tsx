import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ApiError,
  RUN_TYPES,
  runsApi,
  type CreateRunInput,
  type Run,
  type RunType,
} from './api/runs.ts';
import { Card, Tabs } from './components/ui/index.ts';
import { RUN_TYPE_LABELS, isActive } from './features/runs/format.ts';
import { RunDetail } from './features/runs/RunDetail.tsx';
import { RunForm } from './features/runs/RunForm.tsx';
import { RunsTable } from './features/runs/RunsTable.tsx';

const POLL_INTERVAL_MS = 2000;

export function App() {
  const [type, setType] = useState<RunType>('load');
  const [selectedId, setSelectedId] = useState<string>();
  const queryClient = useQueryClient();

  const defaults = useQuery({
    queryKey: ['defaults'],
    queryFn: runsApi.defaults,
    staleTime: Infinity,
  });
  const runs = useQuery({
    queryKey: ['runs', type],
    queryFn: () => runsApi.list(type),
    refetchInterval: (query) =>
      query.state.data?.runs.some((run) => isActive(run.status)) ? POLL_INTERVAL_MS : false,
  });

  const create = useMutation({
    mutationFn: (input: CreateRunInput) => runsApi.create(input),
    onSuccess: ({ run }) => {
      setSelectedId(run.id);
      void queryClient.invalidateQueries({ queryKey: ['runs', run.type] });
    },
  });

  const selectType = (next: RunType) => {
    setType(next);
    setSelectedId(undefined);
  };

  const list = runs.data?.runs ?? [];
  const selected: Run | undefined = list.find((run) => run.id === selectedId) ?? list[0];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Load Bench</h1>
        <p className="max-w-2xl text-sm text-fg-muted">
          Point k6 at any HTTP endpoint, shape the traffic, set the limits, and keep every run on
          record by test type.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <Card title="New run" className="self-start">
          {defaults.isPending && <p className="text-sm text-fg-muted">Loading defaults…</p>}
          {defaults.isError && (
            <p role="alert" className="text-sm text-danger">
              The backend is not reachable. Start it with{' '}
              <code className="font-mono">docker compose up</code>.
            </p>
          )}
          {defaults.data && (
            <RunForm
              defaults={defaults.data}
              type={type}
              onTypeChange={selectType}
              submitting={create.isPending}
              submitError={create.error ? describeError(create.error) : undefined}
              onSubmit={async (input) => {
                await create.mutateAsync(input).catch(() => undefined);
              }}
            />
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Runs" description="Newest first. Select a run to see its numbers.">
            <div className="flex flex-col gap-4">
              <Tabs
                label="Test type"
                value={type}
                onChange={selectType}
                items={RUN_TYPES.map((value) => ({ value, label: RUN_TYPE_LABELS[value] }))}
              />
              {runs.isError ? (
                <p role="alert" className="text-sm text-danger">
                  Could not load runs. Retrying…
                </p>
              ) : (
                <RunsTable
                  runs={list}
                  selectedId={selected?.id}
                  onSelect={(run) => setSelectedId(run.id)}
                />
              )}
            </div>
          </Card>

          {selected && (
            <Card title={`${RUN_TYPE_LABELS[selected.type]} run`} description={selected.id}>
              <RunDetail run={selected} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function describeError(error: Error): string {
  if (error instanceof ApiError && error.code === 'VALIDATION') {
    return 'Check the form: the backend rejected one of the values.';
  }
  return error.message || 'The run could not be started.';
}
