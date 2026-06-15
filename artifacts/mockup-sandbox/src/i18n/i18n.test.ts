import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  detectInitialLocale,
  formatDateTimeForLocale,
  i18nRiskLevelKey,
  i18nStatusKey,
  normalizeLocale,
  persistLocale,
  readBrowserLocale,
} from "./locale";
import { enUS } from "./locales/en-US";
import { zhCN } from "./locales/zh-CN";

const portalComponentSource = readFileSync(
  new URL(
    "../components/mockups/ai-os/AgentPortalInterface.tsx",
    import.meta.url,
  ),
  "utf8",
);
const operatorComponentSources = [
  "../components/operator/OperatorBackstage.tsx",
  "../components/operator/ManifestViewer.tsx",
  "../components/operator/ManifestEditor.tsx",
  "../components/operator/WorkbenchFileViewer.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
const operatorComponentSource = operatorComponentSources.join("\n");
const agentFirstComponentSources = [
  "../components/mockups/ai-os/AgentFirstInterface.tsx",
  "../components/mockups/ai-os/_components/AgentCatalog.tsx",
  "../components/mockups/ai-os/_components/AgentDetail.tsx",
  "../components/mockups/ai-os/_components/AgentManifestWizard.tsx",
  "../components/mockups/ai-os/_components/ArtifactInspector.tsx",
  "../components/mockups/ai-os/_components/RunInspector.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
const agentFirstComponentSource = agentFirstComponentSources.join("\n");

test("normalizes supported English and Chinese locale inputs", () => {
  assert.equal(DEFAULT_LOCALE, "en-US");
  assert.deepEqual(SUPPORTED_LOCALES, ["en-US", "zh-CN"]);
  assert.equal(normalizeLocale("en"), "en-US");
  assert.equal(normalizeLocale("en-US"), "en-US");
  assert.equal(normalizeLocale("zh"), "zh-CN");
  assert.equal(normalizeLocale("zh-CN"), "zh-CN");
  assert.equal(normalizeLocale("fr-FR"), null);
});

test("detects initial locale from URL, storage, then the default locale", () => {
  assert.equal(
    detectInitialLocale({
      search: "?lang=zh-CN",
      storedLocale: "en-US",
      navigatorLanguage: "en-US",
    }),
    "zh-CN",
  );
  assert.equal(
    detectInitialLocale({
      search: "",
      storedLocale: "zh",
      navigatorLanguage: "en-US",
    }),
    "zh-CN",
  );
  assert.equal(
    detectInitialLocale({
      search: "",
      storedLocale: null,
      navigatorLanguage: "zh-Hans-CN",
    }),
    "en-US",
  );
  assert.equal(
    detectInitialLocale({
      search: "",
      storedLocale: null,
      navigatorLanguage: "fr-FR",
    }),
    "en-US",
  );
});

test("formats date-time values with the selected locale", () => {
  const isoTime = "2026-06-15T12:30:00.000Z";
  assert.equal(
    formatDateTimeForLocale(isoTime, "en-US"),
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoTime)),
  );
  assert.equal(
    formatDateTimeForLocale(isoTime, "zh-CN"),
    new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoTime)),
  );
  assert.equal(formatDateTimeForLocale("not-a-date", "zh-CN"), "not-a-date");
});

test("ships matching mission and approval translation keys", () => {
  assert.equal(enUS.translation.language.switchTo, "\u4e2d\u6587");
  assert.equal(zhCN.translation.language.switchTo, "English");
  assert.equal(enUS.translation.missionCenter.title, "Mission Control");
  assert.equal(zhCN.translation.missionCenter.title, "Mission Control");
  assert.equal(enUS.translation.approvalInbox.updatedTitle, "Approval updated");
  assert.equal(
    zhCN.translation.approvalInbox.updatedTitle,
    "\u5ba1\u6279\u5df2\u66f4\u65b0",
  );
});

