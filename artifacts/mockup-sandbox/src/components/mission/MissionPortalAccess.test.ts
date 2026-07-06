/// <reference types="node" />

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  missionPortalRuntimeHeaders,
  readMissionPortalSearchParams,
} from "./MissionPortalAccess";

test("mission portal token mode reads token and mission id from public URL params", () => {
  assert.deepEqual(readMissionPortalSearchParams("?token= portal-secret &missionId= mission-123 "), {
    portalToken: "portal-secret",
    missionId: "mission-123",
  });
  assert.deepEqual(readMissionPortalSearchParams("?portalToken=alt-secret"), {
    portalToken: "alt-secret",
    missionId: null,
  });
  assert.deepEqual(readMissionPortalSearchParams("?token=   &portalToken=fallback-secret"), {
    portalToken: "fallback-secret",
    missionId: null,
  });
  assert.deepEqual(readMissionPortalSearchParams("?missionId= mission-456 "), {
    portalToken: "",
    missionId: "mission-456",
  });
});

test("mission portal runtime headers scope token users to the portal runtime guard", () => {
  assert.deepEqual(missionPortalRuntimeHeaders("  portal-secret ", { Accept: "application/json" }), {
    Accept: "application/json",
    "X-AI-Interface-Surface": "agent-portal",
    "X-Portal-Token": "portal-secret",
  });

  assert.deepEqual(missionPortalRuntimeHeaders("", { Accept: "application/json" }), {
    Accept: "application/json",
    "X-AI-Interface-Surface": "agent-portal",
  });
});
