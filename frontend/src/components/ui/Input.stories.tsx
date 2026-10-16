import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input.tsx';

const meta = {
  title: 'UI/Input',
  component: Input,
  args: { placeholder: 'https://api.example.com/health', 'aria-label': 'Target URL' },
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Mono: Story = { args: { mono: true, defaultValue: '30s' } };
export const Invalid: Story = { args: { invalid: true, defaultValue: 'not a url' } };
export const Disabled: Story = { args: { disabled: true, defaultValue: 'http://quickpizza:3333' } };