test("locale resources include all visible mission and approval labels", () => {
  const requiredKeys = [
    "missionCenter.tabMissionCenter",
    "missionCenter.tabBackstage",
    "missionCenter.steps",
    "common.riskLevel.low",
    "common.riskLevel.medium",
    "common.riskLevel.high",
    "common.status.pending",
    "common.status.waiting_approval",
    "common.status.running",
    "common.status.blocked",
    "common.status.succeeded",
    "common.status.failed",
    "common.status.cancelled",
    "common.status.approved",
    "common.status.rejected",
    "common.status.expired",
    "missionCenter.missionApiUnavailable",
    "missionCenter.revisionUpdateFailed",
    "missionCenter.approveFailed",
    "missionCenter.executeFailed",
    "planStep.dependsOn",
    "planStep.approval",
    "approvalInbox.title",
    "approvalCard.runtimeStep",
    "approvalCard.mission",
    "approvalCard.revision",
    "approvalCard.moduleRun",
    "approvalCard.requested",
    "approvalCard.approve",
    "approvalCard.reject",
    "executionBoard.title",
  ];

  assert.equal(i18nRiskLevelKey("high"), "common.riskLevel.high");
  assert.equal(
    i18nStatusKey("waiting_approval"),
    "common.status.waiting_approval",
  );

  for (const key of requiredKeys) {
    assert.equal(
      typeof lookup(enUS.translation, key),
      "string",
      `en-US missing ${key}`,
    );
    assert.equal(
      typeof lookup(zhCN.translation, key),
      "string",
      `zh-CN missing ${key}`,
    );
  }
});

test("locale resources include visible end-user portal labels", () => {
  const requiredKeys = [
    "portal.brand",
    "portal.nav.chat",
    "portal.nav.steps",
    "portal.nav.data",
    "portal.nav.sources",
    "portal.nav.result",
    "portal.topbar.surface",
    "portal.topbar.title",
    "portal.topbar.description",
    "portal.topbar.lastSync",
    "portal.topbar.configureAccess",
    "portal.topbar.openAdmin",
    "portal.runState.local",
    "portal.runState.submitting",
    "portal.runState.refreshing",
    "portal.runState.saved",
    "portal.runState.offline",
    "portal.runState.failed",
    "portal.autoRefresh.idle",
    "portal.autoRefresh.off",
    "portal.autoRefresh.active",
    "portal.autoRefresh.paused",
    "portal.autoRefresh.on",
    "portal.accessState.idle",
    "portal.accessState.checking",
    "portal.accessState.authorized",
    "portal.accessState.missing_token",
    "portal.accessState.invalid_token",
    "portal.accessState.not_published",
    "portal.accessState.offline",
    "portal.accessState.failed",
    "portal.status.complete",
    "portal.status.running",
    "portal.status.waiting",
    "portal.status.blocked",
    "portal.composer.placeholder",
    "portal.composer.send",
    "portal.composer.status.waitingForInput",
    "portal.sections.chat.title",
    "portal.sections.chat.description",
    "portal.sections.steps.title",
    "portal.sections.steps.description",
    "portal.sections.data.title",
    "portal.sections.data.description",
    "portal.sections.sources.title",
    "portal.sections.sources.description",
    "portal.sections.result.title",
    "portal.sections.result.description",
    "portal.empty.loadingDetails",
    "portal.empty.noRecords",
    "portal.empty.noSources",
    "portal.empty.noResults",
    "portal.empty.noInteraction",
    "portal.actions.inspect",
    "portal.actions.viewDetails",
    "portal.actions.viewEvidence",
    "portal.actions.viewResult",
    "portal.actions.refresh",
    "portal.actions.autoRefresh",
    "portal.actions.pauseAutoRefresh",
    "portal.actions.retry",
    "portal.interaction.kind.question",
    "portal.interaction.kind.approval",
    "portal.interaction.kind.data_request",
    "portal.interaction.kind.blocked",
    "portal.interaction.status.waiting_for_user",
    "portal.interaction.status.waiting_for_approval",
    "portal.interaction.status.waiting_for_data",
    "portal.interaction.status.blocked",
    "portal.interaction.status.resumable",
    "portal.interaction.status.resumed",
    "portal.interaction.feedbackLabel",
    "portal.interaction.feedbackPlaceholder",
    "portal.interaction.submit",
    "portal.interaction.resume",
    "portal.interaction.submitting",
    "portal.interaction.succeeded",
    "portal.interaction.failed",
    "portal.detailDrawer.title",
    "portal.detailDrawer.runEvents",
    "portal.detailDrawer.artifacts",
    "portal.sourceDrawer.title",
    "portal.sourceDrawer.evidence",
    "portal.resultDrawer.title",
    "portal.resultDrawer.details",
    "portal.context.title",
    "portal.context.currentStep",
    "portal.context.readiness",
    "portal.context.access",
    "portal.context.admin",
    "portal.context.adminDescription",
    "portal.demo.messages.userMeta",
    "portal.demo.messages.agentMeta",
    "portal.demo.steps.listen.label",
    "portal.demo.steps.listen.summary",
    "portal.demo.steps.listen.dataCount",
    "portal.demo.steps.convert.label",
    "portal.demo.steps.convert.summary",
    "portal.demo.steps.convert.dataCount",
    "portal.demo.steps.index.label",
    "portal.demo.steps.index.summary",
    "portal.demo.steps.index.dataCount",
    "portal.demo.steps.generate.label",
    "portal.demo.steps.generate.summary",
    "portal.demo.steps.generate.dataCount",
    "portal.demo.data.snapshot.kind",
    "portal.demo.sources.watchedUrl.type",
    "portal.demo.results.agentConfig.status",
    "portal.demo.readiness.ragIndex.label",
    "portal.demo.readiness.ragIndex.value",
  ];

  for (const key of requiredKeys) {
    assert.equal(
      typeof lookup(enUS.translation, key),
      "string",
      `en-US missing ${key}`,
    );
    assert.equal(
      typeof lookup(zhCN.translation, key),
      "string",
      `zh-CN missing ${key}`,
    );
  }
});

