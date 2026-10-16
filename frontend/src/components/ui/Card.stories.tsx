import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button.tsx';
import { Card } from './Card.tsx';

const meta = {
  title: 'UI/Card',
  component: Card,
  args: {
    title: 'Runs',
    description: 'Newest first. Select a run to see its numbers.',
    children: <p className="text-sm text-fg-muted">Card body content.</p>,
  },
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithActions: Story = {
  args: {
    actions: (
      <Button size="sm" variant="secondary">
        Refresh
      </Button>
    ),
  },
};
export const Plain: Story = { args: { title: undefined, description: undefined } };
