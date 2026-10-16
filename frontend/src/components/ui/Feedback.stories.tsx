import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldSkeleton, Skeleton } from './Skeleton.tsx';
import { Spinner } from './Spinner.tsx';
import { Input } from './Input.tsx';

function Feedback() {
  return (
    <div className="flex max-w-sm flex-col gap-6">
      <div className="flex items-center gap-3 text-fg-muted">
        <Spinner />
        <Spinner size="md" label="Loading runs" />
        <span className="text-sm">Spinner, small and medium</span>
      </div>
      <Input aria-label="Target URL" mono loading defaultValue="http://quickpizza:3333" />
      <FieldSkeleton />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

const meta = { title: 'UI/Loading', component: Feedback } satisfies Meta<typeof Feedback>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
