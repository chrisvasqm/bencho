import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Tabs } from './Tabs.tsx';

const items = [
  { value: 'load', label: 'Load', count: 12 },
  { value: 'stress', label: 'Stress', count: 3 },
  { value: 'spike', label: 'Spike', count: 0 },
];

const meta = {
  title: 'UI/Tabs',
  component: Tabs,
  args: { items, value: 'load', onChange: () => undefined, label: 'Test type' },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <Tabs {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithCounts: Story = {};
export const NoCounts: Story = {
  args: { items: items.map(({ value, label }) => ({ value, label })) },
};
