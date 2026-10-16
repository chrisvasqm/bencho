// Line chart on one y-axis. Series colors come from --series-N tokens; give neighboring series a
// `dash` too when hue alone may not separate them. Text stays in text tokens. Two or more series get a legend plus a label at each
// line's last point, so identity never depends on color alone.
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
  type TooltipContentProps,
} from 'recharts';
import { Skeleton } from './Skeleton.tsx';

export interface LineSeries<Row> {
  key: keyof Row & string;
  label: string;
  /** CSS color, normally var(--series-N). Keep a series on the same slot everywhere. */
  color: string;
  /** SVG dash pattern, so neighboring series differ by more than hue (color-vision deficiency). */
  dash?: string;
}

export interface LineChartProps<Row> {
  data: Row[];
  xKey: keyof Row & string;
  series: ReadonlyArray<LineSeries<Row>>;
  /** Accessible name; also shown as the chart title. */
  title: string;
  /** 'number' spaces points by value (time in seconds); 'category' spaces them evenly. */
  xType?: 'number' | 'category';
  formatX?: (value: number | string) => string;
  formatY?: (value: number) => string;
  height?: number;
  /** Whole-number y values only (such as virtual users), so ticks never read 2.25 users. */
  integerY?: boolean;
  /** Whole-number x values only (such as seconds). */
  integerX?: boolean;
  loading?: boolean;
  empty?: string;
}

const tick = { fill: 'var(--fg-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' };

