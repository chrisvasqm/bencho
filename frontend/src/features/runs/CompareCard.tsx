// Two runs side by side: the same numbers as the run card, with the change from older to newer.
import type { Run } from '../../api/runs.ts';
import { Badge, Button, Card } from '../../components/ui/index.ts';
import { RunSparkline } from './RunSparkline.tsx';
import { useCopy, type Copy } from '../../i18n/useCopy.ts';
import {
  LATENCY_KEYS,
  STATUS_TONES,
  formatMs,
  formatPeak,
  formatPercent,
  formatStages,
  formatTime,
} from './format.ts';

export interface CompareCardProps {
  runs: [Run, Run];
  onClose: () => void;
}

interface Row {
  label: string;
  cells: [React.ReactNode, React.ReactNode];
  /** Newer minus older, when both runs have the number. */
  delta?: number;
  /** True when a higher number is better (requests per second), so a drop reads as worse. */
  higherIsBetter?: boolean;
  format?: (value: number) => string;
}

function rows(older: Run, newer: Run, t: Copy, language: string): Row[] {
  const latency = (run: Run, key: (typeof LATENCY_KEYS)[number][1]) =>
    run.summary?.metrics.http_req_duration?.[key];
  const errors = (run: Run) => run.summary?.metrics.http_req_failed?.value;
  const rate = (run: Run) => run.summary?.metrics.http_reqs?.rate;
  const diff = (a: number | undefined, b: number | undefined) =>
    a === undefined || b === undefined ? undefined : b - a;
  return [
    {
      label: t('compare.rows.status'),
      cells: [older, newer].map((run) => (
        <Badge tone={STATUS_TONES[run.status]}>{t(`status.${run.status}`)}</Badge>
      )) as [React.ReactNode, React.ReactNode],
    },
    {
      label: t('compare.rows.type'),
      cells: [t(`runType.${older.type}`), t(`runType.${newer.type}`)],
    },
    { label: t('compare.rows.baseUrl'), cells: [older.baseUrl, newer.baseUrl] },
    { label: t('compare.rows.peak'), cells: [formatPeak(older, t), formatPeak(newer, t)] },
    {
      label: t('compare.rows.stages'),
      cells: [formatStages(older.stages, older.mode, t), formatStages(newer.stages, newer.mode, t)],
    },
    {
      label: t('compare.rows.steps'),
      cells: [
        older.flow.map((step) => step.name).join(' → '),
        newer.flow.map((step) => step.name).join(' → '),
      ],
    },
    ...LATENCY_KEYS.map(([key, metricKey]) => ({
      label: key,
      cells: [formatMs(latency(older, metricKey)), formatMs(latency(newer, metricKey))] as [
        string,
        string,
      ],
      delta: diff(latency(older, metricKey), latency(newer, metricKey)),
      format: formatMs,
    })),
    {
      label: t('compare.rows.errors'),
      cells: [formatPercent(errors(older)), formatPercent(errors(newer))],
      delta: diff(errors(older), errors(newer)),
      format: formatPercent,
    },
    {
      label: t('compare.rows.requests'),
      cells: [rate(older)?.toFixed(1) ?? '–', rate(newer)?.toFixed(1) ?? '–'],
      delta: diff(rate(older), rate(newer)),
      higherIsBetter: true,
      format: (value) => value.toFixed(1),
    },
    {
      label: t('compare.rows.started'),
      cells: [formatTime(older.createdAt, language), formatTime(newer.createdAt, language)],
    },
  ];
}

export function CompareCard({ runs, onClose }: CompareCardProps) {
  const { t, language } = useCopy();
  const [older, newer] = [...runs].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) as [
    Run,
    Run,
  ];
  return (
    <Card
      title={t('compare.title')}
      actions={
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="compare-close">
          {t('compare.close')}
        </Button>
      }
      data-testid="run-compare"
      data-older-id={older.id}
      data-newer-id={newer.id}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-fg-muted">
              <th scope="col" className="py-2 pr-3 font-medium" />
              <th scope="col" className="px-3 py-2 font-medium">
                {t('compare.older')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('compare.newer')}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t('compare.change')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows(older, newer, t, language).map((row) => {
              const worse =
                row.delta === undefined ? 0 : row.higherIsBetter ? -row.delta : row.delta;
              return (
                <tr key={row.label} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-2 pr-3 text-left text-xs font-medium text-fg-muted">
                    {row.label}
                  </th>
                  <td className="max-w-64 truncate px-3 py-2">{row.cells[0]}</td>
                  <td className="max-w-64 truncate px-3 py-2">{row.cells[1]}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      worse === 0 ? 'text-fg-faint' : worse > 0 ? 'text-danger' : 'text-success'
                    }`}
                  >
                    {row.delta === undefined ||
                    row.format === undefined ||
                    row.format(Math.abs(row.delta)) === row.format(0)
                      ? ''
                      : `${row.delta > 0 ? '+' : '−'}${row.format(Math.abs(row.delta))}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2" data-testid="compare-sparklines">
        {[
          { run: older, label: t('compare.p95Older') },
          { run: newer, label: t('compare.p95Newer') },
        ].map(({ run, label }) => (
          <div key={run.id} className="flex flex-col gap-1">
            <div className="flex justify-between text-xs font-medium text-fg-muted">
              <span>{label}</span>
              <span className="font-mono tabular-nums">
                {formatMs(run.summary?.metrics.http_req_duration?.['p(95)'])}
              </span>
            </div>
            <div className="w-full [&>svg]:w-full!">
              <RunSparkline run={run} width={300} height={56} detailed />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
