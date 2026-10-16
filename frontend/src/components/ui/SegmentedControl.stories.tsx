import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SegmentedControl } from './SegmentedControl.tsx';

const options = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const meta = {
  title: 'UI/SegmentedControl',
  component: SegmentedControl,
  args: { options, value: 'system', onChange: () => undefined, label: 'Theme', size: 'sm' },
  argTypes: { size: { control: 'select', options: ['sm', 'md'] } },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <SegmentedControl {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof SegmentedControl>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = {};
export const Medium: Story = { args: { size: 'md' } };
