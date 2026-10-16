import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox.tsx';

const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  args: { 'aria-label': 'Select run' },
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Indeterminate: Story = { args: { indeterminate: true } };
export const Disabled: Story = { args: { disabled: true } };
