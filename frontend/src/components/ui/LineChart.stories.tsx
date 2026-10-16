import type { Meta, StoryObj } from '@storybook/react-vite';
import { LineChart } from './LineChart.tsx';

const data = Array.from({ length: 40 }, (_unused, second) => {
  const load = Math.sin(second / 8) * 4 + 6;
  return {
    second,
    p50: 4 + load * 0.4,
    p90: 7 + load * 0.8,
    p95: 9 + load * 1.1,
    p99: 14 + load * 1.9 + (second % 9 === 0 ? 12 : 0),
    virtualUsers: Math.min(10, second),
  };
});

const latency = [
  { key: 'p50', label: 'p50', color: 'var(--series-1)' },
  { key: 'p90', label: 'p90', color: 'var(--series-2)' },
  { key: 'p95', label: 'p95', color: 'var(--series-3)', dash: '6 3' },
  { key: 'p99', label: 'p99', color: 'var(--series-4)', dash: '2 3' },
] as const;

const meta = {
  title: 'UI/LineChart',
  component: LineChart<(typeof data)[number]>,
  args: {
    data,
    xKey: 'second',
    series: latency,
    title: 'Response time per second',
    formatX: (value: number | string) => `${value}s`,
    formatY: (value: number) => `${value.toFixed(0)} ms`,
  },
} satisfies Meta<typeof LineChart<(typeof data)[number]>>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Latency: Story = {};
export const SingleSeries: Story = {
  args: {
    title: 'Virtual users',
    series: [{ key: 'virtualUsers', label: 'Virtual users', color: 'var(--series-1)' }],
    formatY: String,
  },
};
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = { args: { data: [] } };
