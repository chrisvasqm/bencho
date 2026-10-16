import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Select } from './Select.tsx';

const options = [
  { value: 'load', label: 'Load' },
  { value: 'stress', label: 'Stress' },
  { value: 'spike', label: 'Spike' },
];

const meta = {
  title: 'UI/Select',
  component: Select,
  args: { options, value: 'load', onChange: () => undefined, 'aria-label': 'Test type' },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <Select {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
