// Line chart on one y-axis. Series colors come from --series-N tokens (validated for CVD per
// theme), text stays in text tokens. Two or more series get a legend plus a label at each
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
  loading?: boolean;
  empty?: string;
}

const tick = { fill: 'var(--fg-muted)', fontSize: 11, fontFamily: 'var(--)' };

export function LineChart<Row extends object>({
  data,
  xKey,
  series,
  title,
  xType = 'number',
  formatX = String,
  formatY = String,
  height = 220,
  loading,
  empty = 'No data yet.',
}: LineChartProps<Row>) {
  const showLegend = series.length > 1;
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
            <RechartsLineChart data={data} margin={{ top: 8, right: 44, bottom: 0, left: 0 }}>
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
              />
              <YAxis
                tick={tick}
                tickFormatter={formatY}
                stroke="var(--line-strong)"
                tickLine={false}
                axisLine={false}
                width={56}
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
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                  label={
                    showLegend
                      ? (props: LabelProps) => (
                          <EndLabel
                            {...props}
                            lastIndex={lastValueIndex(data, line.key)}
                            text={line.label}
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
    <text x={x + 6} y={y + 4} fill="var(--fg-muted)" fontSize={11} fontFamily="var(--)">
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
              <span className="h-0.5 w-3 rounded-full" style={{ background: line.color }} />
              <span className="text-fg-muted">{line.label}</span>
              <span className="ml-auto pl-3 text-fg tabular-nums">{formatY(entry.value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
