import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const routesDir = path.join(repoRoot, "artifacts", "api-server", "src", "routes");
const openApiPath = path.join(repoRoot, "lib", "api-spec", "openapi.yaml");
const surfaceMatrixPath = path.join(repoRoot, "docs", "api-surface-matrix.md");

const methodNames = new Set(["get", "post", "put", "patch", "delete"]);

function normalizeExpressPath(routePath: string): string {
  return `/api${routePath}`.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function expressRoutes(): string[] {
  const routes: string[] = [];
  for (const filename of readdirSync(routesDir).sort()) {
    if (!filename.endsWith(".ts") || filename.endsWith(".test.ts")) continue;
    const source = readFileSync(path.join(routesDir, filename), "utf8");
    const matcher = /router\.(get|post|put|patch|delete)\("([^"]+)"/g;
    for (const match of source.matchAll(matcher)) {
      const [, method, routePath] = match;
      routes.push(`${method.toUpperCase()} ${normalizeExpressPath(routePath)}`);
    }
  }
  return routes.sort();
}

function openApiRoutes(): string[] {
  const spec = parse(readFileSync(openApiPath, "utf8")) as {
    paths: Record<string, Record<string, unknown>>;
  };
  const routes: string[] = [];
  for (const [routePath, pathItem] of Object.entries(spec.paths)) {
    for (const method of Object.keys(pathItem)) {
      if (methodNames.has(method)) {
        routes.push(`${method.toUpperCase()} /api${routePath}`);
      }
    }
  }
  return routes.sort();
}

describe("OpenAPI contract coverage", () => {
  it("documents every Express API route and only live Express routes", () => {
    assert.deepEqual(openApiRoutes(), expressRoutes());
  });

  it("keeps the API surface matrix aligned with the live route inventory", () => {
    const matrix = readFileSync(surfaceMatrixPath, "utf8");
    for (const route of expressRoutes()) {
      const [method, routePath] = route.split(" ");
      assert.ok(
        matrix.includes(`| ${method} | \`${routePath}\` |`),
        `${route} is missing from docs/api-surface-matrix.md`,
      );
    }
  });
});
