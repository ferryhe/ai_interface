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