test("end-user portal component uses portal-owned translation keys", () => {
  assert.match(portalComponentSource, /portal\.topbar\.openAdmin/);
  assert.doesNotMatch(portalComponentSource, /topbar\.adminConsole/);
  assert.match(
    portalComponentSource,
    /portal\.demo\.sources\.watchedUrl\.label/,
  );
  assert.doesNotMatch(
    portalComponentSource,
    /label:\s*"docs\.example\.com\/start"/,
  );
});

test("end-user portal component translation keys resolve in both locale resources", () => {
  const literalKeys = Array.from(
    portalComponentSource.matchAll(/["'`]((?:portal)\.[A-Za-z0-9_.-]+)["'`]/g),
    (match) => match[1],
  ).filter((key) => !key.endsWith("."));

  for (const key of new Set(literalKeys)) {
    assert.equal(
      typeof lookup(enUS.translation, key),
      "string",
      `en-US missing ${key}`,
    );
    assert.equal(
      typeof lookup(zhCN.translation, key),
      "string",
      `zh-CN missing ${key}`,
    );
  }
});

test("end-user portal dynamic translation key families resolve in both locale resources", () => {
  const moduleIds = ["web_listening", "doc_to_md", "md_to_rag", "rag_to_agent"];
  const portalStatuses = ["complete", "running", "waiting", "blocked"];
  const runStates = [
    "local",
    "submitting",
    "refreshing",
    "saved",
    "offline",
    "failed",
  ];
  const accessStates = [
    "idle",
    "checking",
    "authorized",
    "missing_token",
    "invalid_token",
    "not_published",
    "offline",
    "failed",
  ];
  const interactionKinds = ["question", "approval", "data_request", "blocked"];
  const interactionStatuses = [
    "waiting_for_user",
    "waiting_for_approval",
    "waiting_for_data",
    "blocked",
    "resumable",
    "resumed",
  ];
  const syncSources = ["submit", "manual", "auto"];
  const resultKinds = ["agent_config", "memory", "source_package", "handoff"];
  const eventSeverities = ["info", "warning", "error"];
  const agentRunStatuses = [
    "planned",
    "missing_key",
    "needs_approval",
    "failed",
  ];
  const connectionStatuses = ["configured", "missing_key", "offline"];

  const requiredKeys = [
    ...moduleIds.flatMap((moduleId) => [
      `portal.modules.${moduleId}.label`,
      `portal.modules.${moduleId}.adminModule`,
      `portal.modules.${moduleId}.fallbackSummary`,
      `portal.modules.${moduleId}.fallbackData`,
    ]),
    ...portalStatuses.map((status) => `portal.status.${status}`),
    ...runStates.map((state) => `portal.runState.${state}`),
    ...accessStates.map((state) => `portal.accessState.${state}`),
    ...interactionKinds.map((kind) => `portal.interaction.kind.${kind}`),
    ...interactionStatuses.map(
      (status) => `portal.interaction.status.${status}`,
    ),
    ...syncSources.map((source) => `portal.syncSource.${source}`),
    ...resultKinds.map((kind) => `portal.resultKind.${kind}`),
    ...eventSeverities.map((severity) => `portal.eventSeverity.${severity}`),
    ...agentRunStatuses.map((status) => `portal.agentRunStatus.${status}`),
    ...connectionStatuses.map((status) => `portal.connectionStatus.${status}`),
  ];

  for (const key of requiredKeys) {
    assert.equal(
      typeof lookup(enUS.translation, key),
      "string",
      `en-US missing ${key}`,
    );
    assert.equal(
      typeof lookup(zhCN.translation, key),
      "string",
      `zh-CN missing ${key}`,
    );
  }
});

test("end-user portal locale resources have matching key and placeholder coverage", () => {
  const enPortalPaths = flattenStringPaths(enUS.translation.portal, "portal");
  const zhPortalPaths = flattenStringPaths(zhCN.translation.portal, "portal");
  assert.deepEqual(zhPortalPaths, enPortalPaths);

  for (const key of enPortalPaths) {
    const enValue = lookup(enUS.translation, key);
    const zhValue = lookup(zhCN.translation, key);
    assert.deepEqual(
      placeholders(zhValue),
      placeholders(enValue),
      `${key} placeholder mismatch`,
    );
  }
});

test("standalone operator components use operator-owned translation keys", () => {
  const literalKeys = operatorLiteralTranslationKeys();
  assert.ok(
    literalKeys.size > 0,
    "operator components should contain operator.* translation keys",
  );

  for (const key of [
    "operator.backstage.title",
    "operator.manifestViewer.emptyTitle",
    "operator.manifestEditor.title",
    "operator.workbench.title",
  ]) {
    assert.ok(literalKeys.has(key), `operator components missing ${key}`);
  }

  assert.doesNotMatch(operatorComponentSource, />Operator Backstage</);
  assert.doesNotMatch(operatorComponentSource, />Custom manifest editor</);
  assert.doesNotMatch(operatorComponentSource, />Workbench docs</);
});

test("standalone operator component translation keys resolve in both locale resources", () => {
  for (const key of operatorLiteralTranslationKeys()) {
    assert.equal(
      typeof lookup(enUS.translation, key),
      "string",
      `en-US missing ${key}`,
    );
    assert.equal(
      typeof lookup(zhCN.translation, key),
      "string",
      `zh-CN missing ${key}`,
    );
  }
});

test("standalone operator dynamic translation key families resolve in both locale resources", () => {
  const readinessStates = ["ready", "not_configured"];

  for (const key of readinessStates.map(
    (state) => `operator.backstage.readiness.${state}`,
  )) {
    assert.equal(
      typeof lookup(enUS.translation, key),
      "string",
      `en-US missing ${key}`,
    );
    assert.equal(
      typeof lookup(zhCN.translation, key),
      "string",
      `zh-CN missing ${key}`,
    );
  }
});

test("operator locale resources have matching key and placeholder coverage", () => {
  const enOperatorPaths = flattenStringPaths(enUS.translation.operator, "operator");
  const zhOperatorPaths = flattenStringPaths(zhCN.translation.operator, "operator");
  assert.deepEqual(zhOperatorPaths, enOperatorPaths);

  for (const key of enOperatorPaths) {
    const enValue = lookup(enUS.translation, key);
    const zhValue = lookup(zhCN.translation, key);
    assert.deepEqual(
      placeholders(zhValue),
      placeholders(enValue),
      `${key} placeholder mismatch`,
    );
  }
});

test("agent-first admin components use agentFirst-owned translation keys", () => {
  const literalKeys = agentFirstLiteralTranslationKeys();
  assert.ok(
    literalKeys.size > 0,
    "agent-first components should contain agentFirst.* translation keys",
  );

  for (const key of [
    "agentFirst.topbar.title",
    "agentFirst.nav.configure",
    "agentFirst.backstage.tabs.agents",
    "agentFirst.configure.title",
    "agentFirst.publish.title",
    "agentFirst.workbench.newAgent",
  ]) {
    assert.ok(literalKeys.has(key), `agent-first components missing ${key}`);
  }

  assert.doesNotMatch(agentFirstComponentSource, />Configure Agent</);
  assert.doesNotMatch(agentFirstComponentSource, />Publish agent</);
  assert.doesNotMatch(agentFirstComponentSource, />Pipeline progress</);
});

test("agent-first component translation keys resolve in both locale resources", () => {
  for (const key of agentFirstLiteralTranslationKeys()) {
    assert.equal(
      typeof lookup(enUS.translation, key),
      "string",
      `en-US missing ${key}`,
    );
    assert.equal(
      typeof lookup(zhCN.translation, key),
      "string",
      `zh-CN missing ${key}`,
    );
  }
});

test("agent-first dynamic translation key families resolve in both locale resources", () => {
  const runStatuses = ["running", "waiting", "succeeded", "queued"];
  const runtimeStatuses = [
    "succeeded",
    "running",
    "resumable",
    "approval_required",
    "waiting_for_user",
    "waiting_for_data",
    "blocked",
    "skipped",
    "queued",
  ];
  const connectionStatuses = ["configured", "missing_key", "offline"];
  const agentRunStates = ["local", "submitting", "saved", "offline", "failed"];
  const agentRunApiStatuses = [
    "planned",
    "missing_key",
    "needs_approval",
    "failed",
  ];
  const publishStatuses = ["draft", "published", "paused"];
  const publishSaveStates = ["local", "saving", "saved", "offline", "failed"];
  const climateApiStates = ["loading", "api", "offline"];
  const climateRunStates = ["idle", "submitting", "succeeded", "offline", "failed"];
  const agentReadinessStates = ["ready", "missing_skills"];
  const workbenchRunStatuses = [
    "pending",
    "queued",
    "running",
    "succeeded",
    "failed",
    "cancelled",
    "approval_required",
    "waiting_for_user",
    "waiting_for_data",
    "blocked",
    "skipped",
  ];
  const memoryModes = ["shortLong", "longOnly", "shortOnly"];
  const switches = ["enabled", "approval", "network", "dbWrite", "onDemand"];
  const portalViews = ["chat", "steps", "data", "sources", "result"];
  const executionModes = ["plan_only", "execute_ready"];
  const businessGuideIds = [
    "web_listening",
    "doc_to_md",
    "md_to_rag",
    "rag_to_agent",
    "climate_monitor",
    "ai_actuary",
    "example_reporter",
  ];
  const generalGuideIds = [
    "web_search",
    "browser",
    "github",
    "notion",
    "lark",
    "file_tools",
  ];
  const guideFields = ["summary", "trigger", "action", "output", "boundary"];

  const requiredKeys = [
    ...runStatuses.map((status) => `agentFirst.status.run.${status}`),
    ...runtimeStatuses.map((status) => `agentFirst.status.runtime.${status}`),
    ...connectionStatuses.map(
      (status) => `agentFirst.status.connection.${status}`,
    ),
    ...agentRunStates.map((state) => `agentFirst.status.agentRun.${state}`),
    ...agentRunApiStatuses.map(
      (status) => `agentFirst.status.agentRunApi.${status}`,
    ),
    ...publishStatuses.map((status) => `agentFirst.status.publish.${status}`),
    ...publishSaveStates.map(
      (state) => `agentFirst.status.publishSave.${state}`,
    ),
    ...climateApiStates.map((state) => `agentFirst.status.climateApi.${state}`),
    ...climateRunStates.map(
      (state) => `agentFirst.status.climateRun.${state}`,
    ),
    ...agentReadinessStates.map(
      (state) => `agentFirst.status.agentReadiness.${state}`,
    ),
    ...workbenchRunStatuses.map(
      (status) => `agentFirst.status.workbenchRun.${status}`,
    ),
    ...memoryModes.map((mode) => `agentFirst.configure.memoryMode.${mode}`),
    ...switches.flatMap((item) => [
      `agentFirst.configure.switches.${item}.label`,
      `agentFirst.configure.switches.${item}.detail`,
    ]),
    ...portalViews.flatMap((view) => [
      `agentFirst.publish.portalViews.${view}.label`,
      `agentFirst.publish.portalViews.${view}.detail`,
    ]),
    ...executionModes.map((mode) => `agentFirst.executionMode.${mode}`),
    ...businessGuideIds.flatMap((guideId) =>
      guideFields.map(
        (field) => `agentFirst.configure.guides.business.${guideId}.${field}`,
      ),
    ),
    ...generalGuideIds.flatMap((guideId) =>
      guideFields.map(
        (field) => `agentFirst.configure.guides.general.${guideId}.${field}`,
      ),
    ),
  ];

  for (const key of requiredKeys) {
    assert.equal(
      typeof lookup(enUS.translation, key),
      "string",
      `en-US missing ${key}`,
    );
    assert.equal(
      typeof lookup(zhCN.translation, key),
      "string",
      `zh-CN missing ${key}`,
    );
  }
});

test("agent-first locale resources have matching key and placeholder coverage", () => {
  const enAgentFirstPaths = flattenStringPaths(
    enUS.translation.agentFirst,
    "agentFirst",
  );
  const zhAgentFirstPaths = flattenStringPaths(
    zhCN.translation.agentFirst,
    "agentFirst",
  );
  assert.deepEqual(zhAgentFirstPaths, enAgentFirstPaths);

  for (const key of enAgentFirstPaths) {
    const enValue = lookup(enUS.translation, key);
    const zhValue = lookup(zhCN.translation, key);
    assert.deepEqual(
      placeholders(zhValue),
      placeholders(enValue),
      `${key} placeholder mismatch`,
    );
  }
});

test("persists locale choices and lets URL lang override stored locale in browser context", () => {
  const storedValues = new Map<string, string>([[LOCALE_STORAGE_KEY, "en-US"]]);
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { search: "?lang=zh-CN" },
      localStorage: {
        getItem: (key: string) => storedValues.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storedValues.set(key, value);
        },
      },
      navigator: { language: "en-US" },
    },
  });

  try {
    assert.equal(readBrowserLocale(), "zh-CN");
    persistLocale("zh-CN");
    assert.equal(storedValues.get(LOCALE_STORAGE_KEY), "zh-CN");
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});

function lookup(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function flattenStringPaths(value: unknown, prefix: string): string[] {
  if (typeof value === "string") return [prefix];
  if (!value || typeof value !== "object") return [];

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .flatMap((key) =>
      flattenStringPaths(
        (value as Record<string, unknown>)[key],
        `${prefix}.${key}`,
      ),
    );
}

function placeholders(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return Array.from(
    value.matchAll(/{{\s*([^}\s]+)\s*}}/g),
    (match) => match[1],
  ).sort();
}

function operatorLiteralTranslationKeys(): Set<string> {
  return literalTranslationKeys(operatorComponentSource, "operator");
}

function agentFirstLiteralTranslationKeys(): Set<string> {
  return literalTranslationKeys(agentFirstComponentSource, "agentFirst");
}

function literalTranslationKeys(source: string, namespace: string): Set<string> {
  return new Set(
    Array.from(
      source.matchAll(
        new RegExp(`["'\`]((?:${namespace})\\.[A-Za-z0-9_.-]+)["'\`]`, "g"),
      ),
      (match) => match[1],
    ).filter((key) => !key.endsWith(".")),
  );
}
