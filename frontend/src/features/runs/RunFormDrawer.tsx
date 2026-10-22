// The run form in a drawer from the right edge, so the run list and results stay in view.
// No close button: a click outside or Escape dismisses it.
import { Drawer } from 'vaul';
import type { CreateRunInput, Run, RunDefaults } from '../../api/runs.ts';
import { useCopy } from '../../i18n/useCopy.ts';
import { RunPanel } from './RunPanel.tsx';

export interface RunFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: RunDefaults;
  /** The run whose settings fill the form, if any. */
  initial?: Run;
  onSubmit: (input: CreateRunInput) => Promise<void>;
  submitting: boolean;
}

export function RunFormDrawer({
  open,
  onOpenChange,
  defaults,
  initial,
  onSubmit,
  submitting,
}: RunFormDrawerProps) {
  const { t } = useCopy();
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Drawer.Content
          aria-describedby={undefined}
          data-testid="run-form-drawer"
          className="fixed inset-y-0 right-0 z-50 flex w-[min(520px,100vw)] flex-col p-2 outline-none sm:p-3"
        >
          <Drawer.Title className="sr-only">{t('panel.title')}</Drawer.Title>
          <RunPanel
            defaults={defaults}
            initial={initial}
            onSubmit={onSubmit}
            submitting={submitting}
            className="h-full shadow-raised ring-1 ring-line"
          />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
