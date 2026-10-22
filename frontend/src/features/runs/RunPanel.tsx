// Left-hand control panel: build a run across three tabs (Setup, Flow, Limits), start it from the pinned footer.
import { AnimatePresence, m } from 'motion/react';
import { Suspense, lazy, useCallback, useEffect, useState, type FormEvent } from 'react';
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
import { useCopy, type Copy } from '../../i18n/useCopy.ts';
import { durationToSeconds, isValidTarget, peakTarget, runTypeVars } from './format.ts';
import { CapacityHint } from './CapacityHint.tsx';
import { StagesEditor } from './StagesEditor.tsx';
import { parseTarget, toStageRow, type StageRow } from './stages.ts';
import { FlowEditor } from './FlowEditor.tsx';
import { draftProblem, flowProblem, fromDraft, toDraft, type StepDraft } from './flow.ts';

type PanelTab = 'setup' | 'flow' | 'limits';

const PANEL_TABS: readonly PanelTab[] = ['setup', 'flow', 'limits'];

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

/** Setup errors in the order they appear on the tab, with the test id of their message. */
const SETUP_ERROR_TEST_IDS: Record<string, string> = {
  baseUrl: 'base-url-error',
  stages: 'stages-error',
  maxVirtualUsers: 'max-virtual-users-error',
};

// recharts is large; the preview loads after the panel is usable.
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
  type: RunType;
  onTypeChange: (type: RunType) => void;
  onSubmit: (input: CreateRunInput) => Promise<void>;
  submitting: boolean;
  className?: string;
}

