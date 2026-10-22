// The run form: one scrolling card with three sections (Setup, Steps, Pass rules) and Start
// pinned at the bottom. Opens with the backend defaults, or filled from a stored run.
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  LOAD_MODES,
  RUN_TYPES,
  type CreateRunInput,
  type LoadMode,
  type Run,
  type RunDefaults,
  type RunType,
} from '../../api/runs.ts';
import {
  Button,
  Card,
  Field,
  FieldSkeleton,
  Input,
  SegmentedControl,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui/index.ts';
import { LearnMore } from '../learn/LearnMore.tsx';
import { useCopy, type Copy } from '../../i18n/useCopy.ts';
import { durationToSeconds, formatTime, isValidTarget, peakTarget, runTypeVars } from './format.ts';
import { CapacityHint } from './CapacityHint.tsx';
import { StagesEditor } from './StagesEditor.tsx';
import { parseTarget, toStageRow, type StageRow } from './stages.ts';
import { FlowEditor } from './FlowEditor.tsx';
import { draftProblem, flowProblem, fromDraft, toDraft, type StepDraft } from './flow.ts';

type PanelTab = 'setup' | 'flow' | 'limits';

const PANEL_TABS: readonly PanelTab[] = ['setup', 'flow', 'limits'];

/** The tab each form problem lives on; a refused start opens the first tab with a problem. */
const ERROR_TAB: Record<string, PanelTab> = {
  baseUrl: 'setup',
  flow: 'flow',
  flowStep: 'flow',
  flowStepLabel: 'flow',
  stages: 'setup',
  maxVirtualUsers: 'setup',
  thinkTime: 'limits',
  gracePeriod: 'limits',
  maxErrorRate: 'limits',
  latency: 'limits',
};

const PERCENTILES = ['p50', 'p90', 'p95', 'p99'] as const;

// recharts is large; the preview loads after the form is usable.
const LoadShapeChart = lazy(() => import('./LoadShapeChart.tsx'));
// Mirrors the backend limits so the user sees which field to fix.
const MAX_RUN_SECONDS = 3600;
const MAX_STAGES = 20;
const MAX_GRACE_PERIOD_SECONDS = 300;
const FORM_ID = 'run-form';

function validate(input: CreateRunInput, steps: StepDraft[], t: Copy): Record<string, string> {
  const errors: Record<string, string> = {};
  const baseUrl = URL.canParse(input.baseUrl) ? new URL(input.baseUrl) : undefined;
  if (!baseUrl || !/^https?:$/.test(baseUrl.protocol)) {
    errors.baseUrl = t('validation.baseUrl');
  } else if (baseUrl.username !== '' || baseUrl.password !== '') {
    // Every reader of the runs list would see them; the backend refuses them too.
    errors.baseUrl = t('validation.credentials');
  }
  const problem = draftProblem(steps) ?? flowProblem(input.flow);
  if (problem) errors.flow = problem.message;
  // The step's id, not its index, so the mark stays on it when steps are moved or removed.
  const problemStepId = problem?.step === undefined ? undefined : steps[problem.step]?.id;
  if (problemStepId && problem?.step !== undefined) {
    errors.flowStep = problemStepId;
    errors.flowStepLabel = t('validation.stepLabel', {
      number: problem.step + 1,
      name: steps[problem.step]?.name.trim() || t('validation.untitled'),
    });
  }
  const seconds = input.stages.map((stage) => durationToSeconds(stage.duration));
  if (seconds.some((value) => !Number.isFinite(value))) {
    errors.stages = t('validation.durations');
  } else if (input.stages.some((stage) => !isValidTarget(stage.target, input.mode))) {
    errors.stages = t(input.mode === 'rate' ? 'validation.targetRate' : 'validation.targetUsers');
  } else if (input.stages.length > MAX_STAGES) {
    errors.stages = t('validation.maxStages', { max: MAX_STAGES });
  } else if (seconds.reduce((total, value) => total + value, 0) > MAX_RUN_SECONDS) {
    errors.stages = t('validation.maxDuration');
  }
  if (
    input.maxVirtualUsers !== undefined &&
    (!Number.isSafeInteger(input.maxVirtualUsers) || input.maxVirtualUsers < 1)
  ) {
    errors.maxVirtualUsers = t('validation.maxUsers');
  }
  if (!Number.isFinite(input.thinkTimeSeconds) || input.thinkTimeSeconds < 0) {
    errors.thinkTime = t('validation.thinkTime');
  }
  if (
    !Number.isSafeInteger(input.gracePeriodSeconds) ||
    input.gracePeriodSeconds < 0 ||
    input.gracePeriodSeconds > MAX_GRACE_PERIOD_SECONDS
  ) {
    errors.gracePeriod = t('validation.gracePeriod', { max: MAX_GRACE_PERIOD_SECONDS });
  }
  if (!Number.isFinite(input.maxErrorRate) || input.maxErrorRate < 0 || input.maxErrorRate > 1) {
    errors.maxErrorRate = t('validation.maxErrorRate');
  }
  if (
    PERCENTILES.some(
      (key) => !Number.isFinite(input.latencyLimitsMs[key]) || input.latencyLimitsMs[key] <= 0,
    )
  ) {
    errors.latency = t('validation.latency');
  }
  return errors;
}

export interface RunPanelProps {
  defaults?: RunDefaults;
  /** A stored run whose settings fill the form; without it, the backend defaults do. */
  initial?: Run;
  onSubmit: (input: CreateRunInput) => Promise<void>;
  submitting: boolean;
  /** Rendered in the card's header, e.g. a close button when the form is in a drawer. */
  actions?: ReactNode;
  className?: string;
}

/** True when both are URLs on the same scheme, host and port: http://Demo:8080/ is http://demo:8080. */
function sameOrigin(url: string, other: string | undefined): boolean {
  if (other === undefined || !URL.canParse(url.trim()) || !URL.canParse(other)) return false;
  return new URL(url.trim()).origin === new URL(other).origin;
}

export function RunPanel({ defaults, ...props }: RunPanelProps) {
  if (!defaults) return <RunPanelSkeleton className={props.className} actions={props.actions} />;
  return <RunPanelForm defaults={defaults} {...props} />;
}

function RunPanelForm({
  defaults,
  initial,
  onSubmit,
  submitting,
  actions,
  className,
}: RunPanelProps & { defaults: RunDefaults }) {
  const { t, language } = useCopy();
  const [tab, setTab] = useState<PanelTab>('setup');
  const [type, setType] = useState<RunType>(initial?.type ?? 'load');
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? defaults.baseUrl);
  const [stages, setStages] = useState<StageRow[]>(() =>
    (initial?.stages ?? defaults.stages[type]).map(toStageRow),
  );
  const [mode, setMode] = useState<LoadMode>(initial?.mode ?? 'users');
  const [maxVirtualUsers, setMaxVirtualUsers] = useState(
    initial?.maxVirtualUsers ?? defaults.maxVirtualUsers,
  );
  const [flowSteps, setFlowSteps] = useState<StepDraft[]>(() =>
    (initial?.flow ?? defaults.flow).map(toDraft),
  );
  // Every step starts folded: the list reads as a summary until one is opened.
  const [openStepId, setOpenStepId] = useState<string | undefined>();
  const [submitCount, setSubmitCount] = useState(0);
  // The submit whose flow problem was already scrolled into view.
  const [shownErrorRevision, setShownErrorRevision] = useState(0);
  const markErrorShown = useCallback(() => setShownErrorRevision(submitCount), [submitCount]);
  const limits = initial?.limits ?? defaults.limits;
  const [thinkTime, setThinkTime] = useState(limits.thinkTimeSeconds);
  const [gracePeriod, setGracePeriod] = useState(limits.gracePeriodSeconds);
  // Rounded: 0.07 * 100 is 7.000000000000001 in floating point.
  const [maxErrorPercent, setMaxErrorPercent] = useState(
    Math.round(limits.maxErrorRate * 10000) / 100,
  );
  const [latency, setLatency] = useState(limits.latencyLimitsMs);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const currentInput = (): CreateRunInput => ({
    type,
    baseUrl: baseUrl.trim(),
    mode,
    ...(mode === 'rate' && { maxVirtualUsers }),
    stages: stages.map(({ duration, target }) => ({ duration, target })),
    flow: flowSteps.map(fromDraft),
    thinkTimeSeconds: thinkTime,
    gracePeriodSeconds: gracePeriod,
    maxErrorRate: maxErrorPercent / 100,
    latencyLimitsMs: latency,
  });
  // Problems on screen are text: a language switch checks the form again and shows the same
  // fields' problems in the new language.
  const [errorsLanguage, setErrorsLanguage] = useState(language);
  if (errorsLanguage !== language) {
    setErrorsLanguage(language);
    if (Object.keys(errors).length > 0) {
      const again = validate(currentInput(), flowSteps, t);
      setErrors(
        Object.fromEntries(
          Object.keys(errors)
            .filter((key) => again[key] !== undefined)
            .map((key) => [key, again[key]]),
        ),
      );
    }
  }
  // After a refused start, bring the first problem into view (the flow editor scrolls its own).
  const [errorToShow, setErrorToShow] = useState(0);
  useEffect(() => {
    if (errorToShow === 0) return;
    document
      .querySelector(`#${FORM_ID} [role="alert"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setErrorToShow(0);
  }, [errorToShow]);

  const changeType = (next: RunType) => {
    setType(next);
    // Each type has its own default stages, as VU targets.
    setStages(defaults.stages[next].map(toStageRow));
    setMode('users');
    setErrors(({ stages: _stale, ...rest }) => rest);
  };

  // Edits clear flow errors, so the marked step always still exists.
  const errorStepId = errors.flowStep;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const input = currentInput();
    const nextErrors = validate(input, flowSteps, t);
    setErrors(nextErrors);
    const revision = submitCount + 1;
    setSubmitCount(revision);
    if (nextErrors.flowStep) setOpenStepId(nextErrors.flowStep);
    if (Object.keys(nextErrors).length > 0) {
      const errorTabs = new Set(Object.keys(nextErrors).map((key) => ERROR_TAB[key]));
      setTab(PANEL_TABS.find((value) => errorTabs.has(value)) ?? 'setup');
      // The first problem on the form comes into view. Only a flow problem on its own scrolls
      // through the editor (to the step); any other problem sits above it in the form.
      const onlyFlow = Object.keys(nextErrors).every((key) => key.startsWith('flow'));
      if (onlyFlow) setShownErrorRevision(revision - 1);
      else {
        setShownErrorRevision(revision);
        setErrorToShow(revision);
      }
      return;
    }
    await onSubmit(input);
  };

  return (
    <Card
      title={t('panel.title')}
      description={
        initial
          ? t('panel.filledFrom', {
              ...runTypeVars(initial.type, t),
              time: formatTime(initial.createdAt, language),
            })
          : t(`runTypeDescription.${type}`)
      }
      actions={actions}
      headerExtra={
        <Tabs
          label={t('panel.tabsLabel')}
          testId="panel-tab"
          value={tab}
          onChange={setTab}
          items={PANEL_TABS.map((value) => ({
            value,
            label: t(`panel.sections.${value}`),
            alert: Object.keys(errors).some((key) => ERROR_TAB[key] === value),
          }))}
        />
      }
      scrollBody
      flushFooter
      className={className}
      data-testid="run-form-card"
      footer={
        <Button
          type="submit"
          form={FORM_ID}
          loading={submitting}
          size="block"
          data-testid="start-run"
        >
          {submitting ? t('panel.starting') : t('panel.start', runTypeVars(type, t))}
        </Button>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
        <fieldset disabled={submitting} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
          <div
            className={tab === 'setup' ? 'flex flex-col gap-5' : 'hidden'}
            data-testid="panel-section-setup"
          >
            <div className="flex items-start gap-3">
              <Field label={t('panel.testType')} htmlFor="run-type" className="w-32 shrink-0">
                <Select
                  id="run-type"
                  data-testid="run-type"
                  value={type}
                  onChange={changeType}
                  options={RUN_TYPES.map((value) => ({
                    value,
                    label: t(`runType.${value}`),
                  }))}
                />
              </Field>
              <Field
                label={t('panel.baseUrl')}
                htmlFor="base-url"
                className="min-w-0 flex-1"
                hint={t('panel.baseUrlHint')}
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
            </div>
            <div className="flex items-center justify-between gap-2">
              <h4 className="m-0 text-sm font-semibold text-fg">{t('panel.loadShape')}</h4>
              <LearnMore
                testId="learn-shape"
                title={t('panel.shapeNoteTitle')}
                paragraphs={[t('panel.shapeNote1'), t('panel.shapeNote2'), t('panel.shapeNote3')]}
              />
            </div>
            <Suspense fallback={<Skeleton className="h-[164px] w-full" />}>
              <LoadShapeChart stages={stages} mode={mode} />
            </Suspense>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fg">{t('panel.targetsCount')}</span>
              <SegmentedControl
                label={t('panel.targetsCount')}
                testId="load-mode"
                value={mode}
                onChange={(next) => {
                  setMode(next);
                  // An error for the other mode no longer applies; the next start checks again.
                  setErrors(({ stages: _stale, ...rest }) => rest);
                  // The same text can be valid in one mode and not the other ("0,5").
                  setStages(
                    stages.map((stage) => ({
                      ...stage,
                      target: parseTarget(stage.targetText, next === 'rate'),
                    })),
                  );
                }}
                options={LOAD_MODES.map((value) => ({
                  value,
                  label: t(`panel.modes.${value}`),
                }))}
              />
              <p className="m-0 text-xs text-fg-muted" data-testid="load-mode-hint">
                {t(`panel.modeHint.${mode}`)}
              </p>
            </div>
            <Field
              label={t('panel.stages')}
              htmlFor="stage-0-duration"
              error={errors.stages}
              errorTestId="stages-error"
            >
              <StagesEditor
                stages={stages}
                onChange={setStages}
                targetLabel={t(`panel.target.${mode}`)}
                decimals={mode === 'rate'}
              />
            </Field>
            {mode === 'rate' && (
              <Field
                label={t('panel.maxUsers')}
                htmlFor="max-virtual-users"
                hint={t('panel.maxUsersHint')}
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
              peakTarget={mode === 'rate' ? maxVirtualUsers : peakTarget(stages)}
              rate={mode === 'rate'}
            />
          </div>
          <div
            className={tab === 'flow' ? 'flex flex-col gap-5' : 'hidden'}
            data-testid="panel-section-flow"
          >
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
              hasSoapExample={Boolean(defaults.soapExampleBaseUrl)}
              onExampleLoad={(example) => {
                const { soapExampleBaseUrl } = defaults;
                // The SOAP example needs its demo app. QuickPizza keeps a typed URL, but
                // not the SOAP demo's, which cannot serve it.
                const target =
                  example === 'soap'
                    ? soapExampleBaseUrl
                    : sameOrigin(baseUrl, soapExampleBaseUrl)
                      ? defaults.baseUrl
                      : undefined;
                if (target === undefined) return;
                setBaseUrl(target);
                // The example's URL is valid: drop an earlier base URL problem.
                setErrors(({ baseUrl: _fixed, ...rest }) => rest);
              }}
              errorStepId={errorStepId}
              error={errors.flow}
              scrollToError={submitCount !== shownErrorRevision}
              onErrorShown={markErrorShown}
              errorLabel={errors.flowStepLabel}
            />
          </div>
          <div
            className={tab === 'limits' ? 'flex flex-col gap-5' : 'hidden'}
            data-testid="panel-section-limits"
          >
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t('panel.thinkTime')}
                htmlFor="think-time"
                hint={t('panel.thinkTimeHint')}
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
                label={t('panel.maxErrorRate')}
                htmlFor="max-error-rate"
                hint={t('panel.maxErrorRateHint')}
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
            <Field
              label={t('panel.gracePeriod')}
              htmlFor="grace-period"
              hint={t('panel.gracePeriodHint')}
              error={errors.gracePeriod}
            >
              <Input
                id="grace-period"
                data-testid="grace-period"
                mono
                type="number"
                min={0}
                max={MAX_GRACE_PERIOD_SECONDS}
                step={1}
                value={Number.isNaN(gracePeriod) ? '' : gracePeriod}
                // An empty field is not 0 seconds: NaN fails validation.
                onChange={(event) =>
                  setGracePeriod(
                    event.target.value === '' ? Number.NaN : Number(event.target.value),
                  )
                }
                invalid={Boolean(errors.gracePeriod)}
              />
            </Field>
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className="mb-1.5 text-sm font-medium text-fg">
                {t('panel.latencyLimits')}
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
            <LearnMore
              testId="learn-rules"
              title={t('panel.rulesNoteTitle')}
              paragraphs={[
                t('explain.failRule'),
                t('explain.percentile'),
                t('panel.percentileNote2'),
                t('explain.errorRate'),
                t('explain.failChecks'),
                ...(mode === 'rate' ? [t('explain.failRate')] : []),
              ]}
            />
          </div>
        </fieldset>
      </form>
    </Card>
  );
}

function RunPanelSkeleton({ className, actions }: { className?: string; actions?: ReactNode }) {
  const { t } = useCopy();
  return (
    <Card
      title={t('panel.title')}
      description={<Skeleton className="mt-1 h-4 w-56" />}
      actions={actions}
      scrollBody
      flushFooter
      className={className}
      footer={
        <Button loading disabled size="block">
          {t('panel.loading')}
        </Button>
      }
      aria-busy="true"
    >
      <div className="flex flex-col gap-5">
        <Skeleton className="h-5 w-16" />
        <div className="flex gap-3">
          <FieldSkeleton className="w-32 shrink-0" />
          <FieldSkeleton className="min-w-0 flex-1" />
        </div>
        {/* The form opens with the load shape chart and stages below the fields. */}
        <Skeleton className="h-[164px] w-full" />
        <FieldSkeleton />
      </div>
    </Card>
  );
}
