// Ordered steps one virtual user runs per iteration. One step is open for editing at a time.
import { HTTP_METHODS, type HttpMethod } from '../../api/runs.ts';
import { Button, Field, Input, Select, Textarea, cn } from '../../components/ui/index.ts';
import {
  BUILTIN_PLACEHOLDERS,
  MAX_BODY_LENGTH,
  MAX_STEP_NAME_LENGTH,
  QUICKPIZZA_FLOW,
  emptyStep,
  toDraft,
  type StepDraft,
} from './flow.ts';
import { PairsEditor } from './PairsEditor.tsx';

export interface FlowEditorProps {
  steps: StepDraft[];
  onChange: (steps: StepDraft[]) => void;
  /** The step open for editing. */
  openId: string | undefined;
  onOpenChange: (id: string | undefined) => void;
}

const METHOD_OPTIONS = HTTP_METHODS.map((value) => ({ value, label: value }));

export function FlowEditor({ steps, onChange, openId, onOpenChange: setOpenId }: FlowEditorProps) {
  const update = (id: string, patch: Partial<StepDraft>) =>
    onChange(steps.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  const move = (index: number, offset: number) => {
    const next = [...steps];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(index + offset, 0, moved);
    onChange(next);
  };
  const remove = (id: string) => onChange(steps.filter((step) => step.id !== id));
  const add = () => {
    const step = emptyStep();
    onChange([...steps, step]);
    setOpenId(step.id);
  };
  const loadExample = () => {
    const example = QUICKPIZZA_FLOW.map(toDraft);
    onChange(example);
    setOpenId(example[0]?.id);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-fg-muted">
        Each user runs these steps in order, again and again. Use{' '}
        {BUILTIN_PLACEHOLDERS.map((name, index) => (
          <span key={name}>
            {index > 0 && ', '}
            <code className="font-mono text-fg">{`{{${name}}}`}</code>
          </span>
        ))}{' '}
        or a value an earlier step saves, in the path, headers or body.
      </p>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {steps.map((step, index) => (
          <li key={step.id} className="rounded-md border border-line bg-surface">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <button
                type="button"
                aria-expanded={openId === step.id}
                aria-controls={openId === step.id ? `${step.id}-body` : undefined}
                onClick={() => setOpenId(openId === step.id ? undefined : step.id)}
                className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-sm"
              >
                <span className="w-5 shrink-0 text-xs tabular-nums text-fg-faint">{index + 1}</span>
                <span className="w-14 shrink-0 font-mono text-xs font-semibold text-accent">
                  {step.method}
                </span>
                <span className="max-w-[55%] shrink-0 truncate font-medium text-fg">
                  {step.name || 'Untitled'}
                </span>
                <span className="min-w-0 truncate font-mono text-xs text-fg-muted">
                  {step.path}
                </span>
              </button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Move step ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="w-7 px-0"
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Move step ${index + 1} down`}
                disabled={index === steps.length - 1}
                onClick={() => move(index, 1)}
                className="w-7 px-0"
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove step ${index + 1}`}
                disabled={steps.length === 1}
                onClick={() => remove(step.id)}
                className="w-7 px-0"
              >
                ×
              </Button>
            </div>
            {openId === step.id && (
              <StepFields
                step={step}
                onChange={(patch) => update(step.id, patch)}
                className="border-t border-line"
              />
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={add}>
          Add step
        </Button>
        <Button variant="ghost" size="sm" onClick={loadExample}>
          Load QuickPizza example
        </Button>
      </div>
    </div>
  );
}

interface StepFieldsProps {
  step: StepDraft;
  onChange: (patch: Partial<StepDraft>) => void;
  className?: string;
}

function StepFields({ step, onChange, className }: StepFieldsProps) {
  const id = step.id;
  return (
    <div id={`${id}-body`} className={cn('flex flex-col gap-4 p-3', className)}>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Field label="Name" htmlFor={`${id}-name`}>
          <Input
            id={`${id}-name`}
            value={step.name}
            maxLength={MAX_STEP_NAME_LENGTH}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </Field>
        <Field label="Status" htmlFor={`${id}-status`}>
          <Input
            id={`${id}-status`}
            mono
            type="number"
            min={100}
            max={599}
            value={step.expectedStatus}
            onChange={(event) => onChange({ expectedStatus: Number(event.target.value) })}
          />
        </Field>
      </div>
      <Field
        label="Request"
        htmlFor={`${id}-path`}
        hint="A path such as /api/items is added to the base URL. Leave empty to use the base URL."
      >
        <div className="grid grid-cols-[6.5rem_1fr] gap-2">
          <Select
            aria-label="Method"
            value={step.method}
            onChange={(method: HttpMethod) => onChange({ method })}
            options={METHOD_OPTIONS}
          />
          <Input
            id={`${id}-path`}
            mono
            value={step.path}
            placeholder="/api/items/{{itemId}}"
            onChange={(event) => onChange({ path: event.target.value })}
          />
        </div>
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg">Headers</span>
        <PairsEditor
          id={`${id}-header`}
          pairs={step.headers}
          onChange={(headers) => onChange({ headers })}
          keyLabel="Header"
          valueLabel="Value"
          keyPlaceholder="Authorization"
          valuePlaceholder="Token {{token}}"
          addLabel="Add header"
        />
      </div>
      <Field
        label="JSON body"
        htmlFor={`${id}-body-text`}
        hint="Leave empty for no body. Sent as application/json unless a header says otherwise."
      >
        <Textarea
          id={`${id}-body-text`}
          mono
          rows={5}
          maxLength={MAX_BODY_LENGTH}
          spellCheck={false}
          value={step.body}
          placeholder={'{\n  "name": "item-{{shortId}}"\n}'}
          onChange={(event) => onChange({ body: event.target.value })}
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg">Save from response</span>
        <p className="m-0 text-xs text-fg-muted">
          Later steps use a saved value as {'{{name}}'}. The path reads the JSON response, for
          example <code className="font-mono">pizza.id</code> or{' '}
          <code className="font-mono">items.0.id</code>.
        </p>
        <PairsEditor
          id={`${id}-save`}
          pairs={step.extract}
          onChange={(extract) => onChange({ extract })}
          keyLabel="Name"
          valueLabel="JSON path"
          keyPlaceholder="token"
          valuePlaceholder="token"
          addLabel="Add value"
        />
      </div>
    </div>
  );
}
