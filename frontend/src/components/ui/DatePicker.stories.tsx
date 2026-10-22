import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { DatePicker } from './DatePicker.tsx';
import { DateRangePicker } from './DateRangePicker.tsx';
import { today } from './calendar.ts';

const meta = {
  title: 'UI/DatePicker',
  component: DatePicker,
  args: { value: '', onChange: () => undefined, label: 'Day', max: today() },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div className="w-56 pb-96">
        <DatePicker {...args} value={value} onChange={setValue} />
      </div>
    );
  },
} satisfies Meta<typeof DatePicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Picked: Story = { args: { value: today() } };
export const Invalid: Story = { args: { invalid: true } };

export const Range: Story = {
  render: function Render() {
    const [range, setRange] = useState({ from: '', to: '' });
    return (
      <div className="w-80 pb-96">
        <DateRangePicker value={range} onChange={setRange} labels={{ from: 'From', to: 'To' }} />
      </div>
    );
  },
};
