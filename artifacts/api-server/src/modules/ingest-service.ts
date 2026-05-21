import { randomUUID } from "node:crypto";

import { isKnownModuleId, type ModuleId } from "./registry";
import {
  defaultSkillRuntimeRegistry,
  type SkillRuntimeRegistry,
} from "../skill-runtime/skill-runtime-registry";

export type ModuleRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type JsonObject = Record<string, unknown>;

export interface ModuleRunRecord {
  id: string;
  pipelineRunId: string | null;
  moduleId: ModuleId;
  externalRunId: string;
  title: string | null;
  status: ModuleRunStatus;
  inputJson: JsonObject | null;
  outputJson: JsonObject | null;
  summary: string | null;
  metadata: JsonObject | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateModuleRunInput {
  moduleId: string;
  externalRunId: string;
  pipelineRunId?: string;
  title?: string;
  status?: ModuleRunStatus;
  inputJson?: JsonObject;
  outputJson?: JsonObject;
  metadata?: JsonObject;
  registeredSkillIds?: string[];
}

interface CreateModuleRunRecordInput {
  pipelineRunId: string | null;
  moduleId: ModuleId;
  externalRunId: string;
  title: string | null;
  status: ModuleRunStatus;
  inputJson: JsonObject | null;
  outputJson: JsonObject | null;
  metadata: JsonObject | null;
}

interface UpdateModuleRunRecordInput {
  pipelineRunId?: string | null;
  title?: string | null;
  status?: ModuleRunStatus;
  summary?: string | null;
  inputJson?: JsonObject | null;
  outputJson?: JsonObject | null;
  metadata?: JsonObject | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface UpdateModuleRunInput {
  title?: string | null;
  status?: ModuleRunStatus;
  summary?: string | null;
  outputJson?: JsonObject;
  metadata?: JsonObject;
  startedAt?: Date;
  completedAt?: Date;
}

export type RunEventSeverity = "info" | "warning" | "error";

export interface RunEventRecord {
  id: string;
  moduleRunId: string;
  eventType: string;
  title: string | null;
  message: string | null;
  severity: RunEventSeverity;
  payload: JsonObject | null;
  createdAt: Date;
}

export interface CreateRunEventInput {
  eventType: string;
  title?: string;
  message?: string;
  severity?: RunEventSeverity;
  payload?: JsonObject;
}

export interface ArtifactRecord {
  id: string;
  artifactKind: string;
  title: string;
  contentText: string | null;
  contentJson: JsonObject | null;
  sourceModuleId: ModuleId;
  sourceRunId: string;
  parentArtifactId: string | null;
  provenance: JsonObject | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateArtifactInput {
  artifactKind: string;
  title: string;
  contentText?: string;
  contentJson?: JsonObject;
  parentArtifactId?: string;
  provenance?: JsonObject;
}

export interface ListArtifactsFilters {
  pipelineRunId?: string;
  moduleRunId?: string;
  kind?: string;
  limit?: number;
}

export type ToolInteractionKind =
  | "question"
  | "approval"
  | "data_request"
  | "blocked";

export type ToolInteractionStatus =
  | "waiting_for_user"
  | "waiting_for_approval"
  | "waiting_for_data"
  | "blocked"
  | "resumable"
  | "resumed";

export interface ToolInteractionOption {
  id: string;
  label: string;
  description?: string;
  value?: JsonObject;
}

export interface CreateToolInteractionInput {
  kind: ToolInteractionKind;
  title: string;
  message: string;
  prompt?: string;
  options?: ToolInteractionOption[];
  artifactIds?: string[];
  resumeHandle?: string;
  requestedBy?: string;
  metadata?: JsonObject;
}

export interface SubmitToolFeedbackInput {
  responseText?: string;
  selectedOptionId?: string;
  approved?: boolean;
  artifactIds?: string[];
  resumeHandle?: string;
  metadata?: JsonObject;
}

export interface ToolInteractionFeedback {
  responseText?: string;
  selectedOptionId?: string;
  approved?: boolean;
  artifactIds: string[];
  resumeHandle?: string;
  metadata: JsonObject;
}

export interface ToolInteraction {
  interactionId: string;
  status: ToolInteractionStatus;
  kind: ToolInteractionKind;
  title: string;
  message: string;
  prompt: string | null;
  options: ToolInteractionOption[];
  artifactIds: string[];
  resumeHandle: string | null;
  requestedBy: string | null;
  requestedAt: string;
  metadata: JsonObject;
  respondedAt?: string;
  response?: ToolInteractionFeedback;
}

export interface ToolInteractionResponse {
  run: ModuleRunRecord;
  event: RunEventRecord;
  interaction: ToolInteraction;
}

interface CreateRunEventRecordInput {
  moduleRunId: string;
  eventType: string;
  title: string | null;
  message: string | null;
  severity: RunEventSeverity;
  payload: JsonObject | null;
}

interface CreateArtifactRecordInput {
  artifactKind: string;
  title: string;
  contentText: string | null;
  contentJson: JsonObject | null;
  sourceModuleId: ModuleId;
  sourceRunId: string;
  parentArtifactId: string | null;
  provenance: JsonObject | null;
}

export interface ModuleRunRepository {
  findModuleRunByExternalId(
    moduleId: ModuleId,
    externalRunId: string,
  ): Promise<ModuleRunRecord | null>;
  createModuleRun(input: CreateModuleRunRecordInput): Promise<ModuleRunRecord>;
  updateModuleRun(
    id: string,
    input: UpdateModuleRunRecordInput,
  ): Promise<ModuleRunRecord>;
  consumeResumableInteraction(
    id: string,
    interactionId: string,
    interaction: ToolInteraction,
  ): Promise<ModuleRunRecord | null>;
  pipelineRunExists(id: string): Promise<boolean>;
  findModuleRunById(id: string): Promise<ModuleRunRecord | null>;
  createRunEvent(input: CreateRunEventRecordInput): Promise<RunEventRecord>;
  createArtifact(input: CreateArtifactRecordInput): Promise<ArtifactRecord>;
  findArtifactById(id: string): Promise<ArtifactRecord | null>;
  listRunEvents(moduleRunId: string): Promise<RunEventRecord[]>;
  listRunEventsByPipelineRunId(pipelineRunId: string): Promise<RunEventRecord[]>;
  listRunArtifacts(moduleRunId: string): Promise<ArtifactRecord[]>;
  listArtifacts(filters: ListArtifactsFilters): Promise<ArtifactRecord[]>;
}

export class InMemoryModuleRunRepository implements ModuleRunRepository {
  readonly moduleRuns: ModuleRunRecord[] = [];
  readonly runEvents: RunEventRecord[] = [];
  readonly artifacts: ArtifactRecord[] = [];
  readonly pipelineRunIds = new Set<string>();

