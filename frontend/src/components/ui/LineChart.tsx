// Line chart on one y-axis. Series colors come from --series-N tokens; give neighboring series a
// `dash` too when hue alone may not separate them. Text stays in text tokens. Two or more series
// get a legend plus a label at each line's last point, so identity never depends on color alone.
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
import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton.tsx';

export interface LineSeries<Row> {
  key: keyof Row & string;
  label: string;
  /** CSS color, normally var(--series-N). Keep a series on the same slot everywhere. */
  color: string;
  /** SVG dash pattern, so neighboring series differ by more than hue (color-vision deficiency). */
  dash?: string;
  /** The line is drawn from `key` (e.g. a smoothed copy); the tooltip shows this exact value. */
  rawKey?: keyof Row & string;
}

export interface LineChartProps<Row> {
  data: Row[];
  xKey: keyof Row & string;
  series: ReadonlyArray<LineSeries<Row>>;
  /** Accessible name; also shown as the chart title. */
  title: string;
  formatX?: (value: number | string) => string;
  formatY?: (value: number) => string;
  height?: number;
  /** Whole-number y values only (such as virtual users), so ticks never read 2.25 users. */
  integerY?: boolean;
  /** Smallest y tick step, so ticks never read the same once formatted (0.001 = 0.1%). */
  minYStep?: number;
  /** Whole-number x values only (such as seconds). */
  integerX?: boolean;
  /**
   * x values are seconds, rows sorted by them: ticks fall on round time steps (10s, 1m, 5m, 1h)
   * that fit the range.
   */
  xTime?: boolean;
  /** 'linear' draws straight segments, for data that is linear between points (a plan). */
  curve?: 'monotone' | 'linear';
  loading?: boolean;
  empty?: string;
  testId?: string;
  /** Shown right of the title, such as a Learn link. */
  action?: ReactNode;
}

const tick = { fill: 'var(--fg-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' };

export function LineChart<Row extends object>({
  data,
  xKey,
  series,
  title,
  formatX = String,
  formatY = String,
  height = 220,
  integerY = false,
  integerX = false,
  xTime = false,
  curve = 'monotone',
  minYStep = 0,
  loading,
  empty = 'No data yet.',
  testId,
  action,
}: LineChartProps<Row>) {
  const showLegend = series.length > 1;
  const xTicks = xTime
    ? timeTicks(numberAt(data[0], xKey), numberAt(data[data.length - 1], xKey))
    : undefined;
  // The y axis uses this exact scale, so label spacing can be measured in pixels.
  const yTicks = niceTicks(seriesMax(data, series), integerY, minYStep);
  const yMax = yTicks[yTicks.length - 1] ?? 1;
  const plotHeight = Math.max(
    1,
    height - MARGIN_TOP_PX - X_AXIS_HEIGHT_PX - (showLegend ? LEGEND_HEIGHT_PX : 0),
  );
  // Recharts puts a top legend above the plot, so the plot starts below both.
  const plotTop = MARGIN_TOP_PX + (showLegend ? LEGEND_HEIGHT_PX : 0);
  const endLabels = showLegend
    ? layoutEndLabels(data, series, { top: plotTop, height: plotHeight, max: yMax })
    : new Map<string, EndLabelGroup>();
  // Room on the right for the longest end label line (about 7px per 11px mono character), and
  // at least enough for the last x tick, which is centered on the plot's right edge.
  const rightMargin = Math.max(
    48,
    ...[...endLabels.values()]
      .flatMap((group) => group.labels)
      .map((item) => item.label.length * 7 + 10),
  );
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2" data-testid={testId}>
      <figcaption className="flex items-center justify-between gap-3 text-sm font-medium text-fg">
        {title}
        {action}
      </figcaption>
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
              margin={{ top: MARGIN_TOP_PX, right: rightMargin, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey={xKey as string}
                type="number"
                domain={['dataMin', 'dataMax']}
                tick={tick}
                tickFormatter={formatX}
                stroke="var(--line-strong)"
                tickLine={false}
                minTickGap={24}
                height={X_AXIS_HEIGHT_PX}
                allowDecimals={!integerX}
                // On a narrow chart Recharts still drops ticks that would overlap (minTickGap);
                // the ones left stay round.
                ticks={xTicks}
              />
              <YAxis
                tick={tick}
                tickFormatter={formatY}
                stroke="var(--line-strong)"
                tickLine={false}
                axisLine={false}
                domain={[0, yMax]}
                ticks={yTicks}
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
                  height={LEGEND_HEIGHT_PX}
                  iconType="plainline"
                  formatter={(value: string) => (
                    <span className="text-xs text-fg-muted">{value}</span>
                  )}
                />
              )}
              {series.map((line) => (
                <Line
                  key={line.key}
                  type={curve}
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
                  label={(() => {
                    // Only series with an end label get a label renderer (it runs per point).
                    const group = endLabels.get(line.key);
                    return group
                      ? (props: LabelProps) => <EndLabel {...props} group={group} />
                      : undefined;
                  })()}
                />
              ))}
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}

