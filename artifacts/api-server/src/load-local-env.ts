import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.NODE_ENV !== "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const localEnvPath = path.resolve(__dirname, "../../../.env.local");
  if (existsSync(localEnvPath)) {
    process.loadEnvFile?.(localEnvPath);
  }
}
