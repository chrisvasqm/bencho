import { memo } from 'react';
import type { LoadMode, Stage } from '../../api/runs.ts';
// Imported directly, not via the barrel, so recharts stays in the lazy chunk.
import { LineChart } from '../../components/ui/LineChart.tsx';
import { useCopy } from '../../i18n/useCopy.ts';
import { formatSeconds, plannedShape } from './format.ts';

/** Planned stage targets over time for the stages being edited. Default export for lazy(). */
function LoadShapeChart({ stages, mode }: { stages: Stage[]; mode: LoadMode }) {
  const { t } = useCopy();
  const label = t(`panel.target.${mode}`);
  return (
    <LineChart
      title={t('panel.chartTitle', { label, labelLower: label.toLowerCase() })}
      data={plannedShape(stages)}
      xTime
      curve="linear"
      testId="load-shape-chart"
      xKey="second"
      series={[{ key: 'virtualUsers', label, color: 'var(--series-1)' }]}
      formatX={formatSeconds}
      height={140}
      integerY={mode === 'users'}
      integerX
      empty={t('panel.chartEmpty')}
    />
  );
}

// Memoized: it shares the Setup tab with inputs such as the base URL, which do not change it.
export default memo(LoadShapeChart);
