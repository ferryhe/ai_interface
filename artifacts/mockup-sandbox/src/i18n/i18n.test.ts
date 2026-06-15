import assert from "node:assert/strict";
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
  assert.equal(zhCN.translation.approvalInbox.updatedTitle, "\u5ba1\u6279\u5df2\u66f4\u65b0");
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
  assert.equal(i18nStatusKey("waiting_approval"), "common.status.waiting_approval");

  for (const key of requiredKeys) {
    assert.equal(typeof lookup(enUS.translation, key), "string", `en-US missing ${key}`);
    assert.equal(typeof lookup(zhCN.translation, key), "string", `zh-CN missing ${key}`);
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
