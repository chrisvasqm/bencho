import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from './Textarea.tsx';

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  args: { placeholder: '{"name": "value"}', 'aria-label': 'Body' },
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Mono: Story = {
  args: { mono: true, defaultValue: '{"stars": 5, "pizza_id": {{pizzaId}}}' },
};
export const Invalid: Story = { args: { mono: true, invalid: true, defaultValue: '{"stars": ' } };
export const Disabled: Story = { args: { disabled: true, defaultValue: 'Read only' } };