/** True when both are URLs on the same scheme, host and port: http://Demo:8080/ is http://demo:8080. */
function sameOrigin(url: string, other: string | undefined): boolean {
  if (other === undefined || !URL.canParse(url.trim()) || !URL.canParse(other)) return false;
  return new URL(url.trim()).origin === new URL(other).origin;
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
  const { t, advanced, language } = useCopy();
  const [tab, setTab] = useState<PanelTab>('setup');
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
  const [gracePeriod, setGracePeriod] = useState(defaults.limits.gracePeriodSeconds);
  const [maxErrorPercent, setMaxErrorPercent] = useState(defaults.limits.maxErrorRate * 100);
  const [latency, setLatency] = useState(defaults.limits.latencyLimitsMs);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The input of the last start that found problems: a language switch shows them again in the
  // new language.
  const [checked, setChecked] = useState<{ input: CreateRunInput; steps: StepDraft[] }>();
  const [errorsLanguage, setErrorsLanguage] = useState(language);
  if (errorsLanguage !== language) {
    setErrorsLanguage(language);
    if (checked && Object.keys(errors).length > 0) {
      const again = validate(checked.input, checked.steps, t);
      // Keep only problems still on screen: edits since the start may have cleared some.
      setErrors(
        Object.fromEntries(
          Object.keys(errors)
            .filter((key) => again[key] !== undefined)
            .map((key) => [key, again[key]]),
        ),
      );
    }
  }
  // Test id of a Setup error to bring into view once the tab has animated in.
  const [setupErrorToShow, setSetupErrorToShow] = useState<string | undefined>();
  useEffect(() => {
    if (!setupErrorToShow || tab !== 'setup') return;
    let frame = 0;
    let tries = 0;
    const show = () => {
      const element = document.querySelector(`[data-testid="${setupErrorToShow}"]`);
      // The tab content mounts after the exit animation; look again for up to about a second.
      if (!element && tries++ < 60) {
        frame = requestAnimationFrame(show);
        return;
      }
      element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      setSetupErrorToShow(undefined);
    };
    frame = requestAnimationFrame(show);
    return () => cancelAnimationFrame(frame);
  }, [setupErrorToShow, tab]);

  // The type can also change from the Runs tabs; the stages must follow either way.
  const [stagesType, setStagesType] = useState(type);
  if (stagesType !== type) {
    setStagesType(type);
    setStages(defaults.stages[type].map(toStageRow));
    // The new stages are VU targets; keeping Rate would reread them as runs per second.
    setMode('users');
  }

  // Basic hides these settings, but shows them again while they hold a problem to fix.
  const showGrace = advanced || Boolean(errors.gracePeriod);
  const allLimits = advanced || Boolean(errors.latency);

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
      gracePeriodSeconds: gracePeriod,
      maxErrorRate: maxErrorPercent / 100,
      latencyLimitsMs: latency,
    };
    const nextErrors = validate(input, flowSteps, t);
    setErrors(nextErrors);
    setChecked({ input, steps: flowSteps });
    // The first tab, in tab order, that has an error.
    const errorTabs = new Set(Object.keys(nextErrors).map((key) => ERROR_TAB[key]));
    const firstErrorTab = PANEL_TABS.find((value) => errorTabs.has(value));
    const revision = submitCount + 1;
    setSubmitCount(revision);
    // Scroll to a flow problem only when this submit opens the Flow tab, not on a later visit.
    if (firstErrorTab !== 'flow') setShownErrorRevision(revision);
    if (nextErrors.flowStep) setOpenStepId(nextErrors.flowStep);
    if (Object.keys(nextErrors).length > 0) {
      // An error with no tab of its own still stops the run; Setup is the first tab.
      setTab(firstErrorTab ?? 'setup');
      const setupKey = Object.keys(SETUP_ERROR_TEST_IDS).find((key) => nextErrors[key]);
      if ((firstErrorTab ?? 'setup') === 'setup' && setupKey) {
        setSetupErrorToShow(SETUP_ERROR_TEST_IDS[setupKey]);
      }
      return;
    }
    await onSubmit(input);
  };

  return (
    <Card
      title={t('panel.title')}
      description={t(`runTypeDescription.${type}`)}
      scrollBody
      flushFooter
      className={className}
      headerExtra={
        <Tabs
          label={t('panel.tabsLabel')}
          testId="panel-tab"
          value={tab}
          onChange={(next) => {
            setTab(next);
            // A scroll still waiting for Setup to appear no longer applies on another tab.
            setSetupErrorToShow(undefined);
          }}
          items={PANEL_TABS.map((value) => ({
            value,
            label: t(`panel.tabs.${value}`),
            alert: tabsWithErrors.has(value),
          }))}
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
          {submitting ? t('panel.starting') : t('panel.start', runTypeVars(type, t))}
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
              {tab === 'setup' && (
                <>
                  <Field label={t('panel.testType')} htmlFor="run-type">
                    <Select
                      id="run-type"
                      data-testid="run-type"
                      value={type}
                      onChange={onTypeChange}
                      options={RUN_TYPES.map((value) => ({
                        value,
                        label: t(`runType.${value}`),
                      }))}
                    />
                  </Field>
                  <Field
                    label={t('panel.baseUrl')}
                    htmlFor="base-url"
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
                  <h3 className="m-0 border-t border-line pt-4 text-sm font-semibold text-fg">
                    {t('panel.loadShape')}
                  </h3>
                  <Suspense fallback={<Skeleton className="h-[164px] w-full" />}>
                    <LoadShapeChart stages={stages} mode={mode} />
                  </Suspense>
                  {/* Basic keeps to users; the switch stays visible while a rate run is set up. */}
                  {(advanced || mode === 'rate') && (
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
                  )}
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
                  <Note title={t('panel.shapeNoteTitle')}>
                    <p className="m-0">{t('panel.shapeNote1')}</p>
                    <p className="m-0">{t('panel.shapeNote2')}</p>
                    {advanced && <p className="m-0">{t('panel.shapeNote3')}</p>}
                  </Note>
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
                </>
              )}

              {tab === 'limits' && (
                <>
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
                  {showGrace && (
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
                  )}
                  <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                    <legend className="mb-1.5 text-sm font-medium text-fg">
                      {allLimits ? t('panel.latencyLimits') : t('panel.maxResponseTime')}
                    </legend>
                    <div
                      className={
                        allLimits ? 'grid grid-cols-2 gap-2 sm:grid-cols-4' : 'flex flex-col gap-1'
                      }
                    >
                      {/* Basic sets one limit: p95. The others keep their values. */}
                      {(allLimits ? PERCENTILES : (['p95'] as const)).map((key) => (
                        <div key={key} className="flex flex-col gap-1">
                          {allLimits && (
                            <label htmlFor={`limit-${key}`} className="text-xs text-fg-muted">
                              {key}
                            </label>
                          )}
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
                    {!allLimits && (
                      <p className="m-0 text-xs text-fg-muted">{t('panel.maxResponseTimeHint')}</p>
                    )}
                    {errors.latency && (
                      <p role="alert" data-testid="latency-error" className="text-xs text-danger">
                        {errors.latency}
                      </p>
                    )}
                  </fieldset>
                  {advanced && (
                    <Note title={t('panel.percentileNoteTitle')}>
                      <p className="m-0">{t('explain.percentile')}</p>
                      <p className="m-0">{t('panel.percentileNote2')}</p>
                    </Note>
                  )}
                  <Note title={t('panel.failNoteTitle')}>
                    <p className="m-0">{t('explain.failRule')}</p>
                    {advanced && <p className="m-0">{t('explain.errorRate')}</p>}
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
  const { t } = useCopy();
  return (
    <Card
      title={t('panel.title')}
      description={<Skeleton className="mt-1 h-4 w-56" />}
      scrollBody
      flushFooter
      className={className}
      headerExtra={
        <div className="flex gap-4 pb-2">
          {PANEL_TABS.map((value) => (
            <Skeleton key={value} className="h-5 w-16" />
          ))}
        </div>
      }
      footer={
        <Button loading disabled size="block">
          {t('panel.loading')}
        </Button>
      }
      aria-busy="true"
    >
      <div className="flex flex-col gap-5">
        <FieldSkeleton />
        <FieldSkeleton />
        {/* The Setup tab opens with the load shape chart and stages below the fields. */}
        <Skeleton className="h-[164px] w-full" />
        <FieldSkeleton />
      </div>
    </Card>
  );
}
