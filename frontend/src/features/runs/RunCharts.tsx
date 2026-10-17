// Per-second charts for one run. Latency, load and errors have different units, so each gets
// its own chart on one axis instead of a shared dual-axis chart.
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { runsApi, type Run } from '../../api/runs.ts';
import { Note, Tabs } from '../../components/ui/index.ts';
// Imported directly, not via the barrel, so recharts stays in the lazy chunk.
import { LineChart } from '../../components/ui/LineChart.tsx';
import { formatMs, formatSeconds, isActive } from './format.ts';
import { LATENCY_SERIES } from './series.ts';

type ChartTab = 'latency' | 'load' | 'errors';

const CHART_TABS: ReadonlyArray<{ value: ChartTab; label: string }> = [
  { value: 'latency', label: 'Latency' },
  { value: 'load', label: 'Load' },
  { value: 'errors', label: 'Errors' },
];

const CHART_NOTES: Record<ChartTab, string> = {
  latency:
    'Each point is one second of the run. Each line shows one percentile (p50, p90, p95, p99) of the requests that ended in that second: p95 is the time 95 of every 100 of them stayed at or under. With only a few requests in a second, p90, p95 and p99 often equal the slowest one. Lines that climb as users are added mean the API is slowing down.',
  load: 'Virtual users is how many simulated users were running. Requests per second is how many requests they sent. When users keep rising but requests per second stops rising, the API has reached its limit.',
  errors:
    'The share of requests in each second that did not get the status their step expects. Errors that start when the load peaks mean the API cannot handle that load.',
};

const POLL_INTERVAL_MS = 2000;

export function RunCharts({ run }: { run: Run }) {
  const [tab, setTab] = useState<ChartTab>('latency');
  const active = isActive(run.status);
  const points = useQuery({
    // Status in the key: one last fetch when the run finishes, then the cache holds.
    queryKey: ['points', run.id, run.status],
    queryFn: () => runsApi.points(run.id),
    refetchInterval: active ? POLL_INTERVAL_MS : false,
    placeholderData: (previous) => previous,
  });
  const data = points.data?.points ?? [];
  const empty = active
    ? 'Waiting for the first seconds of data…'
    : 'No per-second data for this run.';
  const shared = {
    data,
    xKey: 'second' as const,
    formatX: formatSeconds,
    loading: points.isPending,
    empty,
  };

  return (
    <div className="flex flex-col gap-4" data-testid="run-charts">
      <Tabs label="Run charts" value={tab} onChange={setTab} items={CHART_TABS} />
      {tab === 'latency' && (
        <LineChart
          integerX
          {...shared}
          title="Response time per second"
          series={LATENCY_SERIES}
          minYStep={0.1}
          formatY={(value) => formatMs(value)}
          height={260}
        />
      )}
      {tab === 'load' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <LineChart
            integerX
            {...shared}
            title="Virtual users"
            series={[{ key: 'virtualUsers', label: 'Virtual users', color: 'var(--series-1)' }]}
            integerY
          />
          <LineChart
            integerX
            {...shared}
            title="Requests per second"
            series={[{ key: 'requestsPerSecond', label: 'Requests/s', color: 'var(--series-3)' }]}
          />
        </div>
      )}
      {tab === 'errors' && (
        <LineChart
          integerX
          {...shared}
          title="Failed requests (share of each second)"
          series={[{ key: 'errorRate', label: 'Error rate', color: 'var(--danger)' }]}
          minYStep={0.001}
          formatY={(value) => `${(value * 100).toFixed(1)}%`}
        />
      )}
      {data.length > 0 && (
        <Note>
          <p className="m-0">{CHART_NOTES[tab]}</p>
        </Note>
      )}
    </div>
  );
}
