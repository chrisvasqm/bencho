import type { Meta, StoryObj } from '@storybook/react-vite';

const COLORS = [
  ['canvas', 'Page background'],
  ['surface', 'Cards, inputs'],
  ['surface-sunken', 'Code, hover rows'],
  ['line', 'Borders'],
  ['fg', 'Text'],
  ['fg-muted', 'Secondary text'],
  ['accent', 'Primary action'],
  ['accent-soft', 'Selected row'],
  ['success', 'Passed'],
  ['danger', 'Failed'],
  ['warning', 'Error'],
  ['info', 'Running'],
] as const;

function Swatches() {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-base font-semibold">Color</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COLORS.map(([name, role]) => (
            <div key={name} className="flex items-center gap-3">
              <span
                className="size-10 shrink-0 rounded-md border border-line"
                style={{ background: `var(--${name})` }}
              />
              <div className="min-w-0">
                <div className="text-xs">--{name}</div>
                <div className="truncate text-xs text-fg-muted">{role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-base font-semibold">Type</h2>
        <p className="text-2xl font-semibold tracking-tight">
          Instrument Sans for everything you read
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          Body copy at 14px. Labels at 13px, never smaller.
        </p>
        <p className="mt-3 text-sm tabular-nums">
          Tabular figures for numbers: p95 212.4 ms · 4280 requests
        </p>
      </section>
    </div>
  );
}

const meta = { title: 'Design/Tokens', component: Swatches } satisfies Meta<typeof Swatches>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
