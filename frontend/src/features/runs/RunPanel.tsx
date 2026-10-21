// Left-hand control panel: build a run across four tabs, start it from the pinned footer.
import { AnimatePresence, m } from 'motion/react';
import { Suspense, lazy, useCallback, useState, type FormEvent } from 'react';
import {
  LOAD_MODES,
  RUN_TYPES,
  type CreateRunInput,
  type LoadMode,
  type RunDefaults,
  type RunType,
} from '../../api/runs.ts';
import {
  Button,
  Card,
  Field,
  FieldSkeleton,
  Input,
  Note,
  SegmentedControl,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui/index.ts';
import {
  EXPLAIN,
  LOAD_MODE_LABELS,
  RUN_TYPE_DESCRIPTIONS,
  RUN_TYPE_LABELS,
  TARGET_LABELS,
  durationToSeconds,
  peakUsers,
} from './format.ts';
import { CapacityHint } from './CapacityHint.tsx';
import { StagesEditor } from './StagesEditor.tsx';
import { toStageRow, type StageRow } from './stages.ts';
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
  flowStep: 'flow',
  flowStepLabel: 'flow',
  stages: 'shape',
  maxVirtualUsers: 'shape',
  thinkTime: 'limits',
  maxErrorRate: 'limits',
  latency: 'limits',
};

const PERCENTILES = ['p50', 'p90', 'p95', 'p99'] as const;

// recharts is large; the preview loads after the panel is usable.
const LoadShapeChart = lazy(() => import('./LoadShapeChart.tsx'));
// Mirrors the backend limits so the user sees which field to fix.
const MAX_RUN_SECONDS = 3600;
const MAX_STAGES = 20;
const FORM_ID = 'run-form';

