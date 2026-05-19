import { Router, type IRouter } from "express";
import { GetToolAdaptersResponse } from "@workspace/api-zod";

import { getAdapterReadiness } from "../tool-adapters/adapter-registry";
import {
  defaultSkillRuntimeRegistry,
  type SkillRuntimeRegistry,
} from "../skill-runtime/skill-runtime-registry";

interface ToolAdaptersRouterOptions {
  pathExists?: (path: string) => boolean;
  cwd?: string;
}

export function createToolAdaptersRouter(
  registry: SkillRuntimeRegistry = defaultSkillRuntimeRegistry,
  env: Record<string, string | undefined> = process.env,
  options: ToolAdaptersRouterOptions = {},
): IRouter {
  const router: IRouter = Router();

  router.get("/tool-adapters", (_req, res) => {
    const adapters = registry.listAdapterDefinitions();
    const data = GetToolAdaptersResponse.parse({
      adapters,
      readiness: adapters.map((definition) =>
        getAdapterReadiness(definition, env, options),
      ),
    });
    res.json(data);
  });

  return router;
}

export default createToolAdaptersRouter();
