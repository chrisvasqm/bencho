// Left-hand control panel: build a run across four tabs, start it from the pinned footer.
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, lazy, useState, type FormEvent } from 'react';
import {
  RUN_TYPES,
  type CreateRunInput,
  type RunDefaults,
  type RunType,
  type Stage,
} from '../../api/runs.ts';
import {
  Button,
  Card,
  Field,
  FieldSkeleton,
  Input,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui/index.ts';
import { RUN_TYPE_DESCRIPTIONS, RUN_TYPE_LABELS, durationToSeconds } from './format.ts';
import { StagesEditor } from './StagesEditor.tsx';
import { FlowEditor } from './FlowEditor.tsx';
import { draftProblem, flowProblem, fromDraft, toDraft, type StepDraft } from './flow.ts';

type PanelTab = 'target' | 'flow' | 'shape' | 'limits';

const PANEL_TABS: ReadonlyArray<{ value: PanelTab; label: string }> = [
  { value: 'target', label: 'Target' },
  { value: 'flow', label: 'Flow' },
  { value: 'shape', label: 'Load shape' },
  { value: 'limits', label: 'Limits' },
];

const ERROR_TAB: Record<string, PanelTab> = {
  baseUrl: 'target',
  flow: 'flow',
  stages: 'shape',
  thinkTime: 'limits',
  maxErrorRate: 'limits',
  latency: 'limits',
};

const PERCENTILES = ['p50', 'p90', 'p95', 'p99'] as const;

// recharts is large; the preview loads after the panel is usable.
const LoadShapeChart = lazy(() => import('./LoadShapeChart.tsx'));
// Mirrors the backend limits so the user sees which field to fix.
const MAX_RUN_SECONDS = 3600;
const MAX_VIRTUAL_USERS = 1000;
const MAX_STAGES = 20;
const FORM_ID = 'run-form';

function validate(input: CreateRunInput, steps: StepDraft[]): Record<string, string> {
  const errors: Record<string, string> = {};
  try {
    new URL(input.baseUrl);
  } catch {
    errors.baseUrl = 'Enter a full URL, including http:// or https://';
  }
  const problem = draftProblem(steps) ?? flowProblem(input.flow);
  if (problem) errors.flow = problem;
  const seconds = input.stages.map((stage) => durationToSeconds(stage.duration));
  if (seconds.some((value) => !Number.isFinite(value))) {
    errors.stages = 'Durations use k6 units: 10s, 1m, 1h30m';
  } else if (input.stages.some((stage) => !Number.isInteger(stage.target) || stage.target < 0)) {
    errors.stages = 'Virtual users must be a whole number of 0 or more';
  } else if (input.stages.some((stage) => stage.target > MAX_VIRTUAL_USERS)) {
    errors.stages = `Use at most ${MAX_VIRTUAL_USERS} virtual users per stage`;
  } else if (input.stages.length > MAX_STAGES) {
    errors.stages = `Use at most ${MAX_STAGES} stages`;
  } else if (seconds.reduce((total, value) => total + value, 0) > MAX_RUN_SECONDS) {
    errors.stages = 'All stages together must last at most 60 minutes';
  }
  if (!Number.isFinite(input.thinkTimeSeconds) || input.thinkTimeSeconds < 0) {
    errors.thinkTime = 'Use a number of seconds, 0 or more';
  }
  if (!Number.isFinite(input.maxErrorRate) || input.maxErrorRate < 0 || input.maxErrorRate > 1) {
    errors.maxErrorRate = 'Use a percentage between 0 and 100';
  }
  if (
    PERCENTILES.some(
      (key) => !Number.isFinite(input.latencyLimitsMs[key]) || input.latencyLimitsMs[key] <= 0,
    )
  ) {
    errors.latency = 'Every limit must be above 0 ms';
  }
  return errors;
}

export interface RunPanelProps {
  defaults?: RunDefaults;
  type: RunType;
  onTypeChange: (type: RunType) => void;
  onSubmit: (input: CreateRunInput) => Promise<void>;
  submitting: boolean;
  className?: string;
}

export function RunPanel({ defaults, ...props }: RunPanelProps) {
  if (!defaults) return <RunPanelSkeleton className={props.className} />;
  return <RunPanelForm defaults={defaults} {...props} />;
}

function RunPanelForm({
  defaults,
  type,
  onTypeChange,
  onSubmit,
  submitting,
  className,
}: RunPanelProps & { defaults: RunDefaults }) {
  const [tab, setTab] = useState<PanelTab>('target');
  const [baseUrl, setBaseUrl] = useState(defaults.baseUrl);
  const [stages, setStages] = useState<Stage[]>(defaults.stages[type]);
  const [flowSteps, setFlowSteps] = useState<StepDraft[]>(() => defaults.flow.map(toDraft));
  // Kept here, not in FlowEditor: switching tabs remounts the editor.
  const [openStepId, setOpenStepId] = useState<string | undefined>(flowSteps[0]?.id);
  const [thinkTime, setThinkTime] = useState(defaults.limits.thinkTimeSeconds);
  const [maxErrorPercent, setMaxErrorPercent] = useState(defaults.limits.maxErrorRate * 100);
  const [latency, setLatency] = useState(defaults.limits.latencyLimitsMs);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The type can also change from the Runs tabs; the stages must follow either way.
  const [stagesType, setStagesType] = useState(type);
  if (stagesType !== type) {
    setStagesType(type);
    setStages(defaults.stages[type]);
  }

  const tabsWithErrors = new Set(Object.keys(errors).map((key) => ERROR_TAB[key]));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const input: CreateRunInput = {
      type,
      baseUrl: baseUrl.trim(),
      stages,
      flow: flowSteps.map(fromDraft),
      thinkTimeSeconds: thinkTime,
      maxErrorRate: maxErrorPercent / 100,
      latencyLimitsMs: latency,
    };
    const nextErrors = validate(input, flowSteps);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      setTab(ERROR_TAB[firstError] ?? 'target');
      return;
    }
    await onSubmit(input);
  };

  return (
    <Card
      title="New run"
      description={RUN_TYPE_DESCRIPTIONS[type]}
      scrollBody
      className={className}
      headerExtra={
        <Tabs
          label="Run settings"
          value={tab}
          onChange={setTab}
          items={PANEL_TABS.map((item) => ({ ...item, alert: tabsWithErrors.has(item.value) }))}
        />
      }
      footer={
        <Button type="submit" form={FORM_ID} loading={submitting} className="w-full">
          {submitting ? 'Starting…' : `Start ${RUN_TYPE_LABELS[type].toLowerCase()} test`}
        </Button>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
        <fieldset disabled={submitting} className="m-0 min-w-0 border-0 p-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-5"
            >
              {tab === 'target' && (
                <>
                  <Field label="Test type" htmlFor="run-type">
                    <Select
                      id="run-type"
                      value={type}
                      onChange={onTypeChange}
                      options={RUN_TYPES.map((value) => ({
                        value,
                        label: RUN_TYPE_LABELS[value],
                      }))}
                    />
                  </Field>
                  <Field
                    label="Base URL"
                    htmlFor="base-url"
                    hint="The steps in the Flow tab send their requests to paths under this URL."
                    error={errors.baseUrl}
                  >
                    <Input
                      id="base-url"
                      mono
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                      placeholder="https://api.example.com/health"
                      invalid={Boolean(errors.baseUrl)}
                    />
                  </Field>
                </>
              )}

              {tab === 'flow' && (
                <>
                  <FlowEditor
                    steps={flowSteps}
                    onChange={setFlowSteps}
                    openId={openStepId}
                    onOpenChange={setOpenStepId}
                  />
                  {errors.flow && (
                    <p role="alert" className="text-xs text-danger">
                      {errors.flow}
                    </p>
                  )}
                </>
              )}

              {tab === 'shape' && (
                <>
                  <Suspense fallback={<Skeleton className="h-[164px] w-full" />}>
                    <LoadShapeChart stages={stages} />
                  </Suspense>
                  <Field label="Stages" htmlFor="stage-0-duration" error={errors.stages}>
                    <StagesEditor stages={stages} onChange={setStages} />
                  </Field>
                </>
              )}

              {tab === 'limits' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Think time"
                      htmlFor="think-time"
                      hint="Seconds a user waits after each step"
                      error={errors.thinkTime}
                    >
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
                  <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                    <legend className="mb-1.5 text-sm font-medium text-fg">
                      Latency limits (ms)
                    </legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {PERCENTILES.map((key) => (
                        <div key={key} className="flex flex-col gap-1">
                          <label htmlFor={`limit-${key}`} className="text-xs text-fg-muted">
                            {key}
                          </label>
                          <Input
                            id={`limit-${key}`}
                            mono
                            type="number"
                            min={1}
                            step={10}
                            value={latency[key]}
                            onChange={(event) =>
                              setLatency({ ...latency, [key]: Number(event.target.value) })
                            }
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
                  <p className="text-xs text-fg-muted">
                    A run fails when any limit is crossed or fewer than 99% of checks pass.
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </fieldset>
      </form>
    </Card>
  );
}

function RunPanelSkeleton({ className }: { className?: string }) {
  return (
    <Card
      title="New run"
      description={<Skeleton className="mt-1 h-4 w-56" />}
      scrollBody
      className={className}
      headerExtra={
        <div className="flex gap-4 pb-2">
          {PANEL_TABS.map((item) => (
            <Skeleton key={item.value} className="h-5 w-16" />
          ))}
        </div>
      }
      footer={
        <Button loading disabled className="w-full">
          Loading settings…
        </Button>
      }
      aria-busy="true"
    >
      <div className="flex flex-col gap-5">
        <FieldSkeleton />
        <FieldSkeleton />
      </div>
    </Card>
  );
}
