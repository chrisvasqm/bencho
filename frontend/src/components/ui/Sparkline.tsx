export interface SparklineProps {
  values: number[];
  /** Drawn as a dashed line; the scale always includes it. */
  limit?: number;
  color?: string;
  width?: number;
  height?: number;
  /** Shade under the line. */
  fill?: boolean;
  className?: string;
}

/** A small line with no axes: the shape of one series, for a list row or a compare view. */
export function Sparkline({
  values,
  limit,
  color = 'var(--series-1)',
  width = 72,
  height = 22,
  fill = false,
  className,
}: SparklineProps) {
  if (values.length < 2) return null;
  const top = Math.max(...values, limit ?? 0) * 1.1 || 1;
  const x = (index: number) => (index / (values.length - 1)) * width;
  const y = (value: number) => height - 2 - (value / top) * (height - 6);
  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`);
  const last = values.length - 1;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      style={{ width, height }}
    >
      {fill && (
        <polygon
          points={`0,${height} ${points.join(' ')} ${x(last).toFixed(1)},${height}`}
          fill={color}
          fillOpacity={0.12}
        />
      )}
      {limit !== undefined && (
        <line
          x1={0}
          x2={width}
          y1={y(limit)}
          y2={y(limit)}
          stroke="var(--danger)"
          strokeWidth={1.2}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x(last)} cy={y(values[last]!)} r={2.5} fill={color} />
    </svg>
  );
}
