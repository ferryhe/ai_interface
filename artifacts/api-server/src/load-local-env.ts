import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";

const localEnvPath = path.resolve(import.meta.dirname, "../../../.env.local");

if (existsSync(localEnvPath)) {
  loadEnvFile(localEnvPath);
}
