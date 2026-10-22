// Ordered steps one virtual user runs per iteration. One step is open for editing at a time.
import { useEffect, useRef } from 'react';
import { HTTP_METHODS, type BodyFormat, type HttpMethod } from '../../api/runs.ts';
import {
  Button,
  Field,
  Input,
  SegmentedControl,
  Select,
  Textarea,
  cn,
} from '../../components/ui/index.ts';
import {
  BUILTIN_PLACEHOLDERS,
  MAX_BODY_LENGTH,
  MAX_STEP_NAME_LENGTH,
  MAX_WAIT_SECONDS,
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
  /** The step with a problem to fix, and the problem, shown inside that step. */
  errorStepId?: string;
  error?: string;
  /** True right after a submit found the problem: scroll it into view once. */
  scrollToError?: boolean;
  onErrorShown?: () => void;
  /** "Step 2 (Log in)", shown with the message when that step is closed. */
  errorLabel?: string;
}

const METHOD_OPTIONS = HTTP_METHODS.map((value) => ({ value, label: value }));
const BODY_FORMAT_OPTIONS = [
  { value: 'json', label: 'JSON' },
  { value: 'soap', label: 'SOAP' },
] as const;
const SOAP_BODY_PLACEHOLDER = [
  '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
  '  <soap:Body>',
  '    <GetItem><Name>item-{{shortId}}</Name></GetItem>',
  '  </soap:Body>',
  '</soap:Envelope>',
].join('\n');

export function FlowEditor({
  steps,
  onChange,
  openId,
  onOpenChange: setOpenId,
  errorStepId,
  error,
  scrollToError,
  onErrorShown,
  errorLabel,
}: FlowEditorProps) {
  // A problem with no step, or with its step closed, shows under the list instead.
  const listError = error && (!errorStepId || errorStepId !== openId) ? error : undefined;
  const listErrorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!listError || !scrollToError) return;
    listErrorRef.current?.scrollIntoView({ block: 'nearest' });
    onErrorShown?.();
  }, [listError, scrollToError, onErrorShown]);
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
          <li
            key={step.id}
            className={cn(
              'rounded-md border bg-surface',
              step.id === errorStepId ? 'border-danger' : 'border-line',
            )}
          >
            <div className="flex items-center gap-2 px-2 py-1.5">
              <button
                type="button"
                aria-expanded={openId === step.id}
                aria-controls={openId === step.id ? `${step.id}-body` : undefined}
                onClick={() => setOpenId(openId === step.id ? undefined : step.id)}
                className="grid min-w-0 flex-1 grid-cols-[1.25rem_3.25rem_minmax(0,1fr)] items-baseline gap-x-2 py-1 text-left text-sm"
              >
                <span className="text-xs tabular-nums text-fg-faint">{index + 1}</span>
                <span className="font-mono text-xs font-semibold text-accent-strong">
                  {step.method}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 font-medium text-fg">
                  <span className="min-w-0 truncate">{step.name || 'Untitled'}</span>
                  {step.id === errorStepId && (
                    <span
                      role="img"
                      aria-label="has a problem"
                      className="size-1.5 shrink-0 rounded-full bg-danger"
                    />
                  )}
                </span>
                <span className="col-start-3 truncate font-mono text-xs text-fg-muted">
                  {step.path || <span className="font-sans italic">base URL</span>}
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
                error={step.id === errorStepId ? error : undefined}
                scrollToError={scrollToError}
                onErrorShown={onErrorShown}
                onChange={(patch) => update(step.id, patch)}
                className="border-t border-line"
              />
            )}
          </li>
        ))}
      </ol>
      {listError && (
        <p ref={listErrorRef} role="alert" className="m-0 text-xs text-danger">
          {errorStepId && errorLabel ? `${errorLabel}: ` : ''}
          {listError}
        </p>
      )}
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
  error?: string;
  scrollToError?: boolean;
  onErrorShown?: () => void;
  onChange: (patch: Partial<StepDraft>) => void;
  className?: string;
}