const MARGIN_TOP_PX = 8;
const LEGEND_HEIGHT_PX = 24;
/** Recharts' default x axis height. */
const X_AXIS_HEIGHT_PX = 30;
/** Points closer than this many pixels share one stacked label. */
const END_LABEL_MIN_GAP_PX = 14;
const END_LABEL_LINE_PX = 12;
const Y_TICK_COUNT = 5;

function numberAt<Row>(row: Row | undefined, key: keyof Row): number | undefined {
  const value: unknown = row?.[key];
  return typeof value === 'number' ? value : undefined;
}

function seriesMax<Row>(data: Row[], series: ReadonlyArray<LineSeries<Row>>): number {
  let max = 0;
  for (const line of series) {
    for (const row of data) max = Math.max(max, numberAt(row, line.key) ?? 0);
  }
  return max;
}

// Round time steps in seconds, so a time axis reads 5m, 10m, 15m and never 4m10s.
const TIME_STEPS_SECONDS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
const MAX_TIME_TICKS = 6;

/**
 * Ticks on the smallest round time step that keeps the range to about six, inside the range from
 * the first to the last row (rows are sorted by time; a run's first point may come after 0).
 * Undefined, so Recharts picks its own, when the range is under 2 seconds or too long for the steps.
 */
function timeTicks(min: number | undefined, max: number | undefined): number[] | undefined {
  if (min === undefined || max === undefined || !(max - min >= 2)) return undefined;
  // Up to MAX_TIME_TICKS intervals, so a range just past a round number keeps its finer step.
  const step = TIME_STEPS_SECONDS.find((candidate) => (max - min) / candidate <= MAX_TIME_TICKS);
  if (step === undefined) return undefined;
  const first = Math.ceil(min / step - 1e-9) * step;
  const count = Math.floor((max - first) / step + 1e-9);
  return Array.from({ length: count + 1 }, (_value, index) => first + index * step);
}

/**
 * Evenly spaced ticks from 0 with a round step (1, 2, 2.5 or 5 times a power of ten). With a
 * minimum step, the step is a whole multiple of it, so formatted ticks stay exact and distinct.
 */
function niceTicks(max: number, integer: boolean, minStep: number): number[] {
  const floor = integer ? Math.max(1, minStep) : minStep;
  if (max <= 0) return [0, floor > 0 ? floor : 1];
  const rawStep = Math.max(max / (Y_TICK_COUNT - 1), floor, Number.MIN_VALUE);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const factors = integer || minStep > 0 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  const factor = factors.find((candidate) => candidate * magnitude >= rawStep) ?? 10;
  let step = factor * magnitude;
  if (floor > 0) step = Math.ceil(step / floor - 1e-9) * floor;
  const count = Math.max(1, Math.ceil(max / step - 1e-9));
  return Array.from({ length: count + 1 }, (_value, index) => Number((index * step).toFixed(10)));
}

