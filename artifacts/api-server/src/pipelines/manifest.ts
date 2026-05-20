import { readFile } from "node:fs/promises";
import { parse } from "yaml";

export interface ActuarialPipelineStepManifest {
  id: string;
  toolId: string;
  when?: string;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
}

export interface ActuarialPipelineManifest {
  pipelineId: string;
  version: string;
  artifactRoot: string;
  steps: ActuarialPipelineStepManifest[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function manifestError(path: string, message: string): Error {
  return new Error(`${message} in ${path}`);
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw manifestError(path, `Expected ${key} to be a non-empty string`);
  }
  return value;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw manifestError(path, `Expected ${key} to be a non-empty string`);
  }
  return value;
}

function stringMap(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Record<string, string> {
  const value = record[key];
  if (!isRecord(value)) {
    throw manifestError(path, `Expected ${key} to be an object`);
  }
  const entries = Object.entries(value);
  if (entries.some(([, item]) => typeof item !== "string" || item.trim() === "")) {
    throw manifestError(path, `Expected ${key} values to be non-empty strings`);
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

function normalizeStep(
  raw: unknown,
  index: number,
  path: string,
): ActuarialPipelineStepManifest {
  if (!isRecord(raw)) {
    throw manifestError(path, `Expected steps[${index}] to be an object`);
  }

  return {
    id: requiredString(raw, "id", path),
    toolId: requiredString(raw, "toolId", path),
    when: optionalString(raw, "when", path),
    inputs: stringMap(raw, "inputs", path),
    outputs: stringMap(raw, "outputs", path),
  };
}

export function parseActuarialPipelineManifest(
  source: string,
  path = "actuarial-pipeline.yaml",
): ActuarialPipelineManifest {
  const raw = parse(source) as unknown;
  if (!isRecord(raw)) {
    throw manifestError(path, "Expected manifest root to be an object");
  }

  const stepsRaw = raw["steps"];
  if (!Array.isArray(stepsRaw) || stepsRaw.length === 0) {
    throw manifestError(path, "Expected steps to be a non-empty array");
  }

  const steps = stepsRaw.map((step, index) => normalizeStep(step, index, path));
  const ids = new Set<string>();
  for (const step of steps) {
    if (ids.has(step.id)) {
      throw manifestError(path, `Duplicate step id: ${step.id}`);
    }
    ids.add(step.id);
  }

  return {
    pipelineId: requiredString(raw, "pipelineId", path),
    version: requiredString(raw, "version", path),
    artifactRoot: requiredString(raw, "artifactRoot", path),
    steps,
  };
}

export async function loadActuarialPipelineManifest(
  path: string,
): Promise<ActuarialPipelineManifest> {
  const source = await readFile(path, "utf8");
  return parseActuarialPipelineManifest(source, path);
}
