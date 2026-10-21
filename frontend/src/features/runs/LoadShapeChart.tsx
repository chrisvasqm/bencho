import type { LoadMode, Stage } from '../../api/runs.ts';
// Imported directly, not via the barrel, so recharts stays in the lazy chunk.
import { LineChart } from '../../components/ui/LineChart.tsx';
import { TARGET_LABELS, formatSeconds, plannedShape } from './format.ts';

/** Planned stage targets over time for the stages being edited. Default export for lazy(). */
export default function LoadShapeChart({ stages, mode }: { stages: Stage[]; mode: LoadMode }) {
  const label = TARGET_LABELS[mode];
  return (
    <LineChart
      title={`Planned ${label.toLowerCase()}`}
      data={plannedShape(stages)}
      xTime
      curve="linear"
      testId="load-shape-chart"
      xKey="second"
      series={[{ key: 'virtualUsers', label, color: 'var(--series-1)' }]}
      formatX={formatSeconds}
      height={140}
      integerY
      integerX
      empty="Fix the stage durations to see the shape."
    />
  );
}
