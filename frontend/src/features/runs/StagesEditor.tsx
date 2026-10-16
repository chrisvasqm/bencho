import { Button, Input } from '../../components/ui/index.ts';
import type { Stage } from '../../api/runs.ts';
import { toStageRow, type StageRow } from './stages.ts';

export interface StagesEditorProps {
  stages: StageRow[];
  onChange: (stages: StageRow[]) => void;
}

/** Rows of duration + target users. The last row usually ramps down to 0. */
export function StagesEditor({ stages, onChange }: StagesEditorProps) {
  const update = (index: number, patch: Partial<Stage>) =>
    onChange(
      stages.map((stage, position) => (position === index ? { ...stage, ...patch } : stage)),
    );
  const remove = (index: number) =>
    onChange(stages.filter((_stage, position) => position !== index));
  const add = () => onChange([...stages, toStageRow({ duration: '30s', target: 0 })]);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-fg-muted">
        <span>Duration</span>
        <span>Virtual users</span>
        <span className="w-8" />
      </div>
      {stages.map((stage, index) => (
        <div key={stage.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <Input
            id={`stage-${index}-duration`}
            aria-label={`Stage ${index + 1} duration`}
            mono
            value={stage.duration}
            onChange={(event) => update(index, { duration: event.target.value })}
            placeholder="30s"
          />
          <Input
            id={`stage-${index}-target`}
            aria-label={`Stage ${index + 1} virtual users`}
            mono
            type="number"
            min={0}
            step={1}
            value={stage.target}
            onChange={(event) => update(index, { target: Number(event.target.value) })}
          />
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove stage ${index + 1}`}
            disabled={stages.length === 1}
            onClick={() => remove(index)}
            className="w-8 px-0"
          >
            ×
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={add} className="self-start">
        Add stage
      </Button>
    </div>
  );
}
