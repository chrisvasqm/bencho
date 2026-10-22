import { Button, Input } from '../../components/ui/index.ts';
import { useCopy } from '../../i18n/useCopy.ts';
import { parseTarget, toStageRow, type StageRow } from './stages.ts';

export interface StagesEditorProps {
  stages: StageRow[];
  onChange: (stages: StageRow[]) => void;
  /** What a target counts, for the column header and labels. */
  targetLabel: string;
  /** Rate targets take decimals (0.25 or 0,25); VU targets are whole. */
  decimals: boolean;
}

/** Rows of duration + target users. The last row usually ramps down to 0. */
export function StagesEditor({ stages, onChange, targetLabel, decimals }: StagesEditorProps) {
  const { t } = useCopy();
  const update = (index: number, patch: Partial<StageRow>) =>
    onChange(
      stages.map((stage, position) => (position === index ? { ...stage, ...patch } : stage)),
    );
  const remove = (index: number) =>
    onChange(stages.filter((_stage, position) => position !== index));
  const add = () => onChange([...stages, toStageRow({ duration: '30s', target: 0 })]);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-fg-muted">
        <span>{t('panel.duration')}</span>
        <span>{targetLabel}</span>
        <span className="w-8" />
      </div>
      {stages.map((stage, index) => (
        <div key={stage.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <Input
            id={`stage-${index}-duration`}
            aria-label={t('panel.stageDuration', { number: index + 1 })}
            data-testid={`stage-${index}-duration`}
            mono
            value={stage.duration}
            onChange={(event) => update(index, { duration: event.target.value })}
            placeholder="30s"
          />
          <Input
            id={`stage-${index}-target`}
            aria-label={t('panel.stageTarget', {
              number: index + 1,
              label: targetLabel.toLowerCase(),
            })}
            data-testid={`stage-${index}-target`}
            mono
            inputMode={decimals ? 'decimal' : 'numeric'}
            value={stage.targetText}
            onChange={(event) =>
              update(index, {
                targetText: event.target.value,
                target: parseTarget(event.target.value, decimals),
              })
            }
          />
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('panel.removeStage', { number: index + 1 })}
            data-testid={`stage-${index}-remove`}
            disabled={stages.length === 1}
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
        onClick={add}
        className="self-start"
        data-testid="add-stage"
      >
        {t('panel.addStage')}
      </Button>
    </div>
  );
}
