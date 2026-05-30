import { Router, type IRouter } from "express";
import { GetSkillsResponse } from "@workspace/api-zod";

import {
  errorResponse,
  manifestWriteGuardError,
  redactManifestResponseValue,
  redactedErrorResponse,
  redactManifestString,
} from "./agent-manifests";
import {
  defaultSkillRuntimeRegistry,
  type SkillRuntimeRegistry,
} from "../skill-runtime/skill-runtime-registry";
import {
  listSkillReadiness,
  type SkillManifest,
} from "../skill-runtime/skill-manifest";
import {
  type WritableSkillManifest,
  writeSkillManifest,
} from "../skill-runtime/skill-manifest-writer";

export interface CreateSkillsRouterOptions {
  cwd?: string;
}

interface CreateSkillManifestBody {
  skillId?: unknown;
  manifest?: unknown;
  overwrite?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseCreateBody(body: unknown): {
  skillId: string;
  manifest: WritableSkillManifest;
  overwrite: boolean | undefined;
} {
  if (!isRecord(body)) {
    throw new Error("Expected JSON object body");
  }

  const input = body as CreateSkillManifestBody;
  if (typeof input.skillId !== "string") {
    throw new Error("Expected skillId to be a string");
  }
  if (!isRecord(input.manifest)) {
    throw new Error("Expected manifest to be an object");
  }
  if (
    input.overwrite !== undefined &&
    typeof input.overwrite !== "boolean"
  ) {
    throw new Error("Expected overwrite to be a boolean");
  }

  return {
    skillId: input.skillId,
    manifest: input.manifest as WritableSkillManifest,
    overwrite: input.overwrite,
  };
}

function validateWriteResponse(manifest: SkillManifest, path: string): {
  manifest: SkillManifest;
  path: string;
} {
  const parsed = GetSkillsResponse.parse({
    skills: [manifest],
    readiness: [],
  });
  return {
    manifest: redactManifestResponseValue(parsed.skills[0] as SkillManifest),
    path: redactManifestString(path),
  };
}

export function createSkillsRouter(
  registry: SkillRuntimeRegistry = defaultSkillRuntimeRegistry,
  env: Record<string, string | undefined> = process.env,
  pathExists?: (path: string) => boolean,
  options: CreateSkillsRouterOptions = {},
): IRouter {
  const router: IRouter = Router();

  router.get("/skills", (_req, res) => {
    const data = GetSkillsResponse.parse({
      skills: registry.listSkills(),
      readiness: listSkillReadiness(registry, { env, pathExists }),
    });
    res.json(data);
  });

  router.post("/skill-manifests", async (req, res) => {
    if (env.AI_INTERFACE_MANIFEST_WRITE_MODE !== "custom") {
      res
        .status(403)
        .json(
          errorResponse(
            "Skill manifest writes require AI_INTERFACE_MANIFEST_WRITE_MODE=custom",
          ),
        );
      return;
    }

    const guardError = manifestWriteGuardError(req);
    if (guardError) {
      res
        .status(403)
        .json(
          errorResponse(
            guardError.replaceAll("agent manifest", "skill manifest"),
          ),
        );
      return;
    }

    try {
      const body = parseCreateBody(req.body);
      const result = await writeSkillManifest({
        cwd: options.cwd,
        env,
        skillId: body.skillId,
        manifest: body.manifest,
        overwrite: body.overwrite,
      });
      res.status(201).json(validateWriteResponse(result.manifest, result.path));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json(redactedErrorResponse(message));
    }
  });

  return router;
}

export default createSkillsRouter();
