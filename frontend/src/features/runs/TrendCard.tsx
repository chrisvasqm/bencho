// Latency percentiles across the latest finished runs of one type, oldest on the left.
import { useQuery } from '@tanstack/react-query';
import { runsApi, type RunType } from '../../api/runs.ts';
import { Card } from '../../components/ui/index.ts';
// Imported directly, not via the barrel, so recharts stays in the lazy chunk.
import { LineChart } from '../../components/ui/LineChart.tsx';
import { LATENCY_SERIES } from './RunCharts.tsx';
import { RUN_TYPE_LABELS, formatMs, formatTime } from './format.ts';

const TREND_RUNS = 20;

export function TrendCard({ type }: { type: RunType }) {
  const trend = useQuery({
    queryKey: ['trend', type],
    queryFn: () => runsApi.list(type, 1, TREND_RUNS),
  });
  const data = (trend.data?.runs ?? [])
    .filter((run) => run.summary?.metrics.http_req_duration)
    .reverse()
    .map((run) => {
      const duration = run.summary?.metrics.http_req_duration;
      return {
        when: formatTime(run.createdAt),
        p50: duration?.med ?? null,
        p90: duration?.['p(90)'] ?? null,
        p95: duration?.['p(95)'] ?? null,
        p99: duration?.['p(99)'] ?? null,
      };
    });

  return (
    <Card
      title="Trend"
      description={`Latency of the last ${TREND_RUNS} ${RUN_TYPE_LABELS[type].toLowerCase()} runs, oldest first`}
    >
      <LineChart
        title="Response time per run"
        data={data}
        xKey="when"
        xType="category"
        series={LATENCY_SERIES}
        formatY={(value) => formatMs(value)}
        loading={trend.isPending}
        empty="Finish a run of this type to start the trend."
      />
    </Card>
  );
}
