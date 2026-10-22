// Ordered steps one virtual user runs per iteration. One step is open for editing at a time.
import { useEffect, useRef } from 'react';
import {
  BODY_FORMATS,
  HTTP_METHODS,
  type BodyFormat,
  type FlowStep,
  type HttpMethod,
} from '../../api/runs.ts';
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
  SOAP_FLOW,
  emptyStep,
  toDraft,
  type StepDraft,
} from './flow.ts';
import { Trans } from 'react-i18next';
import { useCopy } from '../../i18n/useCopy.ts';
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
  /** Shows "Load SOAP example"; its target is the run panel's business (onExampleLoad). */
  hasSoapExample: boolean;
  /** Called after an example's steps are loaded, so the panel can point the run at its target. */
  onExampleLoad: (example: 'quickPizza' | 'soap') => void;
}

const METHOD_OPTIONS = HTTP_METHODS.map((value) => ({ value, label: value }));
const BODY_FORMAT_OPTIONS = BODY_FORMATS.map((value) => ({ value, label: value.toUpperCase() }));
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
  hasSoapExample,
  onExampleLoad,
}: FlowEditorProps) {
  const { t } = useCopy();
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
  const loadExample = (flow: FlowStep[]) => {
    const example = flow.map(toDraft);
    onChange(example);
    setOpenId(example[0]?.id);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-fg-muted">
        {t('flow.intro')} {t('flow.introUse')}{' '}
        {BUILTIN_PLACEHOLDERS.map((name, index) => (
          <span key={name}>
            {index > 0 && ', '}
            <code className="font-mono text-fg">{`{{${name}}}`}</code>
          </span>
        ))}{' '}
        {t('flow.introAfter')}
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
                  <span className="min-w-0 truncate">{step.name || t('flow.untitled')}</span>
                  {step.id === errorStepId && (
                    <span
                      role="img"
                      aria-label={t('flow.hasProblem')}
                      className="size-1.5 shrink-0 rounded-full bg-danger"
                    />
                  )}
                </span>
                <span className="col-start-3 truncate font-mono text-xs text-fg-muted">
                  {step.path || <span className="font-sans italic">{t('flow.emptyPath')}</span>}
                </span>
              </button>
              <Button
                variant="secondary"
                size="sm"
                aria-label={t('flow.moveUp', { number: index + 1 })}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="w-7 px-0"
              >
                ↑
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label={t('flow.moveDown', { number: index + 1 })}
                disabled={index === steps.length - 1}
                onClick={() => move(index, 1)}
                className="w-7 px-0"
              >
                ↓
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label={t('flow.remove', { number: index + 1 })}
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
          {t('flow.add')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          data-testid="load-quickpizza-example"
          onClick={() => {
            loadExample(QUICKPIZZA_FLOW);
            onExampleLoad('quickPizza');
          }}
        >
          {t('flow.loadExample')}
        </Button>
        {hasSoapExample && (
          <Button
            variant="secondary"
            size="sm"
            data-testid="load-soap-example"
            onClick={() => {
              loadExample(SOAP_FLOW);
              onExampleLoad('soap');
            }}
          >
            {t('flow.loadSoapExample')}
          </Button>
        )}
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
  const { t } = useCopy();
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
        <Field label={t('flow.name')} htmlFor={`${id}-name`}>
          <Input
            id={`${id}-name`}
            value={step.name}
            maxLength={MAX_STEP_NAME_LENGTH}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </Field>
        <Field label={t('flow.status')} htmlFor={`${id}-status`}>
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
        label={t('flow.request')}
        htmlFor={`${id}-path`}
        hint={t('flow.requestHint', { example: '{{itemId}}' })}
      >
        <div className="grid grid-cols-[6.5rem_1fr] gap-2">
          <Select
            aria-label={t('flow.method')}
            value={step.method}
            onChange={(method: HttpMethod) => onChange({ method })}
            options={METHOD_OPTIONS}
          />
          <Input
            id={`${id}-path`}
            mono
            value={step.path}
            placeholder={t('flow.pathPlaceholder')}
            onChange={(event) => onChange({ path: event.target.value })}
          />
        </div>
      </Field>
      <div className="flex flex-col gap-1.5" data-testid="step-headers">
        <span className="text-sm font-medium text-fg">{t('flow.headers')}</span>
        <PairsEditor
          id={`${id}-header`}
          pairs={step.headers}
          onChange={(headers) => onChange({ headers })}
          keyLabel={t('flow.header')}
          valueLabel={t('flow.value')}
          keyPlaceholder="Authorization"
          valuePlaceholder="Token {{token}}"
          addLabel={t('flow.addHeader')}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-fg">{t('flow.format')}</span>
          <SegmentedControl
            label={t('flow.formatLabel')}
            testId="step-body-format"
            options={BODY_FORMAT_OPTIONS}
            value={step.bodyFormat}
            onChange={(bodyFormat: BodyFormat) => onChange({ bodyFormat })}
          />
        </div>
        <p className="m-0 text-xs text-fg-muted">
          {soap ? t('flow.formatHint.soap', { example: '{{name}}' }) : t('flow.formatHint.json')}
        </p>
      </div>
      <Field
        label={t(soap ? 'flow.body.soap' : 'flow.body.json')}
        htmlFor={`${id}-body-text`}
        hint={t(soap ? 'flow.bodyHint.soap' : 'flow.bodyHint.json')}
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
        <span className="text-sm font-medium text-fg">{t('flow.wait')}</span>
        <p className="m-0 text-xs text-fg-muted">{t('flow.waitHint', { max: MAX_WAIT_SECONDS })}</p>
        {/* Text, not number: a number input reads unparseable text as empty. */}
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('flow.shortest')} htmlFor={`${id}-wait-min`}>
            <Input
              id={`${id}-wait-min`}
              data-testid="step-wait-min"
              mono
              inputMode="decimal"
              placeholder={t('flow.waitPlaceholder')}
              value={step.waitMin}
              onChange={(event) => onChange({ waitMin: event.target.value })}
            />
          </Field>
          <Field label={t('flow.longest')} htmlFor={`${id}-wait-max`}>
            <Input
              id={`${id}-wait-max`}
              data-testid="step-wait-max"
              mono
              inputMode="decimal"
              placeholder={t('flow.waitPlaceholder')}
              value={step.waitMax}
              onChange={(event) => onChange({ waitMax: event.target.value })}
            />
          </Field>
        </div>
      </div>
      <div className="flex flex-col gap-1.5" data-testid="step-saves">
        <span className="text-sm font-medium text-fg">{t('flow.save')}</span>
        <p className="m-0 text-xs text-fg-muted">
          <Trans
            i18nKey={soap ? 'flow.saveHint.soap' : 'flow.saveHint.json'}
            values={{ example: '{{name}}' }}
            components={{ code: <code className="font-mono" /> }}
          />
        </p>
        <PairsEditor
          id={`${id}-save`}
          pairs={step.extract}
          onChange={(extract) => onChange({ extract })}
          keyLabel={t('flow.name')}
          valueLabel={t(soap ? 'flow.savePath.soap' : 'flow.savePath.json')}
          keyPlaceholder="token"
          valuePlaceholder={soap ? 'LoginResponse.Token' : 'token'}
          addLabel={t('flow.addValue')}
        />
      </div>
    </div>
  );
}
