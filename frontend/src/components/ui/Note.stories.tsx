import type { Meta, StoryObj } from '@storybook/react-vite';
import { Note } from './Note.tsx';

const meta = {
  title: 'UI/Note',
  component: Note,
  args: {
    title: 'What is p95?',
    children: (
      <p className="m-0">
        95 of every 100 requests were this fast or faster. The slowest 5 took longer.
      </p>
    ),
  },
} satisfies Meta<typeof Note>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithoutTitle: Story = { args: { title: undefined } };
