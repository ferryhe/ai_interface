import assert from "node:assert/strict";
import test from "node:test";

import * as React from "react";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const { formatPortalModuleId, isModuleId, portalModuleStepPrefix } =
  await import("./AgentPortalInterface.tsx");

test("portal accepts registered runtime module ids beyond the demo pipeline", () => {
  assert.equal(isModuleId("web_listening"), true);
  assert.equal(isModuleId("climate_monitor"), true);
  assert.equal(isModuleId("ai_actuary"), true);
  assert.equal(isModuleId(""), false);
  assert.equal(isModuleId("   "), false);
  assert.equal(isModuleId(42), false);
});

test("portal derives stable fallback display and step ids for open module ids", () => {
  assert.equal(formatPortalModuleId("climate_monitor"), "Climate monitor");
  assert.equal(formatPortalModuleId("ai-actuary"), "Ai actuary");
  assert.equal(portalModuleStepPrefix("climate_monitor"), "climate-monitor");
  assert.equal(portalModuleStepPrefix("AI Actuary"), "ai-actuary");
});
