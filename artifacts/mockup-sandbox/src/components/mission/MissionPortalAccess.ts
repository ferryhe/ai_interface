export type MissionPortalAccessMode = "frontstage" | "portal-token";

export interface MissionPortalSearchParams {
  portalToken: string;
  missionId: string | null;
}

export function readMissionPortalSearchParams(search?: string): MissionPortalSearchParams {
  const rawSearch =
    search ?? (typeof window === "undefined" ? "" : window.location.search);
  const params = new URLSearchParams(rawSearch);
  const portalToken =
    params.get("token")?.trim() || params.get("portalToken")?.trim() || "";
  const missionId = params.get("missionId")?.trim() || null;
  return { portalToken, missionId };
}

export function missionPortalRuntimeHeaders(
  tokenValue: string,
  input: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    ...input,
    "X-AI-Interface-Surface": "agent-portal",
  };
  const cleanToken = tokenValue.trim();
  if (cleanToken) headers["X-Portal-Token"] = cleanToken;
  return headers;
}

export function isPortalRuntimeAccessDenied(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}
