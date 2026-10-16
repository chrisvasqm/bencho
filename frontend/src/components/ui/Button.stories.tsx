import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button.tsx';

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { children: 'Start load test', variant: 'primary', size: 'md' },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: 'secondary', children: 'Add stage' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'Cancel' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Delete run' } };
export const Loading: Story = { args: { loading: true, children: 'Starting…' } };
export const Disabled: Story = { args: { disabled: true } };
