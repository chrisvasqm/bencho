import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Pagination } from './Pagination.tsx';

const meta = {
  title: 'UI/Pagination',
  component: Pagination,
  args: { page: 1, pageSize: 8, total: 42, onPageChange: () => undefined },
  render: function Render(args) {
    const [page, setPage] = useState(args.page);
    return <Pagination {...args} page={page} onPageChange={setPage} />;
  },
} satisfies Meta<typeof Pagination>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
export const SinglePage: Story = { args: { total: 5 } };
