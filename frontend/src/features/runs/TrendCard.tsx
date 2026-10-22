// Latency percentiles across the latest finished runs of one type, oldest on the left.
import { useQuery } from '@tanstack/react-query';
import { runsApi, type RunType } from '../../api/runs.ts';
import { Card, Note } from '../../components/ui/index.ts';
// Imported directly, not via the barrel, so recharts stays in the lazy chunk.
import { LineChart } from '../../components/ui/LineChart.tsx';
import { LATENCY_SERIES } from './series.ts';
import { useCopy } from '../../i18n/useCopy.ts';
import { formatMs, formatTime, runTypeVars } from './format.ts';

const TREND_RUNS = 20;

export function TrendCard({ type }: { type: RunType }) {
  const { t, language } = useCopy();
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
        when: formatTime(run.createdAt, language),
        p50: duration?.med ?? null,
        p90: duration?.['p(90)'] ?? null,
        p95: duration?.['p(95)'] ?? null,
        p99: duration?.['p(99)'] ?? null,
      };
    });

  return (
    <Card
      title={t('app.trendTitle')}
      description={t('app.trendDescription', { count: TREND_RUNS, ...runTypeVars(type, t) })}
    >
      <LineChart
        title={t('app.trendChart')}
        data={data}
        xKey="when"
        xType="category"
        series={LATENCY_SERIES}
        minYStep={0.1}
        formatY={(value) => formatMs(value)}
        loading={trend.isPending}
        empty={t('app.trendEmpty')}
      />
      {data.length > 0 && (
        <Note className="mt-4">
          <p className="m-0">{t('app.trendNote')}</p>
        </Note>
      )}
    </Card>
  );
}