function StepFields({
  step,
  error,
  scrollToError,
  onErrorShown,
  onChange,
  className,
}: StepFieldsProps) {
  const id = step.id;
  const soap = step.bodyFormat === 'soap';
  const errorRef = useRef<HTMLParagraphElement>(null);
  // The panel scrolls; bring a new problem into view so the user sees what to fix.
  useEffect(() => {
    if (!error || !scrollToError) return;
    errorRef.current?.scrollIntoView({ block: 'nearest' });
    onErrorShown?.();
  }, [error, scrollToError, onErrorShown]);
  return (
    <div id={`${id}-body`} className={cn('flex flex-col gap-4 p-3', className)}>
      {error && (
        <p
          ref={errorRef}
          role="alert"
          data-testid="flow-step-error"
          className="m-0 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger"
        >
          {error}
        </p>
      )}
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
            data-testid="step-expected-status"
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
        hint="A path such as /api/items/{{itemId}} is added to the base URL. Leave it empty to use the base URL."
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
            placeholder="Empty: the base URL"
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
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-fg">Format</span>
          <SegmentedControl
            label="Body and response format"
            testId="step-body-format"
            options={BODY_FORMAT_OPTIONS}
            value={step.bodyFormat}
            onChange={(bodyFormat: BodyFormat) => onChange({ bodyFormat })}
          />
        </div>
        <p className="m-0 text-xs text-fg-muted">
          {soap
            ? 'The body is XML and saved values come from the XML response. Values in {{name}} are escaped as XML text.'
            : 'The body is JSON and saved values come from the JSON response.'}
        </p>
      </div>
      <Field
        label={soap ? 'SOAP body' : 'JSON body'}
        htmlFor={`${id}-body-text`}
        hint={
          soap
            ? 'Leave empty for no body. Sent as text/xml (SOAP 1.1) unless a header says otherwise: for SOAP 1.2 set Content-Type to application/soap+xml. Add a SOAPAction header if the service needs one.'
            : 'Leave empty for no body. Sent as application/json unless a header says otherwise.'
        }
      >
        <Textarea
          id={`${id}-body-text`}
          data-testid="step-body"
          mono
          rows={soap ? 7 : 5}
          maxLength={MAX_BODY_LENGTH}
          spellCheck={false}
          value={step.body}
          placeholder={soap ? SOAP_BODY_PLACEHOLDER : '{\n  "name": "item-{{shortId}}"\n}'}
          onChange={(event) => onChange({ body: event.target.value })}
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg">Wait after this step</span>
        <p className="m-0 text-xs text-fg-muted">
          Seconds, 0 to {MAX_WAIT_SECONDS}. Each time, the user waits a random time in this range,
          like a real person reading or typing. Leave both empty to use the think time.
        </p>
        {/* Text, not number: a number input reads unparseable text as empty. */}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Shortest" htmlFor={`${id}-wait-min`}>
            <Input
              id={`${id}-wait-min`}
              data-testid="step-wait-min"
              mono
              inputMode="decimal"
              placeholder="Think time"
              value={step.waitMin}
              onChange={(event) => onChange({ waitMin: event.target.value })}
            />
          </Field>
          <Field label="Longest" htmlFor={`${id}-wait-max`}>
            <Input
              id={`${id}-wait-max`}
              data-testid="step-wait-max"
              mono
              inputMode="decimal"
              placeholder="Think time"
              value={step.waitMax}
              onChange={(event) => onChange({ waitMax: event.target.value })}
            />
          </Field>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg">Save from response</span>
        {soap ? (
          <p className="m-0 text-xs text-fg-muted">
            Later steps use a saved value as {'{{name}}'}. The path names elements of the XML
            response, at any depth and without prefixes, for example{' '}
            <code className="font-mono">Token</code> or{' '}
            <code className="font-mono">LoginResponse.Token</code>. A number picks one of many:{' '}
            <code className="font-mono">Item.1.Id</code>.
          </p>
        ) : (
          <p className="m-0 text-xs text-fg-muted">
            Later steps use a saved value as {'{{name}}'}. The path reads the JSON response, for
            example <code className="font-mono">pizza.id</code> or{' '}
            <code className="font-mono">items.0.id</code>.
          </p>
        )}
        <PairsEditor
          id={`${id}-save`}
          pairs={step.extract}
          onChange={(extract) => onChange({ extract })}
          keyLabel="Name"
          valueLabel={soap ? 'Element path' : 'JSON path'}
          keyPlaceholder="token"
          valuePlaceholder={soap ? 'LoginResponse.Token' : 'token'}
          addLabel="Add value"
        />
      </div>
    </div>
  );
}