  async findModuleRunByExternalId(
    moduleId: ModuleId,
    externalRunId: string,
  ): Promise<ModuleRunRecord | null> {
    return (
      this.moduleRuns.find(
        (run) =>
          run.moduleId === moduleId && run.externalRunId === externalRunId,
      ) ?? null
    );
  }

  async createModuleRun(
    input: CreateModuleRunRecordInput,
  ): Promise<ModuleRunRecord> {
    const now = new Date();
    const run: ModuleRunRecord = {
      id: randomUUID(),
      ...input,
      summary: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.moduleRuns.push(run);
    return run;
  }

  async updateModuleRun(
    id: string,
    input: UpdateModuleRunRecordInput,
  ): Promise<ModuleRunRecord> {
    const index = this.moduleRuns.findIndex((run) => run.id === id);
    if (index === -1) {
      throw new Error(`Module run not found: ${id}`);
    }

    const current = this.moduleRuns[index]!;
    const updated: ModuleRunRecord = {
      ...current,
      ...input,
      updatedAt: new Date(),
    };
    this.moduleRuns[index] = updated;
    return updated;
  }

  async consumeResumableInteraction(
    id: string,
    interactionId: string,
    interaction: ToolInteraction,
  ): Promise<ModuleRunRecord | null> {
    const index = this.moduleRuns.findIndex((run) => run.id === id);
    if (index === -1) {
      return null;
    }

    const current = this.moduleRuns[index]!;
    const currentInteraction = getCurrentInteraction(current);
    if (
      currentInteraction?.interactionId !== interactionId ||
      currentInteraction.status !== "resumable"
    ) {
      return null;
    }

    const updated: ModuleRunRecord = {
      ...current,
      metadata: getMetadataWithInteraction(current.metadata, interaction),
      updatedAt: new Date(),
    };
    this.moduleRuns[index] = updated;
    return updated;
  }

  async findModuleRunById(id: string): Promise<ModuleRunRecord | null> {
    return this.moduleRuns.find((run) => run.id === id) ?? null;
  }

  async pipelineRunExists(id: string): Promise<boolean> {
    return this.pipelineRunIds.has(id);
  }

  async createRunEvent(
    input: CreateRunEventRecordInput,
  ): Promise<RunEventRecord> {
    const event: RunEventRecord = {
      id: randomUUID(),
      ...input,
      createdAt: new Date(),
    };
    this.runEvents.push(event);
    return event;
  }

  async createArtifact(
    input: CreateArtifactRecordInput,
  ): Promise<ArtifactRecord> {
    const now = new Date();
    const artifact: ArtifactRecord = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.artifacts.push(artifact);
    return artifact;
  }

  async findArtifactById(id: string): Promise<ArtifactRecord | null> {
    return this.artifacts.find((artifact) => artifact.id === id) ?? null;
  }

  async listRunEvents(moduleRunId: string): Promise<RunEventRecord[]> {
    return this.runEvents.filter((event) => event.moduleRunId === moduleRunId);
  }

  async listRunEventsByPipelineRunId(
    pipelineRunId: string,
  ): Promise<RunEventRecord[]> {
    const moduleRunIds = new Set(
      this.moduleRuns
        .filter((run) => run.pipelineRunId === pipelineRunId)
        .map((run) => run.id),
    );
    return this.runEvents
      .filter((event) => moduleRunIds.has(event.moduleRunId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async listRunArtifacts(moduleRunId: string): Promise<ArtifactRecord[]> {
    return this.artifacts.filter(
      (artifact) => artifact.sourceRunId === moduleRunId,
    );
  }

  async listArtifacts(
    filters: ListArtifactsFilters,
  ): Promise<ArtifactRecord[]> {
    const moduleRunIdsForPipeline = filters.pipelineRunId
      ? new Set(
          this.moduleRuns
            .filter((run) => run.pipelineRunId === filters.pipelineRunId)
            .map((run) => run.id),
        )
      : null;
    const artifacts = this.artifacts
      .filter((artifact) =>
        filters.moduleRunId ? artifact.sourceRunId === filters.moduleRunId : true,
      )
      .filter((artifact) =>
        moduleRunIdsForPipeline
          ? moduleRunIdsForPipeline.has(artifact.sourceRunId)
          : true,
      )
      .filter((artifact) =>
        filters.kind ? artifact.artifactKind === filters.kind : true,
      )
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

    return typeof filters.limit === "number"
      ? artifacts.slice(0, filters.limit)
      : artifacts;
  }
}

export async function createModuleRun(
  repository: ModuleRunRepository,
  input: CreateModuleRunInput,
  options: {
    registry?: SkillRuntimeRegistry;
  } = {},
): Promise<{ created: boolean; run: ModuleRunRecord }> {
  const registry = options.registry ?? defaultSkillRuntimeRegistry;
  const registeredSkillIds = new Set(input.registeredSkillIds ?? []);
  if (
    !registry.isKnownModuleId(input.moduleId) &&
    !isKnownModuleId(input.moduleId) &&
    !registeredSkillIds.has(input.moduleId)
  ) {
    throw new Error(`Unknown moduleId: ${input.moduleId}`);
  }

  if (input.pipelineRunId) {
    const pipelineRunExists = await repository.pipelineRunExists(
      input.pipelineRunId,
    );
    if (!pipelineRunExists) {
      throw new Error(`Pipeline run not found: ${input.pipelineRunId}`);
    }
  }

  const existing = await repository.findModuleRunByExternalId(
    input.moduleId,
    input.externalRunId,
  );

  if (existing) {
    const updated = await repository.updateModuleRun(existing.id, {
      pipelineRunId: input.pipelineRunId ?? existing.pipelineRunId,
      title: input.title ?? existing.title,
      status: input.status ?? existing.status,
      inputJson: input.inputJson ?? existing.inputJson,
      outputJson: input.outputJson ?? existing.outputJson,
      metadata: input.metadata ?? existing.metadata,
    });
    return { created: false, run: updated };
  }

  const created = await repository.createModuleRun({
    pipelineRunId: input.pipelineRunId ?? null,
    moduleId: input.moduleId,
    externalRunId: input.externalRunId,
    title: input.title ?? null,
    status: input.status ?? "pending",
    inputJson: input.inputJson ?? null,
    outputJson: input.outputJson ?? null,
    metadata: input.metadata ?? null,
  });

  return { created: true, run: created };
}

export async function updateModuleRun(
  repository: ModuleRunRepository,
  runId: string,
  input: UpdateModuleRunInput,
): Promise<ModuleRunRecord> {
  const existing = await repository.findModuleRunById(runId);
  if (!existing) {
    throw new Error(`Module run not found: ${runId}`);
  }

  return repository.updateModuleRun(runId, {
    title: input.title ?? existing.title,
    status: input.status ?? existing.status,
    summary: input.summary ?? existing.summary,
    outputJson: input.outputJson ?? existing.outputJson,
    metadata: input.metadata ?? existing.metadata,
    startedAt: input.startedAt ?? existing.startedAt,
    completedAt: input.completedAt ?? existing.completedAt,
  });
}
export async function getModuleRunDetail(
  repository: ModuleRunRepository,
  runId: string,
): Promise<{
  run: ModuleRunRecord;
  events: RunEventRecord[];
  artifacts: ArtifactRecord[];
}> {
  const run = await repository.findModuleRunById(runId);
  if (!run) {
    throw new Error(`Module run not found: ${runId}`);
  }

  const [events, artifacts] = await Promise.all([
    repository.listRunEvents(runId),
    repository.listRunArtifacts(runId),
  ]);

  return { run, events, artifacts };
}

export async function recordModuleRunEvent(
  repository: ModuleRunRepository,
  runId: string,
  input: CreateRunEventInput,
): Promise<RunEventRecord> {
  const run = await repository.findModuleRunById(runId);
  if (!run) {
    throw new Error(`Module run not found: ${runId}`);
  }

  return repository.createRunEvent({
    moduleRunId: run.id,
    eventType: input.eventType,
    title: input.title ?? null,
    message: input.message ?? null,
    severity: input.severity ?? "info",
    payload: input.payload ?? null,
  });
}

export async function recordModuleRunArtifact(
  repository: ModuleRunRepository,
  runId: string,
  input: CreateArtifactInput,
): Promise<ArtifactRecord> {
  const run = await repository.findModuleRunById(runId);
  if (!run) {
    throw new Error(`Module run not found: ${runId}`);
  }

  return repository.createArtifact({
    artifactKind: input.artifactKind,
    title: input.title,
    contentText: input.contentText ?? null,
    contentJson: input.contentJson ?? null,
    sourceModuleId: run.moduleId,
    sourceRunId: run.id,
    parentArtifactId: input.parentArtifactId ?? null,
    provenance: input.provenance ?? null,
  });
}

export async function listArtifacts(
  repository: ModuleRunRepository,
  filters: ListArtifactsFilters,
): Promise<ArtifactRecord[]> {
  return repository.listArtifacts(filters);
}

function interactionStatusForKind(
  kind: ToolInteractionKind,
): ToolInteractionStatus {
  if (kind === "approval") return "waiting_for_approval";
  if (kind === "data_request") return "waiting_for_data";
  if (kind === "blocked") return "blocked";
  return "waiting_for_user";
}

export function getMetadataWithInteraction(
  metadata: JsonObject | null,
  interaction: ToolInteraction,
): JsonObject {
  return {
    ...(metadata ?? {}),
    interaction,
  };
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isToolInteractionKind(value: unknown): value is ToolInteractionKind {
  return (
    value === "question" ||
    value === "approval" ||
    value === "data_request" ||
    value === "blocked"
  );
}

export function isToolInteractionStatus(
  value: unknown,
): value is ToolInteractionStatus {
  return (
    value === "waiting_for_user" ||
    value === "waiting_for_approval" ||
    value === "waiting_for_data" ||
    value === "blocked" ||
    value === "resumable" ||
    value === "resumed"
  );
}

function isToolInteractionOption(
  value: unknown,
): value is ToolInteractionOption {
  if (!isJsonObject(value)) return false;
  if (typeof value["id"] !== "string" || typeof value["label"] !== "string") {
    return false;
  }
  if (
    value["description"] !== undefined &&
    typeof value["description"] !== "string"
  ) {
    return false;
  }
  if (value["value"] !== undefined && !isJsonObject(value["value"])) {
    return false;
  }
  return true;
}

function isToolInteractionFeedback(
  value: unknown,
): value is ToolInteractionFeedback {
  if (!isJsonObject(value)) return false;
  if (
    value["responseText"] !== undefined &&
    typeof value["responseText"] !== "string"
  ) {
    return false;
  }
  if (
    value["selectedOptionId"] !== undefined &&
    typeof value["selectedOptionId"] !== "string"
  ) {
    return false;
  }
  if (
    value["approved"] !== undefined &&
    typeof value["approved"] !== "boolean"
  ) {
    return false;
  }
  if (!isStringArray(value["artifactIds"])) return false;
  if (
    value["resumeHandle"] !== undefined &&
    typeof value["resumeHandle"] !== "string"
  ) {
    return false;
  }
  return isJsonObject(value["metadata"]);
}

function isToolInteraction(value: unknown): value is ToolInteraction {
  if (!isJsonObject(value)) return false;
  if (
    typeof value["interactionId"] !== "string" ||
    !isToolInteractionStatus(value["status"]) ||
    !isToolInteractionKind(value["kind"]) ||
    typeof value["title"] !== "string" ||
    typeof value["message"] !== "string"
  ) {
    return false;
  }
  if (value["prompt"] !== null && typeof value["prompt"] !== "string") {
    return false;
  }
  if (
    !Array.isArray(value["options"]) ||
    !value["options"].every(isToolInteractionOption)
  ) {
    return false;
  }
  if (!isStringArray(value["artifactIds"])) return false;
  if (
    value["resumeHandle"] !== null &&
    typeof value["resumeHandle"] !== "string"
  ) {
    return false;
  }
  if (
    value["requestedBy"] !== null &&
    typeof value["requestedBy"] !== "string"
  ) {
    return false;
  }
  if (
    typeof value["requestedAt"] !== "string" ||
    !isJsonObject(value["metadata"])
  ) {
    return false;
  }
  if (
    value["respondedAt"] !== undefined &&
    typeof value["respondedAt"] !== "string"
  ) {
    return false;
  }
  if (
    value["response"] !== undefined &&
    !isToolInteractionFeedback(value["response"])
  ) {
    return false;
  }
  return true;
}

export function getCurrentInteraction(
  run: ModuleRunRecord,
): ToolInteraction | null {
  const interaction = run.metadata?.["interaction"];
  return isToolInteraction(interaction) ? interaction : null;
}

function isActiveInteraction(
  interaction: ToolInteraction | null,
): interaction is ToolInteraction {
  return (
    interaction?.status === "waiting_for_user" ||
    interaction?.status === "waiting_for_approval" ||
    interaction?.status === "waiting_for_data" ||
    interaction?.status === "blocked"
  );
}

function normalizeFeedback(
  input: SubmitToolFeedbackInput,
): ToolInteractionFeedback {
  const response: ToolInteractionFeedback = {
    artifactIds: input.artifactIds ?? [],
    metadata: input.metadata ?? {},
  };
  if (input.responseText !== undefined)
    response.responseText = input.responseText;
  if (input.selectedOptionId !== undefined) {
    response.selectedOptionId = input.selectedOptionId;
  }
  if (input.approved !== undefined) response.approved = input.approved;
  if (input.resumeHandle !== undefined)
    response.resumeHandle = input.resumeHandle;
  return response;
}

export async function requestModuleRunInteraction(
  repository: ModuleRunRepository,
  runId: string,
  input: CreateToolInteractionInput,
): Promise<ToolInteractionResponse> {
  const existing = await repository.findModuleRunById(runId);
  if (!existing) {
    throw new Error(`Module run not found: ${runId}`);
  }

  const interaction: ToolInteraction = {
    interactionId: randomUUID(),
    status: interactionStatusForKind(input.kind),
    kind: input.kind,
    title: input.title,
    message: input.message,
    prompt: input.prompt ?? null,
    options: input.options ?? [],
    artifactIds: input.artifactIds ?? [],
    resumeHandle: input.resumeHandle ?? null,
    requestedBy: input.requestedBy ?? null,
    requestedAt: new Date().toISOString(),
    metadata: input.metadata ?? {},
  };

  const run = await repository.updateModuleRun(runId, {
    status: existing.status === "pending" ? "running" : existing.status,
    metadata: getMetadataWithInteraction(existing.metadata, interaction),
  });
  const event = await repository.createRunEvent({
    moduleRunId: run.id,
    eventType: "tool.interaction.requested",
    title: input.title,
    message: input.message,
    severity: input.kind === "blocked" ? "warning" : "info",
    payload: { ...interaction },
  });

  return { run, event, interaction };
}

export async function submitModuleRunFeedback(
  repository: ModuleRunRepository,
  runId: string,
  input: SubmitToolFeedbackInput,
): Promise<ToolInteractionResponse> {
  const existing = await repository.findModuleRunById(runId);
  if (!existing) {
    throw new Error(`Module run not found: ${runId}`);
  }

  const currentInteraction = getCurrentInteraction(existing);
  if (!isActiveInteraction(currentInteraction)) {
    throw new Error(`Module run has no active interaction: ${runId}`);
  }

  const feedback = normalizeFeedback(input);
  const interaction: ToolInteraction = {
    ...currentInteraction,
    status: "resumable",
    resumeHandle: input.resumeHandle ?? currentInteraction.resumeHandle,
    respondedAt: new Date().toISOString(),
    response: feedback,
  };

  const run = await repository.updateModuleRun(runId, {
    metadata: getMetadataWithInteraction(existing.metadata, interaction),
  });
  const event = await repository.createRunEvent({
    moduleRunId: run.id,
    eventType: "tool.interaction.feedback_submitted",
    title: currentInteraction.title,
    message: feedback.responseText ?? null,
    severity: "info",
    payload: {
      interactionId: interaction.interactionId,
      status: interaction.status,
      kind: interaction.kind,
      resumeHandle: interaction.resumeHandle,
      response: feedback,
    },
  });

  return { run, event, interaction };
}
