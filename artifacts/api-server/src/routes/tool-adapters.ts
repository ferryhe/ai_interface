import { Router, type IRouter } from "express";
import { GetToolAdaptersResponse } from "@workspace/api-zod";

import {
  adapterDefinitions,
  listAdapterReadiness,
} from "../tool-adapters/adapter-registry";

const router: IRouter = Router();

router.get("/tool-adapters", (_req, res) => {
  const data = GetToolAdaptersResponse.parse({
    adapters: adapterDefinitions,
    readiness: listAdapterReadiness(process.env),
  });
  res.json(data);
});

export default router;
