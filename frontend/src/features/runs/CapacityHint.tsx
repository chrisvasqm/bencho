import { useQuery } from '@tanstack/react-query';
import { runsApi } from '../../api/runs.ts';
import { Note } from '../../components/ui/Note.tsx';

const GIGABYTE = 1024 ** 3;
const MEGABYTE = 1024 ** 2;

export interface CapacityHintProps {
  /** The largest VU target across the stages. */
  peakTarget: number;
}

/** Rough VU estimate for the Bencho host, with a warning when the stages go above it. */
export function CapacityHint({ peakTarget }: CapacityHintProps) {
  const capacity = useQuery({ queryKey: ['capacity'], queryFn: runsApi.capacity });
  if (!capacity.data) return null;
  const { estimatedVirtualUsers, availableMemoryBytes, memoryPerVirtualUserBytes, cpuCount } =
    capacity.data;
  const estimate = estimatedVirtualUsers.toLocaleString();
  return (
    <Note title="How many VUs this machine can run">
      <p className="m-0" data-testid="capacity-estimate">
        Rough estimate: about {estimate} VUs. This machine has{' '}
        {(availableMemoryBytes / GIGABYTE).toFixed(1)} GB of free memory and {cpuCount} CPU cores,
        and k6 uses up to about {Math.round(memoryPerVirtualUserBytes / MEGABYTE)} MB per VU. Long
        flows, large bodies, short think times and other active runs lower this number.
      </p>
      {peakTarget > estimatedVirtualUsers && (
        <p role="alert" className="m-0 font-medium text-warning" data-testid="capacity-warning">
          Your stages go up to {peakTarget.toLocaleString()} VUs, more than the estimate of{' '}
          {estimate}. The run can slow down or stop this machine.
        </p>
      )}
    </Note>
  );
}
