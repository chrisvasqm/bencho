import { useState, type FormEvent } from 'react';
import { Button, Field, Input, Select } from '../../components/ui/index.ts';
import {
  RUN_TYPES,
  type CreateRunInput,
  type RunDefaults,
  type RunType,
  type Stage,
} from '../../api/runs.ts';
import { RUN_TYPE_DESCRIPTIONS, RUN_TYPE_LABELS } from './format.ts';
import { StagesEditor } from './StagesEditor.tsx';

export interface RunFormProps {
  defaults: RunDefaults;
  type: RunType;
  onTypeChange: (type: RunType) => void;
  onSubmit: (input: CreateRunInput) => Promise<void>;
  submitting: boolean;
  submitError?: string;
}

const DURATION_PATTERN = /^(\d+(ms|s|m|h))+$/;
const PERCENTILES = ['p50', 'p90', 'p95', 'p99'] as const;

function validate(input: CreateRunInput): Record<string, string> {
  const errors: Record<string, string> = {};
  try {
    new URL(input.baseUrl);
  } catch {
    errors.baseUrl = 'Enter a full URL, including http:// or https://';
  }
  if (input.stages.some((stage) => !DURATION_PATTERN.test(stage.duration))) {
    errors.stages = 'Durations use k6 units: 10s, 1m, 1h30m';
  }
  if (input.stages.some((stage) => !Number.isInteger(stage.target) || stage.target < 0)) {
    errors.stages = 'Virtual users must be a whole number of 0 or more';
  }
  if (input.maxErrorRate < 0 || input.maxErrorRate > 1) {
    errors.maxErrorRate = 'Use a percentage between 0 and 100';
  }
  if (PERCENTILES.some((key) => input.latencyLimitsMs[key] <= 0)) {
    errors.latency = 'Every limit must be above 0 ms';
  }
  return errors;
}

export function RunForm({
  defaults,
  type,
  onTypeChange,
  onSubmit,
  submitting,
  submitError,
}: RunFormProps) {
  const [baseUrl, setBaseUrl] = useState(defaults.baseUrl);
  const [stages, setStages] = useState<Stage[]>(defaults.stages[type]);
  const [thinkTime, setThinkTime] = useState(defaults.limits.thinkTimeSeconds);
  const [maxErrorPercent, setMaxErrorPercent] = useState(defaults.limits.maxErrorRate * 100);
  const [latency, setLatency] = useState(defaults.limits.latencyLimitsMs);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const changeType = (next: RunType) => {
    onTypeChange(next);
    setStages(defaults.stages[next]);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const input: CreateRunInput = {
      type,
      baseUrl: baseUrl.trim(),
      stages,
      thinkTimeSeconds: thinkTime,
      maxErrorRate: maxErrorPercent / 100,
      latencyLimitsMs: latency,
    };
    const nextErrors = validate(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) await onSubmit(input);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <Field label="Test type" htmlFor="run-type" hint={RUN_TYPE_DESCRIPTIONS[type]}>
        <Select
          id="run-type"
          value={type}
          onChange={changeType}
          options={RUN_TYPES.map((value) => ({ value, label: RUN_TYPE_LABELS[value] }))}
        />
      </Field>

      <Field label="Target URL" htmlFor="base-url" error={errors.baseUrl}>
        <Input
          id="base-url"
          mono
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="https://api.example.com/health"
          invalid={Boolean(errors.baseUrl)}
        />
      </Field>

      <Field label="Load shape" htmlFor="stage-0-duration" error={errors.stages}>
        <StagesEditor stages={stages} onChange={setStages} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Think time" htmlFor="think-time" hint="Seconds between requests per user">
          <Input
            id="think-time"
            mono
            type="number"
            min={0}
            step={0.1}
            value={thinkTime}
            onChange={(event) => setThinkTime(Number(event.target.value))}
          />
        </Field>
        <Field
          label="Max error rate"
          htmlFor="max-error-rate"
          hint="Percent of failed requests"
          error={errors.maxErrorRate}
        >
          <Input
            id="max-error-rate"
            mono
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={maxErrorPercent}
            onChange={(event) => setMaxErrorPercent(Number(event.target.value))}
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-fg">Latency limits (ms)</legend>
        <div className="grid grid-cols-4 gap-2">
          {PERCENTILES.map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <label htmlFor={`limit-${key}`} className="font-mono text-xs text-fg-muted">
                {key}
              </label>
              <Input
                id={`limit-${key}`}
                mono
                type="number"
                min={1}
                step={10}
                value={latency[key]}
                onChange={(event) => setLatency({ ...latency, [key]: Number(event.target.value) })}
              />
            </div>
          ))}
        </div>
        {errors.latency && (
          <p role="alert" className="text-xs text-danger">
            {errors.latency}
          </p>
        )}
      </fieldset>

      {submitError && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {submitError}
        </p>
      )}

      <Button type="submit" loading={submitting} className="self-start">
        Start {RUN_TYPE_LABELS[type].toLowerCase()} test
      </Button>
    </form>
  );
}
