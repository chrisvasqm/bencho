import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge.tsx';
import { Table, type Column } from './Table.tsx';

interface Row {
  id: string;
  status: 'passed' | 'failed';
  target: string;
  p95: string;
}

const rows: Row[] = [
  { id: '1', status: 'passed', target: 'http://quickpizza:3333', p95: '9.4 ms' },
  { id: '2', status: 'failed', target: 'https://api.example.com/orders', p95: '1.84 s' },
];

const columns: Column<Row>[] = [
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <Badge tone={row.status === 'passed' ? 'success' : 'danger'}>{row.status}</Badge>
    ),
  },
  { key: 'target', header: 'Target', className: 'text-xs', render: (row) => row.target },
  { key: 'p95', header: 'p95', align: 'right', render: (row) => row.p95 },
];

const meta = {
  title: 'UI/Table',
  component: Table<Row>,
  args: { columns, rows, rowKey: (row: Row) => row.id, empty: 'No runs yet.' },
} satisfies Meta<typeof Table<Row>>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Selectable: Story = { args: { onRowClick: () => undefined, selectedKey: '1' } };
export const Empty: Story = { args: { rows: [] } };