export function LineChart<Row extends object>({
  data,
  xKey,
  series,
  title,
  xType = 'number',
  formatX = String,
  formatY = String,
  height = 220,
  integerY = false,
  integerX = false,
  loading,
  empty = 'No data yet.',
}: LineChartProps<Row>) {
  const showLegend = series.length > 1;
  const endLabels = showLegend ? endLabelTexts(data, series, height) : new Map<string, string>();
  // Room on the right for the longest end label (about 7px per 11px mono character), and at
  // least enough for the last x tick, which is centered on the plot's right edge.
  const rightMargin = Math.max(48, ...[...endLabels.values()].map((text) => text.length * 7 + 10));
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2">
      <figcaption className="text-sm font-medium text-fg">{title}</figcaption>
      {loading ? (
        <div style={{ height }}>
          <Skeleton className="h-full w-full" />
        </div>
      ) : data.length === 0 ? (
        <div
          style={{ height }}
          className="grid place-items-center rounded-md border border-dashed border-line text-sm text-fg-muted"
        >
          {empty}
        </div>
      ) : (
        <div style={{ height }} role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart
              data={data}
              margin={{ top: 8, right: rightMargin, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey={xKey as string}
                type={xType}
                domain={xType === 'number' ? ['dataMin', 'dataMax'] : undefined}
                tick={tick}
                tickFormatter={formatX}
                stroke="var(--line-strong)"
                tickLine={false}
                minTickGap={24}
                allowDecimals={!integerX}
              />
              <YAxis
                tick={tick}
                tickFormatter={formatY}
                stroke="var(--line-strong)"
                tickLine={false}
                axisLine={false}
                allowDecimals={!integerY}
                width={72}
              />
              <Tooltip
                cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
                content={(props) => (
                  <ChartTooltip
                    {...(props as TooltipContentProps<number, string>)}
                    series={series}
                    formatX={formatX}
                    formatY={formatY}
                  />
                )}
              />
              {showLegend && (
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={24}
                  iconType="plainline"
                  formatter={(value: string) => (
                    <span className="text-xs text-fg-muted">{value}</span>
                  )}
                />
              )}
              {series.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.label}
                  stroke={line.color}
                  strokeDasharray={line.dash}
                  strokeWidth={2}
                  // A series with one value has no segment to draw, so it shows a dot instead.
                  // Dot outlines stay solid on dashed series.
                  dot={
                    valueCount(data, line.key) === 1
                      ? { strokeDasharray: '0', fill: 'var(--surface)' }
                      : false
                  }
                  activeDot={{
                    r: 4,
                    stroke: 'var(--surface)',
                    strokeWidth: 2,
                    strokeDasharray: '0',
                  }}
                  connectNulls
                  isAnimationActive={false}
                  label={
                    endLabels.has(line.key)
                      ? (props: LabelProps) => (
                          <EndLabel
                            {...props}
                            lastIndex={lastValueIndex(data, line.key)}
                            text={endLabels.get(line.key) ?? line.label}
                          />
                        )
                      : undefined
                  }
                />
              ))}
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}

/** Labels closer than this many pixels would overlap; they merge into one. */
const END_LABEL_MIN_GAP_PX = 14;
/** Chart height taken by the legend and the x axis, not by the plot. */
const NON_PLOT_HEIGHT_PX = 52;

/**
 * Text of the label at each series' last point. Series that end close together share one label
 * ("p95 p99") on the highest of them, so labels never print over each other.
 */
function endLabelTexts<Row>(data: Row[], series: ReadonlyArray<LineSeries<Row>>, height: number) {
  const plotHeight = Math.max(1, height - NON_PLOT_HEIGHT_PX);
  const numberAt = (row: Row | undefined, key: keyof Row): number | undefined => {
    const value: unknown = row?.[key];
    return typeof value === 'number' ? value : undefined;
  };
  const ends = series
    .map((line) => ({ line, value: numberAt(data[lastValueIndex(data, line.key)], line.key) }))
    .flatMap(({ line, value }) => (value === undefined ? [] : [{ line, value }]))
    .sort((first, second) => second.value - first.value);
  const values = series.flatMap((line) => data.flatMap((row) => numberAt(row, line.key) ?? []));
  const max = Math.max(0, ...values);
  const texts = new Map<string, string>();
  let leader: { key: string; value: number; index: number; labels: string[] } | undefined;
  for (const { line, value } of ends) {
    const index = lastValueIndex(data, line.key);
    const pixels = max > 0 ? ((leader?.value ?? 0) - value) * (plotHeight / max) : 0;
    // Only labels drawn at the same x can collide; a series ending earlier keeps its own label.
    if (leader && leader.index === index && pixels < END_LABEL_MIN_GAP_PX) {
      leader.labels.push(line.label);
      const order = series.map((item) => item.label);
      leader.labels.sort((first, second) => order.indexOf(first) - order.indexOf(second));
      texts.set(leader.key, leader.labels.join(' '));
      continue;
    }
    leader = { key: line.key, value, index, labels: [line.label] };
    texts.set(line.key, line.label);
  }
  return texts;
}

function valueCount<Row>(data: Row[], key: keyof Row): number {
  return data.filter((row) => typeof row[key] === 'number').length;
}

/** Index of the last row where the series has a number; seconds without requests have none. */
function lastValueIndex<Row>(data: Row[], key: keyof Row): number {
  for (let index = data.length - 1; index >= 0; index -= 1) {
    if (typeof data[index]?.[key] === 'number') return index;
  }
  return -1;
}

function EndLabel({
  x,
  y,
  index,
  lastIndex,
  text,
}: LabelProps & { lastIndex: number; text: string }) {
  if (index !== lastIndex || typeof x !== 'number' || typeof y !== 'number') return null;
  return (
    <text x={x + 6} y={y + 4} fill="var(--fg-muted)" fontSize={11} fontFamily="var(--font-mono)">
      {text}
    </text>
  );
}

function ChartTooltip<Row>({
  active,
  payload,
  label,
  series,
  formatX,
  formatY,
}: TooltipContentProps<number, string> & {
  series: ReadonlyArray<LineSeries<Row>>;
  formatX: (value: number | string) => string;
  formatY: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-raised">
      <p className="mb-1 text-fg-muted">{formatX(label as number | string)}</p>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {series.map((line) => {
          const entry = payload.find((item) => item.dataKey === line.key);
          if (!entry || typeof entry.value !== 'number') return null;
          return (
            <li key={line.key} className="flex items-center gap-2">
              <svg width="12" height="4" aria-hidden="true" className="shrink-0">
                <line
                  x1="0"
                  y1="2"
                  x2="12"
                  y2="2"
                  stroke={line.color}
                  strokeWidth="2"
                  strokeDasharray={line.dash}
                />
              </svg>
              <span className="text-fg-muted">{line.label}</span>
              <span className="ml-auto pl-3 text-fg tabular-nums">{formatY(entry.value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
