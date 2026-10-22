import type { Capacity, LoadMode } from '../../api/runs.ts';
import type { Copy } from '../../i18n/useCopy.ts';
import type { LearnItem } from './LearnMore.tsx';

const GIGABYTE = 1024 ** 3;
const MEGABYTE = 1024 ** 2;

/** When a run fails; a rate run has one more reason. */
function failItem(t: Copy, mode: LoadMode): LearnItem {
  return {
    term: t('learn.fail.term'),
    points: [
      t('learn.fail.limit'),
      t('learn.fail.errors'),
      t('learn.fail.checks'),
      ...(mode === 'rate' ? [t('learn.fail.rate')] : []),
    ],
  };
}

/** What p95, p50 and p99 mean. */
function percentileItems(t: Copy): LearnItem[] {
  return [
    { term: t('learn.percentile.p95Term'), points: [t('learn.percentile.p95')] },
    {
      term: t('learn.percentile.otherTerm'),
      points: [t('learn.percentile.p50'), t('learn.percentile.p99'), t('learn.percentile.average')],
    },
  ];
}

/** "How users and stages work", next to Load shape. */
export function shapeItems(t: Copy): LearnItem[] {
  return [
    {
      term: t('learn.shape.userTerm'),
      points: [t('learn.shape.user1'), t('learn.shape.user2'), t('learn.shape.user3')],
    },
    {
      term: t('learn.shape.stageTerm'),
      points: [t('learn.shape.stage1'), t('learn.shape.stage2'), t('learn.shape.stage3')],
    },
    {
      term: t('learn.shape.modeTerm'),
      points: [
        t('learn.shape.users'),
        t('learn.shape.rate'),
        t('learn.shape.flowRun'),
        t('learn.shape.goal'),
      ],
    },
  ];
}

/** "How pass rules work", next to Latency limits. */
export function rulesItems(t: Copy, mode: LoadMode): LearnItem[] {
  return [
    failItem(t, mode),
    ...percentileItems(t),
    { term: t('learn.rules.errorTerm'), points: [t('learn.rules.error')] },
  ];
}

/** "How to read these numbers", next to the run title. */
export function resultsItems(t: Copy, mode: LoadMode): LearnItem[] {
  return [
    {
      term: t('learn.results.colorTerm'),
      points: [t('learn.results.green'), t('learn.results.red')],
    },
    ...percentileItems(t),
    { term: t('learn.results.errorTerm'), points: [t('learn.results.error')] },
    { term: t('learn.results.requestTerm'), points: [t('learn.results.request')] },
    failItem(t, mode),
  ];
}

/** "How is this estimated?", next to the VU estimate. */
export function capacityItems(t: Copy, capacity: Capacity): LearnItem[] {
  return [
    {
      term: t('learn.capacity.howTerm'),
      points: [
        t('learn.capacity.memory', {
          memory: (capacity.availableMemoryBytes / GIGABYTE).toFixed(1),
        }),
        t('learn.capacity.cpus', { cpus: capacity.cpuCount }),
        t('learn.capacity.perUser', {
          perUser: Math.round(capacity.memoryPerVirtualUserBytes / MEGABYTE),
        }),
      ],
    },
    { term: t('learn.capacity.lowerTerm'), points: [t('learn.capacity.lower')] },
    { term: t('learn.capacity.dockerTerm'), points: [t('learn.capacity.docker')] },
  ];
}

/** "Which answers are shown?", next to Failed answers. */
export function failuresItems(t: Copy): LearnItem[] {
  return [
    {
      term: t('learn.failures.whichTerm'),
      points: [t('learn.failures.which1'), t('learn.failures.which2'), t('learn.failures.which3')],
    },
    { term: t('learn.failures.privateTerm'), points: [t('learn.failures.private')] },
  ];
}

/** "How to read this chart", next to the response time chart. */
export function chartItems(t: Copy, mode: LoadMode): LearnItem[] {
  return [
    {
      term: t('learn.chart.latencyTerm'),
      points: [
        t('learn.chart.latency1'),
        t('learn.chart.latency2'),
        t('learn.chart.latency3'),
        t('learn.chart.latency4'),
        t('learn.chart.latency5'),
      ],
    },
    ...(mode === 'rate'
      ? [
          {
            term: t('learn.chart.rateTerm'),
            points: [t('learn.chart.rate1'), t('learn.chart.rate2'), t('learn.chart.rate3')],
          },
        ]
      : []),
    {
      term: t('learn.chart.loadTerm'),
      points: [t('learn.chart.load1'), t('learn.chart.load2'), t('learn.chart.load3')],
    },
    {
      term: t('learn.chart.errorTerm'),
      points: [t('learn.chart.error1'), t('learn.chart.error2')],
    },
  ];
}
