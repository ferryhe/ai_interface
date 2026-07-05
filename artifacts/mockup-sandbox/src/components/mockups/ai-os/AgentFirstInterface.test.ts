import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./AgentFirstInterface.tsx", import.meta.url), "utf8");

test("agent-first default mission load does not request admin config surfaces", () => {
  assert.match(
    source,
    /const \[workspaceMode, setWorkspaceMode\] = useState<WorkspaceMode>\("mission"\);/,
  );
  assert.match(
    source,
    /const \[activeView, setActiveView\] = useState<AppView>\("agent"\);/,
  );
  assert.match(
    source,
    /const shouldLoadWorkbenchIndexes =\s*workspaceMode === "backstage" \|\|\s*\(workspaceMode === "foreground" &&\s*\(activeView === "progress" \|\|\s*activeView === "configure" \|\|\s*activeView === "publish"\)\);/s,
  );
  assert.match(source, /if \(!shouldLoadWorkbenchIndexes\) return;[\s\S]*fetch\("\/api\/agents"\)/);
  assert.match(source, /if \(!shouldLoadWorkbenchIndexes\) return;[\s\S]*fetch\("\/api\/skills"\)/);
  assert.match(source, /if \(!shouldLoadWorkbenchIndexes\) return;[\s\S]*fetch\("\/api\/runs\?limit=20"\)/);
  assert.match(source, /if \(!shouldLoadWorkbenchIndexes\) return;[\s\S]*`\/api\/artifacts\?pipelineRunId=/);
  assert.match(
    source,
    /const shouldLoadAdminConfig =\s*workspaceMode === "foreground" &&\s*\(activeView === "configure" \|\| activeView === "publish"\);/s,
  );
  assert.match(source, /if \(!shouldLoadAdminConfig\) return;/);
  assert.doesNotMatch(source, /adminConfigLoadStateRef|adminConfigLoadedRef/);
  assert.match(source, /if \(cancelled\) return;/);
  assert.match(source, /fetch\("\/api\/agent-config"\)/);
});
