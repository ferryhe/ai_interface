import { Router, type IRouter } from "express";
import {
  CreateModuleRunArtifactBody,
  CreateModuleRunArtifactParams,
  CreateModuleRunBody,
  CreateModuleRunEventBody,
  CreateModuleRunEventParams,
  CreateModuleRunInteractionBody,
  CreateModuleRunInteractionParams,
  CreateModuleRunResponse,
  GetArtifactParams,
  GetArtifactResponse,
  GetModuleRunParams,
  GetModuleRunResponse,
  ListModulesResponse,
  SubmitModuleRunFeedbackBody,
  SubmitModuleRunFeedbackParams,
  UpdateModuleRunBody,
  UpdateModuleRunParams,
  UpdateModuleRunResponse,
} from "@workspace/api-zod";

import { DbModuleRunRepository } from "../modules/db-repository";
import {
  createModuleRun,
  getModuleRunDetail,
  recordModuleRunArtifact,
  recordModuleRunEvent,
  requestModuleRunInteraction,
  submitModuleRunFeedback,
  updateModuleRun,
} from "../modules/ingest-service";
import { moduleRegistry } from "../modules/registry";

const router: IRouter = Router();
const repository = new DbModuleRunRepository();

function errorResponse(message: string): { error: string } {
  return { error: message };
}

router.get("/modules", (_req, res) => {
  const data = ListModulesResponse.parse({ modules: moduleRegistry });
  res.json(data);
});

router.post("/module-runs", async (req, res) => {
  const body = CreateModuleRunBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json(errorResponse(body.error.message));
    return;
  }

  try {
    const result = await createModuleRun(repository, body.data);
    const data = CreateModuleRunResponse.parse(result);
    res.status(result.created ? 201 : 200).json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json(errorResponse(message));
  }
});

router.get("/module-runs/:runId", async (req, res) => {
  const params = GetModuleRunParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json(errorResponse(params.error.message));
    return;
  }

  try {
    const detail = await getModuleRunDetail(repository, params.data.runId);
    const data = GetModuleRunResponse.parse(detail);
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(404).json(errorResponse(message));
  }
});

router.patch("/module-runs/:runId", async (req, res) => {
  const params = UpdateModuleRunParams.safeParse(req.params);
  const body = UpdateModuleRunBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json(errorResponse(params.error.message));
    return;
  }
  if (!body.success) {
    res.status(400).json(errorResponse(body.error.message));
    return;
  }

  try {
    const updated = await updateModuleRun(repository, params.data.runId, body.data);
    const data = UpdateModuleRunResponse.parse(updated);
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(404).json(errorResponse(message));
  }
});

router.post("/module-runs/:runId/events", async (req, res) => {
  const params = CreateModuleRunEventParams.safeParse(req.params);
  const body = CreateModuleRunEventBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json(errorResponse(params.error.message));
    return;
  }
  if (!body.success) {
    res.status(400).json(errorResponse(body.error.message));
    return;
  }

  try {
    const event = await recordModuleRunEvent(repository, params.data.runId, body.data);
    res.status(201).json(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(404).json(errorResponse(message));
  }
});

router.post("/module-runs/:runId/artifacts", async (req, res) => {
  const params = CreateModuleRunArtifactParams.safeParse(req.params);
  const body = CreateModuleRunArtifactBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json(errorResponse(params.error.message));
    return;
  }
  if (!body.success) {
    res.status(400).json(errorResponse(body.error.message));
    return;
  }

  try {
    const artifact = await recordModuleRunArtifact(
      repository,
      params.data.runId,
      body.data,
    );
    const data = GetArtifactResponse.parse(artifact);
    res.status(201).json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(404).json(errorResponse(message));
  }
});

router.post("/module-runs/:runId/interactions", async (req, res) => {
  const params = CreateModuleRunInteractionParams.safeParse(req.params);
  const body = CreateModuleRunInteractionBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json(errorResponse(params.error.message));
    return;
  }
  if (!body.success) {
    res.status(400).json(errorResponse(body.error.message));
    return;
  }

  try {
    const result = await requestModuleRunInteraction(
      repository,
      params.data.runId,
      body.data,
    );
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(404).json(errorResponse(message));
  }
});

router.post("/module-runs/:runId/feedback", async (req, res) => {
  const params = SubmitModuleRunFeedbackParams.safeParse(req.params);
  const body = SubmitModuleRunFeedbackBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json(errorResponse(params.error.message));
    return;
  }
  if (!body.success) {
    res.status(400).json(errorResponse(body.error.message));
    return;
  }

  try {
    const result = await submitModuleRunFeedback(
      repository,
      params.data.runId,
      body.data,
    );
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(404).json(errorResponse(message));
  }
});

router.get("/artifacts/:artifactId", async (req, res) => {
  const params = GetArtifactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json(errorResponse(params.error.message));
    return;
  }

  const artifact = await repository.findArtifactById(params.data.artifactId);
  if (!artifact) {
    res.status(404).json(errorResponse(`Artifact not found: ${params.data.artifactId}`));
    return;
  }

  const data = GetArtifactResponse.parse(artifact);
  res.json(data);
});

export default router;
