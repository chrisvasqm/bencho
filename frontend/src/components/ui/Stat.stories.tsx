import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stat } from './Stat.tsx';

const meta = {
  title: 'UI/Stat',
  component: Stat,
  args: { label: 'p95', value: '212.4', unit: 'ms', limit: '< 500 ms', tone: 'success' },
} satisfies Meta<typeof Stat>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithinLimit: Story = {};
export const OverLimit: Story = { args: { value: '1.84', unit: 's', tone: 'danger' } };
export const NoLimit: Story = {
  args: { label: 'Requests', value: '4280', unit: '42.5/s', limit: undefined, tone: 'neutral' },
};
export const WithDetails: Story = {
  args: {
    label: 'Latency',
    value: '1.36',
    unit: 's',
    limit: '< 1000 ms',
    tone: 'danger',
    details: [
      { label: 'p50', value: '4.2 ms', limit: '< 200 ms', tone: 'success' },
      { label: 'p90', value: '8.1 ms', limit: '< 400 ms', tone: 'success' },
      { label: 'p95', value: '9.4 ms', limit: '< 500 ms', tone: 'success' },
      { label: 'p99', value: '1.36 s', limit: '< 1000 ms', tone: 'danger' },
    ],
  },
};
export const Row: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat label="p50" value="4.2" unit="ms" limit="< 200 ms" tone="success" />
      <Stat label="p90" value="8.1" unit="ms" limit="< 400 ms" tone="success" />
      <Stat label="p95" value="9.4" unit="ms" limit="< 500 ms" tone="success" />
      <Stat label="p99" value="1.36" unit="s" limit="< 1000 ms" tone="danger" />
    </div>
  ),
};
