import { Router, type IRouter } from "express";

import type { AgentConfigRepository } from "../agent-config/agent-config-service";
import type { AgentRuntimeRepository } from "../agent-runtime/agent-runtime-service";
import {
  approveApprovalRequest,
  ApprovalConflictError,
  ApprovalNotFoundError,
  listApprovalsService,
  rejectApprovalRequest,
} from "../approvals/approval-decision-service";
import { createLazyRepository } from "./lazy-repository";
import {
  isPortalRuntimeRequest,
  requirePortalRuntimeAccess,
} from "./portal-access-guard";
import { redactInspectorResponse } from "./run-inspector";

function errorResponse(message: string): { error: string } {
  return { error: message };
}

function approvalIdFromParams(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringQueryParam(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim() || null;
  return null;
}

function filterApprovalsByMission<T extends { missionId?: string }>(
  approvals: T[],
  missionId: string | null,
): T[] {
  return missionId ? approvals.filter((approval) => approval.missionId === missionId) : approvals;
}

function errorStatus(error: unknown): number {
  if (error instanceof ApprovalConflictError) return error.statusCode;
  if (error instanceof ApprovalNotFoundError) return error.statusCode;

  const message = error instanceof Error ? error.message : String(error);
  if (/not found/i.test(message)) return 404;
  return 500;
}

const lazyRuntimeRepository = createLazyRepository<AgentRuntimeRepository>(
  async () => {
    const { DbAgentRuntimeRepository } = await import(
      "../agent-runtime/db-repository"
    );
    return new DbAgentRuntimeRepository();
  },
);

const lazyConfigRepository = createLazyRepository<AgentConfigRepository>(
  async () => {
    const { DbAgentConfigRepository } = await import(
      "../agent-config/db-repository"
    );
    return new DbAgentConfigRepository();
  },
);

export function createApprovalsRouter(
  repository: AgentRuntimeRepository,
  configRepository: AgentConfigRepository,
  options: { env?: Record<string, string | undefined> } = {},
): IRouter {
  const router: IRouter = Router();

  router.get("/approvals", async (req, res) => {
    if (isPortalRuntimeRequest(req)) {
      const access = await requirePortalRuntimeAccess(req, configRepository);
      if (!access.allowed) {
        res.status(403).json(errorResponse(access.error));
        return;
      }
    }

    try {
      const missionId = stringQueryParam(req.query["missionId"]);
      const approvals = filterApprovalsByMission(
        await listApprovalsService(repository),
        missionId,
      );
      res.json(
        redactInspectorResponse({ approvals }, options.env),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(errorStatus(error)).json(errorResponse(message));
    }
  });

  router.post("/approvals/:approvalId/approve", async (req, res) => {
    const approvalId = approvalIdFromParams(req.params.approvalId);
    if (!approvalId) {
      res.status(400).json(errorResponse("approvalId is required"));
      return;
    }

    if (isPortalRuntimeRequest(req)) {
      const access = await requirePortalRuntimeAccess(req, configRepository);
      if (!access.allowed) {
        res.status(403).json(errorResponse(access.error));
        return;
      }
    }

    try {
      const approval = await approveApprovalRequest(repository, approvalId, {
        env: options.env,
      });
      res.json(redactInspectorResponse({ approval }, options.env));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(errorStatus(error)).json(errorResponse(message));
    }
  });

  router.post("/approvals/:approvalId/reject", async (req, res) => {
    const approvalId = approvalIdFromParams(req.params.approvalId);
    if (!approvalId) {
      res.status(400).json(errorResponse("approvalId is required"));
      return;
    }

    if (isPortalRuntimeRequest(req)) {
      const access = await requirePortalRuntimeAccess(req, configRepository);
      if (!access.allowed) {
        res.status(403).json(errorResponse(access.error));
        return;
      }
    }

    try {
      const approval = await rejectApprovalRequest(repository, approvalId);
      res.json(redactInspectorResponse({ approval }, options.env));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(errorStatus(error)).json(errorResponse(message));
    }
  });

  return router;
}

const router = createApprovalsRouter(lazyRuntimeRepository, lazyConfigRepository);

export default router;
