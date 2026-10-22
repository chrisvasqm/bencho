import { Button, Input } from '../../components/ui/index.ts';
import { useCopy } from '../../i18n/useCopy.ts';
import { newPair, type Pair } from './flow.ts';

export interface PairsEditorProps {
  /** Prefix for input ids and labels, e.g. "step-1-header". */
  id: string;
  pairs: Pair[];
  onChange: (pairs: Pair[]) => void;
  keyLabel: string;
  valueLabel: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel: string;
}

/** Rows of key + value, such as headers or values saved from a response. */
export function PairsEditor({
  id,
  pairs,
  onChange,
  keyLabel,
  valueLabel,
  keyPlaceholder,
  valuePlaceholder,
  addLabel,
}: PairsEditorProps) {
  const { t } = useCopy();
  const update = (index: number, patch: Partial<Pair>) =>
    onChange(pairs.map((pair, position) => (position === index ? { ...pair, ...patch } : pair)));
  const remove = (index: number) => onChange(pairs.filter((_pair, position) => position !== index));

  return (
    <div className="flex flex-col gap-2">
      {pairs.length > 0 && (
        <div className="grid grid-cols-[2fr_3fr_auto] gap-2 text-xs text-fg-muted">
          <span>{keyLabel}</span>
          <span>{valueLabel}</span>
          <span className="w-8" />
        </div>
      )}
      {pairs.map((pair, index) => (
        <div key={pair.id} className="grid grid-cols-[2fr_3fr_auto] items-center gap-2">
          <Input
            id={`${id}-${index}-key`}
            aria-label={`${keyLabel} ${index + 1}`}
            mono
            value={pair.key}
            placeholder={keyPlaceholder}
            onChange={(event) => update(index, { key: event.target.value })}
          />
          <Input
            id={`${id}-${index}-value`}
            aria-label={`${valueLabel} ${index + 1}`}
            mono
            value={pair.value}
            placeholder={valuePlaceholder}
            onChange={(event) => update(index, { value: event.target.value })}
          />
          <Button
            variant="secondary"
            size="sm"
            aria-label={t('flow.removePair', { label: keyLabel.toLowerCase(), number: index + 1 })}
            onClick={() => remove(index)}
            className="w-8 px-0"
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onChange([...pairs, newPair()])}
        className="self-start"
      >
        {addLabel}
      </Button>
    </div>
  );
}
