import { useQuery } from '@tanstack/react-query';
import { runsApi } from '../../api/runs.ts';
import { Note } from '../../components/ui/Note.tsx';

const GIGABYTE = 1024 ** 3;
const MEGABYTE = 1024 ** 2;
// Free memory changes as runs start and stop.
const REFRESH_MS = 10_000;

export interface CapacityHintProps {
  /** The largest VU target across the stages. */
  peakTarget: number;
}

/** Rough VU estimate for the Bencho host, with a warning when the stages go above it. */
export function CapacityHint({ peakTarget }: CapacityHintProps) {
  const capacity = useQuery({
    queryKey: ['capacity'],
    queryFn: runsApi.capacity,
    refetchInterval: REFRESH_MS,
  });
  if (!capacity.data) return null;
  const { estimatedVirtualUsers, availableMemoryBytes, memoryPerVirtualUserBytes, cpuCount } =
    capacity.data;
  const estimate = estimatedVirtualUsers.toLocaleString();
  return (
    <Note title="How many VUs the Bencho server can run">
      <p className="m-0" data-testid="capacity-estimate">
        Rough estimate: about {estimate} VUs. The Bencho server has{' '}
        {(availableMemoryBytes / GIGABYTE).toFixed(1)} GB of free memory and {cpuCount} CPU cores,
        and k6 uses up to about {Math.round(memoryPerVirtualUserBytes / MEGABYTE)} MB per VU. Long
        flows, large bodies, short think times and other active runs lower this number.
      </p>
      <p className="m-0" data-testid="capacity-docker">
        In Docker, free memory is what Docker gives Bencho, not all of the computer's memory. On
        Docker Desktop, raise it in Settings → Resources → Memory.
      </p>
      {/* Always mounted (hidden when empty), so screen readers announce changes politely. */}
      <p
        role="status"
        className="m-0 font-medium text-warning empty:sr-only"
        data-testid="capacity-warning"
      >
        {peakTarget > estimatedVirtualUsers &&
          `Your stages go up to ${peakTarget.toLocaleString()} VUs, more than the estimate of ${estimate}. The run can slow down or stop the server.`}
      </p>
    </Note>
  );
}
