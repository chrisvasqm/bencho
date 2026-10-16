import { cn } from './cn.ts';

export interface SkeletonProps {
  className?: string;
}

/** Placeholder block shown while content loads. Size it like the content it replaces. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block rounded-md bg-[linear-gradient(90deg,var(--surface-sunken)_25%,var(--line)_50%,var(--surface-sunken)_75%)] bg-[length:200%_100%] motion-safe:animate-[shimmer_1.4s_linear_infinite]',
        className,
      )}
    />
  );
}

/** A label + input sized skeleton, matching Field + Input. */
export function FieldSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
