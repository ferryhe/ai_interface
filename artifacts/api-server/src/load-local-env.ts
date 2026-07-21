import { existsSync } from "node:fs";
import path from "node:path";

const localEnvPath = path.resolve(import.meta.dirname, "../../../.env.local");

if (existsSync(localEnvPath)) {
  process.loadEnvFile?.(localEnvPath);
}
