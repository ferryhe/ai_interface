import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as React from "react";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const { formatPortalModuleId, isModuleId, portalModuleStepPrefix } =
  await import("./AgentPortalInterface.tsx");

const agentPortalSource = readFileSync(new URL("./AgentPortalInterface.tsx", import.meta.url), "utf8");
const missionPortalSource = readFileSync(
  new URL("../../mission/MissionPortal.tsx", import.meta.url),
  "utf8",
);

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

test("agent portal preview delegates token users to the shared mission portal", () => {
  assert.match(agentPortalSource, /from "@\/components\/mission\/MissionPortal"/);
  assert.match(agentPortalSource, /readMissionPortalSearchParams/);
  assert.match(agentPortalSource, /<MissionPortal[\s\S]*accessMode="portal-token"/);
  assert.match(agentPortalSource, /initialPortalToken=\{portalSearch\.portalToken\}/);
  assert.match(agentPortalSource, /initialMissionId=\{portalSearch\.missionId\}/);
});

test("mission portal token mode keeps public users on portal-runtime APIs only", () => {
  assert.match(missionPortalSource, /\/api\/portal-auth\/verify/);
  assert.match(missionPortalSource, /missionPortalRuntimeHeaders/);
  assert.match(missionPortalSource, /requestHeaders=\{portalRequestHeaders\}/);
  assert.doesNotMatch(missionPortalSource, /\/api\/agent-config/);
  assert.doesNotMatch(missionPortalSource, /\/api\/agent-manifests/);
  assert.doesNotMatch(missionPortalSource, /provider\/model|publishToken/i);
});
