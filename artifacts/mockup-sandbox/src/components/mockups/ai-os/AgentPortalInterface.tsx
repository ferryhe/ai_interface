import { useMemo } from "react";

import { MissionPortal } from "@/components/mission/MissionPortal";
import { readMissionPortalSearchParams } from "@/components/mission/MissionPortalAccess";

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
