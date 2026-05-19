import { and, asc, eq, sql } from "drizzle-orm";
import {
  artifactsTable,
  db,
  moduleCatalogTable,
  moduleRunsTable,
  pipelineRunsTable,
  runEventsTable,
} from "@workspace/db";

import {
  type ArtifactRecord,
  type JsonObject,
  type ModuleRunRecord,
  type ModuleRunRepository,
  type RunEventRecord,
  type ModuleRunStatus,
  type RunEventSeverity,
  type ToolInteraction,
} from "./ingest-service";
import type { ModuleDefinition, ModuleId } from "./registry";
import {
  defaultSkillRuntimeRegistry,
  type SkillRuntimeRegistry,
} from "../skill-runtime/skill-runtime-registry";

type ModuleRunRow = typeof moduleRunsTable.$inferSelect;
type RunEventRow = typeof runEventsTable.$inferSelect;
type ArtifactRow = typeof artifactsTable.$inferSelect;

function firstOrThrow<T>(rows: T[], label: string): T {
  const [row] = rows;
  if (!row) {
    throw new Error(`${label} insert did not return a row`);
  }
  return row;
}

function mapModuleRun(row: ModuleRunRow): ModuleRunRecord {
  return {
    id: row.id,
    pipelineRunId: row.pipelineRunId,
    moduleId: row.moduleId as ModuleId,
    externalRunId: row.externalRunId,
    title: row.title,
    status: row.status as ModuleRunStatus,
    inputJson: row.inputJson as JsonObject | null,
    outputJson: row.outputJson as JsonObject | null,
    summary: row.summary,
    metadata: row.metadata as JsonObject | null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapRunEvent(row: RunEventRow): RunEventRecord {
  return {
    id: row.id,
    moduleRunId: row.moduleRunId,
    eventType: row.eventType,
    title: row.title,
    message: row.message,
    severity: row.severity as RunEventSeverity,
    payload: row.payload as JsonObject | null,
    createdAt: row.createdAt,
  };
}

function mapArtifact(row: ArtifactRow): ArtifactRecord {
  return {
    id: row.id,
    artifactKind: row.artifactKind,
    title: row.title,
    contentText: row.contentText,
    contentJson: row.contentJson as JsonObject | null,
    sourceModuleId: row.sourceModuleId as ModuleId,
    sourceRunId: row.sourceRunId,
    parentArtifactId: row.parentArtifactId,
    provenance: row.provenance as JsonObject | null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function resolveModuleCatalogDefinition(
  moduleId: ModuleId,
  registry: SkillRuntimeRegistry = defaultSkillRuntimeRegistry,
): ModuleDefinition {
  const definition = registry
    .listModuleDefinitions()
    .find((moduleDefinition) => moduleDefinition.moduleId === moduleId);
  if (!definition) {
    throw new Error(`Unknown moduleId: ${moduleId}`);
  }
  return definition;
}

export type ModuleCatalogWriter = (
  definition: ModuleDefinition,
) => Promise<void>;

export async function ensureModuleCatalogWithWriter(
  moduleId: ModuleId,
  registry: SkillRuntimeRegistry,
  writer: ModuleCatalogWriter,
): Promise<void> {
  await writer(resolveModuleCatalogDefinition(moduleId, registry));
}

async function ensureModuleCatalog(
  moduleId: ModuleId,
  registry: SkillRuntimeRegistry,
): Promise<void> {
  await ensureModuleCatalogWithWriter(moduleId, registry, async (definition) => {
    await db
      .insert(moduleCatalogTable)
      .values({
        moduleId: definition.moduleId,
        displayName: definition.displayName,
        description: definition.description,
        category: definition.category,
        outputSchema: { resultKinds: definition.resultKinds },
      })
      .onConflictDoUpdate({
        target: moduleCatalogTable.moduleId,
        set: {
          displayName: definition.displayName,
          description: definition.description,
          category: definition.category,
          outputSchema: { resultKinds: definition.resultKinds },
          updatedAt: new Date(),
        },
      });
  });
}

export class DbModuleRunRepository implements ModuleRunRepository {
  constructor(
    private readonly registry: SkillRuntimeRegistry = defaultSkillRuntimeRegistry,
  ) {}

  async findModuleRunByExternalId(
    moduleId: ModuleId,
    externalRunId: string,
  ): Promise<ModuleRunRecord | null> {
    const rows = await db
      .select()
      .from(moduleRunsTable)
      .where(
        and(
          eq(moduleRunsTable.moduleId, moduleId),
          eq(moduleRunsTable.externalRunId, externalRunId),
        ),
      )
      .limit(1);

    return rows[0] ? mapModuleRun(rows[0]) : null;
  }

  async createModuleRun(input: {
    pipelineRunId: string | null;
    moduleId: ModuleId;
    externalRunId: string;
    title: string | null;
    status: ModuleRunStatus;
    inputJson: JsonObject | null;
    outputJson: JsonObject | null;
    metadata: JsonObject | null;
  }): Promise<ModuleRunRecord> {
    await ensureModuleCatalog(input.moduleId, this.registry);

    const rows = await db
      .insert(moduleRunsTable)
      .values(input)
      .onConflictDoUpdate({
        target: [moduleRunsTable.moduleId, moduleRunsTable.externalRunId],
        set: {
          pipelineRunId: sql`coalesce(excluded.pipeline_run_id, ${moduleRunsTable.pipelineRunId})`,
          title: sql`coalesce(excluded.title, ${moduleRunsTable.title})`,
          status: input.status,
          inputJson: sql`coalesce(excluded.input_json, ${moduleRunsTable.inputJson})`,
          outputJson: sql`coalesce(excluded.output_json, ${moduleRunsTable.outputJson})`,
          metadata: sql`coalesce(excluded.metadata, ${moduleRunsTable.metadata})`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapModuleRun(firstOrThrow(rows, "module run"));
  }

  async updateModuleRun(
    id: string,
    input: {
      title?: string | null;
      status?: ModuleRunStatus;
      summary?: string | null;
      inputJson?: JsonObject | null;
      outputJson?: JsonObject | null;
      metadata?: JsonObject | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
    },
  ): Promise<ModuleRunRecord> {
    const rows = await db
      .update(moduleRunsTable)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(moduleRunsTable.id, id))
      .returning();

    return mapModuleRun(firstOrThrow(rows, "module run"));
  }

  async consumeResumableInteraction(
    id: string,
    interactionId: string,
    interaction: ToolInteraction,
  ): Promise<ModuleRunRecord | null> {
    const rows = await db
      .update(moduleRunsTable)
      .set({
        metadata: sql`jsonb_set(coalesce(${moduleRunsTable.metadata}, '{}'::jsonb), '{interaction}', ${JSON.stringify(interaction)}::jsonb, true)`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(moduleRunsTable.id, id),
          sql`${moduleRunsTable.metadata}->'interaction'->>'interactionId' = ${interactionId}`,
          sql`${moduleRunsTable.metadata}->'interaction'->>'status' = 'resumable'`,
        ),
      )
      .returning();

    return rows[0] ? mapModuleRun(rows[0]) : null;
  }

  async findModuleRunById(id: string): Promise<ModuleRunRecord | null> {
    const rows = await db
      .select()
      .from(moduleRunsTable)
      .where(eq(moduleRunsTable.id, id))
      .limit(1);

    return rows[0] ? mapModuleRun(rows[0]) : null;
  }

  async pipelineRunExists(id: string): Promise<boolean> {
    const rows = await db
      .select({ id: pipelineRunsTable.id })
      .from(pipelineRunsTable)
      .where(eq(pipelineRunsTable.id, id))
      .limit(1);

    return rows.length > 0;
  }

  async createRunEvent(input: {
    moduleRunId: string;
    eventType: string;
    title: string | null;
    message: string | null;
    severity: RunEventSeverity;
    payload: JsonObject | null;
  }): Promise<RunEventRecord> {
    const rows = await db.insert(runEventsTable).values(input).returning();
    return mapRunEvent(firstOrThrow(rows, "run event"));
  }

  async createArtifact(input: {
    artifactKind: string;
    title: string;
    contentText: string | null;
    contentJson: JsonObject | null;
    sourceModuleId: ModuleId;
    sourceRunId: string;
    parentArtifactId: string | null;
    provenance: JsonObject | null;
  }): Promise<ArtifactRecord> {
    await ensureModuleCatalog(input.sourceModuleId, this.registry);

    const rows = await db.insert(artifactsTable).values(input).returning();
    return mapArtifact(firstOrThrow(rows, "artifact"));
  }

  async findArtifactById(id: string): Promise<ArtifactRecord | null> {
    const rows = await db
      .select()
      .from(artifactsTable)
      .where(eq(artifactsTable.id, id))
      .limit(1);

    return rows[0] ? mapArtifact(rows[0]) : null;
  }

  async listRunEvents(moduleRunId: string): Promise<RunEventRecord[]> {
    const rows = await db
      .select()
      .from(runEventsTable)
      .where(eq(runEventsTable.moduleRunId, moduleRunId))
      .orderBy(asc(runEventsTable.createdAt));

    return rows.map(mapRunEvent);
  }

  async listRunArtifacts(moduleRunId: string): Promise<ArtifactRecord[]> {
    const rows = await db
      .select()
      .from(artifactsTable)
      .where(eq(artifactsTable.sourceRunId, moduleRunId))
      .orderBy(asc(artifactsTable.createdAt));

    return rows.map(mapArtifact);
  }
}
