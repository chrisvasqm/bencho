import type { Stage } from '../../api/runs.ts';
// Imported directly, not via the barrel, so recharts stays in the lazy chunk.
import { LineChart } from '../../components/ui/LineChart.tsx';
import { formatSeconds, plannedShape } from './format.ts';

/** Planned virtual users over time for the stages being edited. Default export for lazy(). */
export default function LoadShapeChart({ stages }: { stages: Stage[] }) {
  return (
    <LineChart
      title="Planned virtual users"
      data={plannedShape(stages)}
      xKey="second"
      series={[{ key: 'virtualUsers', label: 'Virtual users', color: 'var(--series-1)' }]}
      formatX={formatSeconds}
      height={140}
      integerY
      integerX
      empty="Fix the stage durations to see the shape."
    />
  );
}
