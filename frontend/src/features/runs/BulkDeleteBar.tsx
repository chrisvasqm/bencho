import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/index.ts';

export interface BulkDeleteBarProps {
  count: number;
  deleting: boolean;
  onDelete: () => void;
  onClear: () => void;
}

const CONFIRM_TIMEOUT_MS = 4000;

/** Appears when runs are ticked. Deleting takes a second click to confirm. */
export function BulkDeleteBar({ count, deleting, onDelete, onClear }: BulkDeleteBarProps) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [confirming]);
  useEffect(() => {
    if (count === 0) setConfirming(false);
  }, [count]);

  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-2"
        >
          <span className="text-sm text-fg-muted tabular-nums">{count} selected</span>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={deleting}>
            Clear
          </Button>
          {confirming ? (
            <Button variant="danger" size="sm" loading={deleting} onClick={onDelete}>
              Delete {count} {count === 1 ? 'run' : 'runs'}
            </Button>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
