import assert from "node:assert/strict";
import test from "node:test";

import { isKnownModuleId, moduleRegistry } from "./registry";

test("module registry includes climate_monitor as a first-class module", () => {
  const climateMonitor = moduleRegistry.find(
    (moduleDefinition) => moduleDefinition.moduleId === "climate_monitor",
  );

  assert.equal(isKnownModuleId("climate_monitor"), true);
  assert.equal(climateMonitor?.displayName, "Climate Monitor");
  assert.equal(climateMonitor?.category, "source");
  assert.deepEqual(climateMonitor?.resultKinds, [
    "climate_monitor_report",
    "climate_monitor_run_json",
    "climate_monitor_scope_status",
  ]);
});