interface EndLabelGroup {
  /** Row of the series' last value, where the label is drawn. */
  index: number;
  labels: Array<{ key: string; label: string }>;
  /** Baseline of the first line, in chart pixels. */
  firstLineY: number;
}

/**
 * Lays out the labels at each series' last point. Series ending at the same x within a few
 * pixels share one stacked label; groups are then kept inside the plot and pushed apart so no
 * two stacks overlap. Keyed by the series that draws the group.
 */
function layoutEndLabels<Row>(
  data: Row[],
  series: ReadonlyArray<LineSeries<Row>>,
  plot: { top: number; height: number; max: number },
): Map<string, EndLabelGroup> {
  const toY = (value: number) => plot.top + plot.height * (1 - value / plot.max);
  const ends = series.flatMap((line, order) => {
    const index = lastValueIndex(data, line.key);
    const value = numberAt(data[index], line.key);
    return value === undefined ? [] : [{ line, order, index, y: toY(value) }];
  });
  const layout = new Map<string, EndLabelGroup>();
  for (const index of new Set(ends.map((end) => end.index))) {
    const column = ends.filter((end) => end.index === index).sort((a, b) => a.y - b.y);
    // Group points that are closer than one label line apart, top to bottom.
    const groups: Array<{ key: string; members: typeof column }> = [];
    for (const end of column) {
      const last = groups[groups.length - 1];
      const lastY = last?.members[last.members.length - 1]?.y;
      if (last && lastY !== undefined && end.y - lastY < END_LABEL_MIN_GAP_PX) {
        last.members.push(end);
      } else groups.push({ key: end.line.key, members: [end] });
    }
    // Center each stack on its points, then push stacks apart and keep them inside the plot.
    const placed = groups.map((group) => {
      const center = group.members.reduce((sum, end) => sum + end.y, 0) / group.members.length;
      const lines = group.members.length;
      return { group, lines, first: center + 4 - ((lines - 1) * END_LABEL_LINE_PX) / 2 };
    });
    const minFirst = plot.top + 9;
    const maxLast = plot.top + plot.height - 4;
    let floor = minFirst;
    for (const item of placed) {
      item.first = Math.max(item.first, floor);
      floor = item.first + item.lines * END_LABEL_LINE_PX;
    }
    let ceiling = maxLast;
    for (const item of [...placed].reverse()) {
      item.first = Math.min(item.first, ceiling - (item.lines - 1) * END_LABEL_LINE_PX);
      ceiling = item.first - END_LABEL_LINE_PX;
    }
    // Stacks taller than the plot cannot all fit; keep the top one readable below the legend.
    for (const item of placed) item.first = Math.max(item.first, minFirst);
    for (const { group, first } of placed) {
      const members = [...group.members].sort((a, b) => a.order - b.order);
      layout.set(group.key, {
        index,
        labels: members.map((end) => ({ key: end.line.key, label: end.line.label })),
        firstLineY: first,
      });
    }
  }
  return layout;
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

function EndLabel({ x, index, group }: LabelProps & { group: EndLabelGroup }) {
  if (index !== group.index || typeof x !== 'number') return null;
  return (
    <text
      x={x + 6}
      y={group.firstLineY}
      fill="var(--fg-muted)"
      fontSize={11}
      fontFamily="var(--font-mono)"
    >
      {group.labels.map((item, position) => (
        <tspan key={item.key} x={x + 6} dy={position === 0 ? 0 : END_LABEL_LINE_PX}>
          {item.label}
        </tspan>
      ))}
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
          const row = entry.payload as Row | undefined;
          const raw = line.rawKey === undefined ? undefined : row?.[line.rawKey];
          const value = typeof raw === 'number' ? raw : entry.value;
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
              <span className="ml-auto pl-3 text-fg tabular-nums">{formatY(value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
