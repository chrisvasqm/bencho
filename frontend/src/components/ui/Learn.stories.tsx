import type { Meta, StoryObj } from '@storybook/react-vite';
import { Learn } from './Learn.tsx';

const meta = {
  title: 'UI/Learn',
  component: Learn,
  args: {
    title: 'What is p95?',
    label: 'Learn',
    closeLabel: 'Close',
    children: (
      <p className="m-0">
        95 of every 100 requests were this fast or faster. The slowest 5 took longer.
      </p>
    ),
  },
} satisfies Meta<typeof Learn>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