function validate(input: CreateRunInput, steps: StepDraft[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const baseUrl = URL.canParse(input.baseUrl) ? new URL(input.baseUrl) : undefined;
  if (!baseUrl || !/^https?:$/.test(baseUrl.protocol)) {
    errors.baseUrl = 'Enter a full URL, including http:// or https://';
  } else if (baseUrl.username !== '' || baseUrl.password !== '') {
    // Every reader of the runs list would see them; the backend refuses them too.
    errors.baseUrl = 'Put credentials in a header, not in the URL';
  }
  const problem = draftProblem(steps) ?? flowProblem(input.flow);
  if (problem) errors.flow = problem.message;
  // The step's id, not its index, so the mark stays on it when steps are moved or removed.
  const problemStepId = problem?.step === undefined ? undefined : steps[problem.step]?.id;
  if (problemStepId && problem?.step !== undefined) {
    errors.flowStep = problemStepId;
    errors.flowStepLabel = `Step ${problem.step + 1} (${steps[problem.step]?.name.trim() || 'Untitled'})`;
  }
  const seconds = input.stages.map((stage) => durationToSeconds(stage.duration));
  if (seconds.some((value) => !Number.isFinite(value))) {
    errors.stages = 'Durations use k6 units: 10s, 1m, 1h30m';
  } else if (
    input.stages.some((stage) => !Number.isSafeInteger(stage.target) || stage.target < 0)
  ) {
    errors.stages = `${TARGET_LABELS[input.mode]} must be a whole number of 0 or more`;
  } else if (input.stages.length > MAX_STAGES) {
    errors.stages = `Use at most ${MAX_STAGES} stages`;
  } else if (seconds.reduce((total, value) => total + value, 0) > MAX_RUN_SECONDS) {
    errors.stages = 'All stages together must last at most 60 minutes';
  }
  if (
    input.maxVirtualUsers !== undefined &&
    (!Number.isSafeInteger(input.maxVirtualUsers) || input.maxVirtualUsers < 1)
  ) {
    errors.maxVirtualUsers = 'Use a whole number of 1 or more';
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
  const [stages, setStages] = useState<StageRow[]>(() => defaults.stages[type].map(toStageRow));
  const [mode, setMode] = useState<LoadMode>('users');
  const [maxVirtualUsers, setMaxVirtualUsers] = useState(defaults.maxVirtualUsers);
  const [flowSteps, setFlowSteps] = useState<StepDraft[]>(() => defaults.flow.map(toDraft));
  // Kept here, not in FlowEditor: switching tabs remounts the editor.
  const [openStepId, setOpenStepId] = useState<string | undefined>(flowSteps[0]?.id);
  const [submitCount, setSubmitCount] = useState(0);
  // The submit whose flow problem was already scrolled into view; remounts do not scroll again.
  const [shownErrorRevision, setShownErrorRevision] = useState(0);
  const markErrorShown = useCallback(() => setShownErrorRevision(submitCount), [submitCount]);
  const [thinkTime, setThinkTime] = useState(defaults.limits.thinkTimeSeconds);
  const [maxErrorPercent, setMaxErrorPercent] = useState(defaults.limits.maxErrorRate * 100);
  const [latency, setLatency] = useState(defaults.limits.latencyLimitsMs);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The type can also change from the Runs tabs; the stages must follow either way.
  const [stagesType, setStagesType] = useState(type);
  if (stagesType !== type) {
    setStagesType(type);
    setStages(defaults.stages[type].map(toStageRow));
  }

  // Edits clear flow errors, so the marked step always still exists.
  const errorStepId = errors.flowStep;
  const tabsWithErrors = new Set(Object.keys(errors).map((key) => ERROR_TAB[key]));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const input: CreateRunInput = {
      type,
      baseUrl: baseUrl.trim(),
      mode,
      ...(mode === 'rate' && { maxVirtualUsers }),
      stages: stages.map(({ duration, target }) => ({ duration, target })),
      flow: flowSteps.map(fromDraft),
      thinkTimeSeconds: thinkTime,
      maxErrorRate: maxErrorPercent / 100,
      latencyLimitsMs: latency,
    };
    const nextErrors = validate(input, flowSteps);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    const revision = submitCount + 1;
    setSubmitCount(revision);
    // Scroll to a flow problem only when this submit opens the Flow tab, not on a later visit.
    if (ERROR_TAB[Object.keys(nextErrors)[0] ?? ''] !== 'flow') setShownErrorRevision(revision);
    if (nextErrors.flowStep) setOpenStepId(nextErrors.flowStep);
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
      flushFooter
      className={className}
      headerExtra={
        <Tabs
          label="Run settings"
          testId="panel-tab"
          value={tab}
          onChange={setTab}
          items={PANEL_TABS.map((item) => ({ ...item, alert: tabsWithErrors.has(item.value) }))}
        />
      }
      footer={
        <Button
          type="submit"
          form={FORM_ID}
          loading={submitting}
          size="block"
          data-testid="start-run"
        >
          {submitting ? 'Starting…' : `Start ${RUN_TYPE_LABELS[type].toLowerCase()} test`}
        </Button>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
        <fieldset disabled={submitting} className="m-0 min-w-0 border-0 p-0">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
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
                      data-testid="run-type"
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
                      data-testid="base-url"
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
                    onChange={(steps) => {
                      setFlowSteps(steps);
                      // An edit may fix the problem; it is checked again on the next start.
                      if (errors.flow) {
                        setErrors(
                          Object.fromEntries(
                            Object.entries(errors).filter(([key]) => !key.startsWith('flow')),
                          ),
                        );
                      }
                    }}
                    openId={openStepId}
                    onOpenChange={setOpenStepId}
                    errorStepId={errorStepId}
                    error={errors.flow}
                    scrollToError={submitCount !== shownErrorRevision}
                    onErrorShown={markErrorShown}
                    errorLabel={errors.flowStepLabel}
                  />
                </>
              )}

              {tab === 'shape' && (
                <>
                  <Suspense fallback={<Skeleton className="h-[164px] w-full" />}>
                    <LoadShapeChart stages={stages} mode={mode} />
                  </Suspense>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-fg">Stage targets count</span>
                    <SegmentedControl
                      label="Stage targets count"
                      testId="load-mode"
                      value={mode}
                      onChange={setMode}
                      options={LOAD_MODES.map((value) => ({
                        value,
                        label: LOAD_MODE_LABELS[value],
                      }))}
                    />
                  </div>
                  <Field
                    label="Stages"
                    htmlFor="stage-0-duration"
                    error={errors.stages}
                    errorTestId="stages-error"
                  >
                    <StagesEditor
                      stages={stages}
                      onChange={setStages}
                      targetLabel={TARGET_LABELS[mode]}
                    />
                  </Field>
                  {mode === 'rate' && (
                    <Field
                      label="Max virtual users"
                      htmlFor="max-virtual-users"
                      hint="k6 adds VUs up to this number to keep the rate. Past it, flow runs are dropped."
                      error={errors.maxVirtualUsers}
                      errorTestId="max-virtual-users-error"
                    >
                      <Input
                        id="max-virtual-users"
                        data-testid="max-virtual-users"
                        mono
                        type="number"
                        min={1}
                        step={1}
                        value={maxVirtualUsers}
                        onChange={(event) => setMaxVirtualUsers(Number(event.target.value))}
                        invalid={Boolean(errors.maxVirtualUsers)}
                      />
                    </Field>
                  )}
                  <CapacityHint
                    peakTarget={mode === 'rate' ? maxVirtualUsers : peakUsers(stages)}
                    peakSource={mode === 'rate' ? 'Max virtual users is' : 'Your stages go up to'}
                  />
                  <Note title="How the load shape works">
                    <p className="m-0">
                      A virtual user (VU) is one simulated user. It runs the steps in the Flow tab
                      in order, waits after each step (the step's own random wait, or the think
                      time), then starts again until the run ends. When a step fails, the VU waits,
                      skips the remaining steps and starts again.
                    </p>
                    <p className="m-0">
                      Stages run in order. During each stage, the number of VUs changes steadily to
                      the stage's target. For example, 30s → 20 VUs, then 1m → 20 VUs adds users for
                      30 seconds, then holds 20 users for 1 minute.
                    </p>
                    <p className="m-0">
                      Users counts concurrent users. Rate counts flow runs started per second, no
                      matter how slow the server gets: use it for a goal such as 50 sign-ins per
                      second. Each flow run sends one request per step.
                    </p>
                  </Note>
                </>
              )}

              {tab === 'limits' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Think time"
                      htmlFor="think-time"
                      hint="Seconds a user waits after each step with no wait of its own"
                      error={errors.thinkTime}
                    >
                      <Input
                        id="think-time"
                        data-testid="think-time"
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
                      hint="Percent of requests without the expected status"
                      error={errors.maxErrorRate}
                    >
                      <Input
                        id="max-error-rate"
                        data-testid="max-error-rate"
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
                            data-testid={`limit-${key}`}
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
                      <p role="alert" data-testid="latency-error" className="text-xs text-danger">
                        {errors.latency}
                      </p>
                    )}
                  </fieldset>
                  <Note title="What do p50, p90, p95 and p99 mean?">
                    <p className="m-0">{EXPLAIN.percentile}</p>
                    <p className="m-0">
                      p50 is the typical request. p99 is the line the slowest 1% of requests are
                      above. An average hides these slow requests, so the limits use percentiles.
                    </p>
                  </Note>
                  <Note title="When does a run fail?">
                    <p className="m-0">{EXPLAIN.failRule}</p>
                    <p className="m-0">{EXPLAIN.errorRate}</p>
                  </Note>
                </>
              )}
            </m.div>
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
      flushFooter
      className={className}
      headerExtra={
        <div className="flex gap-4 pb-2">
          {PANEL_TABS.map((item) => (
            <Skeleton key={item.value} className="h-5 w-16" />
          ))}
        </div>
      }
      footer={
        <Button loading disabled size="block">
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
