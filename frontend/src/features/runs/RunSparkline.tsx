// The p95 line of one run, small enough for a list row. Shares the points query with the charts,
// so the selected run costs no extra request.
import { useQuery } from '@tanstack/react-query';
import { runsApi, type Run } from '../../api/runs.ts';
import { Sparkline } from '../../components/ui/Sparkline.tsx';
import { isActive } from './format.ts';

const POLL_INTERVAL_MS = 2000;

export interface RunSparklineProps {
  run: Run;
  width?: number;
  height?: number;
  /** Shade under the line and draw the p95 limit. */
  detailed?: boolean;
}

export function RunSparkline({ run, width, height, detailed }: RunSparklineProps) {
  const active = isActive(run.status);
  const points = useQuery({
    queryKey: ['points', run.id, run.status],
    queryFn: () => runsApi.points(run.id),
    refetchInterval: active ? POLL_INTERVAL_MS : false,
    // A finished run's points never change.
    staleTime: active ? 0 : Infinity,
    // The key changes with the status; the old line stays until the new one arrives.
    placeholderData: (previous) => previous,
  });
  // One value per second: a second with no requests keeps the last p95, so time stays even.
  const values: number[] = [];
  let last = 0;
  for (const point of points.data?.points ?? []) {
    if (point.p95 !== null) last = point.p95;
    values.push(last);
  }
  return (
    <Sparkline
      values={values}
      width={width}
      height={height}
      fill={detailed}
      limit={detailed ? run.limits.latencyLimitsMs.p95 : undefined}
      color={run.status === 'failed' ? 'var(--danger)' : 'var(--series-1)'}
    />
  );
}
