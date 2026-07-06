import { useMemo } from "react";

import { MissionPortal } from "@/components/mission/MissionPortal";
import { readMissionPortalSearchParams } from "@/components/mission/MissionPortalAccess";

type ModuleId = string;

const modulePortalSpecs = {
  web_listening: { id: "listen" },
  doc_to_md: { id: "convert" },
  md_to_rag: { id: "index" },
  rag_to_agent: { id: "generate" },
} as const;

type KnownPortalModuleId = keyof typeof modulePortalSpecs;

function isKnownPortalModuleId(moduleId: ModuleId): moduleId is KnownPortalModuleId {
  return Object.prototype.hasOwnProperty.call(modulePortalSpecs, moduleId);
}

export function formatPortalModuleId(moduleId: ModuleId): string {
  const label = moduleId.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!label) return "";
  return `${label.charAt(0).toUpperCase()}${label.slice(1).toLowerCase()}`;
}

export function portalModuleStepPrefix(moduleId: ModuleId): string {
  if (isKnownPortalModuleId(moduleId)) return modulePortalSpecs[moduleId].id;
  return (
    moduleId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "module"
  );
}

export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === "string" && value.trim().length > 0;
}

export function AgentPortalInterface() {
  const portalSearch = useMemo(readMissionPortalSearchParams, []);

  return (
    <MissionPortal
      accessMode="portal-token"
      initialPortalToken={portalSearch.portalToken}
      initialMissionId={portalSearch.missionId}
    />
  );
}

export default AgentPortalInterface;
