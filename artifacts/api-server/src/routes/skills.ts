import { Router, type IRouter } from "express";
import { GetSkillsResponse } from "@workspace/api-zod";

import {
  createSkillManifestRegistry,
  listSkillReadiness,
  type SkillManifestRegistry,
} from "../skill-runtime/skill-manifest";

export function createSkillsRouter(
  registry: SkillManifestRegistry = createSkillManifestRegistry(),
  env: Record<string, string | undefined> = process.env,
  pathExists?: (path: string) => boolean,
): IRouter {
  const router: IRouter = Router();

  router.get("/skills", (_req, res) => {
    const data = GetSkillsResponse.parse({
      skills: registry.listSkills(),
      readiness: listSkillReadiness(registry, { env, pathExists }),
    });
    res.json(data);
  });

  return router;
}

export default createSkillsRouter();
