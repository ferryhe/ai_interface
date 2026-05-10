import { randomUUID } from "node:crypto";

import { isKnownModuleId, type ModuleId } from "./registry";

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
  findModuleRunById(id: string): Promise<ModuleRunRecord | null>;
  createRunEvent(input: CreateRunEventRecordInput): Promise<RunEventRecord>;
  createArtifact(input: CreateArtifactRecordInput): Promise<ArtifactRecord>;
  findArtifactById(id: string): Promise<ArtifactRecord | null>;
  listRunEvents(moduleRunId: string): Promise<RunEventRecord[]>;
  listRunArtifacts(moduleRunId: string): Promise<ArtifactRecord[]>;
}

export class InMemoryModuleRunRepository implements ModuleRunRepository {
  readonly moduleRuns: ModuleRunRecord[] = [];
  readonly runEvents: RunEventRecord[] = [];
  readonly artifacts: ArtifactRecord[] = [];

  async findModuleRunByExternalId(
    moduleId: ModuleId,
    externalRunId: string,
  ): Promise<ModuleRunRecord | null> {
    return (
      this.moduleRuns.find(
        (run) => run.moduleId === moduleId && run.externalRunId === externalRunId,
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

  async findModuleRunById(id: string): Promise<ModuleRunRecord | null> {
    return this.moduleRuns.find((run) => run.id === id) ?? null;
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

  async listRunArtifacts(moduleRunId: string): Promise<ArtifactRecord[]> {
    return this.artifacts.filter((artifact) => artifact.sourceRunId === moduleRunId);
  }
}

export async function createModuleRun(
  repository: ModuleRunRepository,
  input: CreateModuleRunInput,
): Promise<{ created: boolean; run: ModuleRunRecord }> {
  if (!isKnownModuleId(input.moduleId)) {
    throw new Error(`Unknown moduleId: ${input.moduleId}`);
  }

  const existing = await repository.findModuleRunByExternalId(
    input.moduleId,
    input.externalRunId,
  );

  if (existing) {
    const updated = await repository.updateModuleRun(existing.id, {
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
