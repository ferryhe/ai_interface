import { Router, type IRouter } from "express";
import { GetSkillsResponse } from "@workspace/api-zod";

import {
  defaultSkillRuntimeRegistry,
  type SkillRuntimeRegistry,
} from "../skill-runtime/skill-runtime-registry";
import {
  listSkillReadiness,
} from "../skill-runtime/skill-manifest";

export function createSkillsRouter(
  registry: SkillRuntimeRegistry = defaultSkillRuntimeRegistry,
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
