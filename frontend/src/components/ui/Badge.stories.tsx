import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge.tsx';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  args: { children: 'Passed', tone: 'success' },
  argTypes: {
    tone: {
      control: 'select',
      options: ['neutral', 'accent', 'highlight', 'success', 'danger', 'warning', 'info'],
    },
  },
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Passed: Story = {};
export const Failed: Story = { args: { tone: 'danger', children: 'Failed' } };
export const Running: Story = { args: { tone: 'info', pulse: true, children: 'Running' } };
export const Queued: Story = { args: { tone: 'neutral', children: 'Queued' } };
export const AllTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge tone="neutral">Queued</Badge>
      <Badge tone="info" pulse>
        Running
      </Badge>
      <Badge tone="success">Passed</Badge>
      <Badge tone="danger">Failed</Badge>
      <Badge tone="warning">Error</Badge>
      <Badge tone="accent">Default</Badge>
      <Badge tone="highlight">Highlight</Badge>
    </div>
  ),
};
