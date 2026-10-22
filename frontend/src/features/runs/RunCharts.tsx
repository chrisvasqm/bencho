// Per-second charts for one run. Latency, load and errors have different units, so each gets
// its own chart on one axis instead of a shared dual-axis chart.
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { runsApi, type Run } from '../../api/runs.ts';
import { Tabs } from '../../components/ui/index.ts';
import { LearnMore } from '../learn/LearnMore.tsx';
// Imported directly, not via the barrel, so recharts stays in the lazy chunk.
import { LineChart } from '../../components/ui/LineChart.tsx';
import { formatMs, formatSeconds, isActive, plannedShape, targetAt } from './format.ts';
import { useCopy } from '../../i18n/useCopy.ts';
import { LATENCY_SERIES } from './series.ts';

type ChartTab = 'latency' | 'load' | 'errors';

const CHART_TABS: readonly ChartTab[] = ['latency', 'load', 'errors'];

const CHART_NOTES = {
  latency: 'charts.noteLatency',
  load: 'charts.noteLoad',
  errors: 'charts.noteErrors',
} as const;

const POLL_INTERVAL_MS = 2000;

export function RunCharts({ run }: { run: Run }) {
  const { t } = useCopy();
  const [tab, setTab] = useState<ChartTab>('latency');
  const active = isActive(run.status);
  const points = useQuery({
    // Status in the key: one last fetch when the run finishes, then the cache holds.
    queryKey: ['points', run.id, run.status],
    queryFn: () => runsApi.points(run.id),
    refetchInterval: active ? POLL_INTERVAL_MS : false,
    placeholderData: (previous) => previous,
  });
  const data = useMemo(() => points.data?.points ?? [], [points.data]);
  // Rate runs only: each point with the rate the stages planned for that second.
  const rateData = useMemo(() => {
    if (run.mode !== 'rate') return [];
    const shape = plannedShape(run.stages);
    return data.map((point) => ({ ...point, target: targetAt(shape, point.second) }));
  }, [data, run.mode, run.stages]);
  const empty = active ? t('charts.waiting') : t('charts.none');
  const shared = {
    data,
    xKey: 'second' as const,
    formatX: formatSeconds,
    xTime: true,
    loading: points.isPending,
    empty,
  };

  return (
    <div className="flex flex-col gap-4" data-testid="run-charts">
      <Tabs
        label={t('charts.label')}
        testId="chart-tab"
        value={tab}
        onChange={setTab}
        items={CHART_TABS.map((value) => ({ value, label: t(`charts.tabs.${value}`) }))}
      />
      {tab === 'latency' && (
        <LineChart
          integerX
          {...shared}
          title={t('charts.latencyTitle')}
          series={LATENCY_SERIES}
          minYStep={0.1}
          formatY={(value) => formatMs(value)}
          height={260}
        />
      )}
      {tab === 'load' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {run.mode === 'rate' && (
            <div className="xl:col-span-2">
              <LineChart
                integerX
                {...shared}
                data={rateData}
                title={t('charts.rateTitle')}
                testId="rate-chart"
                // The plan is straight lines between stage targets; values up to 2 decimals.
                curve="linear"
                formatY={(value) => String(Math.round(value * 100) / 100)}
                series={[
                  {
                    key: 'target',
                    label: t('charts.planned'),
                    color: 'var(--series-2)',
                    dash: '4 3',
                  },
                  {
                    key: 'iterationsPerSecond',
                    label: t('charts.finished'),
                    color: 'var(--series-1)',
                  },
                  { key: 'droppedPerSecond', label: t('charts.dropped'), color: 'var(--danger)' },
                ]}
              />
            </div>
          )}
          <LineChart
            integerX
            {...shared}
            title={t('charts.users')}
            series={[{ key: 'virtualUsers', label: t('charts.users'), color: 'var(--series-1)' }]}
            integerY
          />
          <LineChart
            integerX
            {...shared}
            title={t('charts.requestsTitle')}
            series={[
              { key: 'requestsPerSecond', label: t('charts.requests'), color: 'var(--series-3)' },
            ]}
          />
        </div>
      )}
      {tab === 'errors' && (
        <LineChart
          integerX
          {...shared}
          title={t('charts.errorsTitle')}
          series={[{ key: 'errorRate', label: t('charts.errorRate'), color: 'var(--danger)' }]}
          minYStep={0.001}
          formatY={(value) => `${(value * 100).toFixed(1)}%`}
        />
      )}
      {data.length > 0 && (
        <LearnMore
          testId="learn-chart"
          title={t('charts.learnTitle')}
          paragraphs={[
            t(CHART_NOTES[tab]),
            ...(tab === 'load' && run.mode === 'rate' ? [t('charts.noteRate')] : []),
          ]}
        />
      )}
    </div>
  );
}
