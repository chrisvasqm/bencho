import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from './Field.tsx';
import { Input } from './Input.tsx';

const meta = {
  title: 'UI/Field',
  component: Field,
  args: {
    label: 'Target URL',
    htmlFor: 'target',
    hint: 'Where every virtual user sends its requests',
    children: <Input id="target" mono defaultValue="http://quickpizza:3333" />,
  },
} satisfies Meta<typeof Field>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithHint: Story = {};
export const WithError: Story = {
  args: {
    error: 'Enter a full URL, including http:// or https://',
    children: <Input id="target" mono invalid defaultValue="quickpizza" />,
  },
};
