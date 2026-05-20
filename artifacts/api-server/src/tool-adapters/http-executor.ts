import type { ToolAdapterDefinition } from "./adapter-registry";
import type {
  ToolAdapterExecutor,
  ToolExecutionRequest,
  ToolExecutionResult,
} from "./executor";
import type { JsonObject } from "../modules/ingest-service";

function envValue(
  env: Record<string, string | undefined>,
  names: string[],
): string | null {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function secretValues(
  adapter: ToolAdapterDefinition,
  env: Record<string, string | undefined>,
): string[] {
  return [...adapter.requiredEnv, ...adapter.optionalEnv]
    .map((name) => env[name]?.trim())
    .filter((value): value is string => Boolean(value));
}

function redactText(value: string, secrets: string[]): string {
  let redacted = value;
  for (const secret of secrets) {
    if (secret) {
      redacted = redacted.split(secret).join("[redacted]");
    }
  }
  return redacted;
}

function redactJson<T>(value: T, secrets: string[]): T {
  if (typeof value === "string") {
    return redactText(value, secrets) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactJson(item, secrets)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactJson(item, secrets)]),
    ) as T;
  }
  return value;
}

function parseJsonBody(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function jsonObject(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return { value };
}

function isPrivateMetadataHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "169.254.169.254" ||
    host === "169.254.170.2" ||
    host === "metadata.google.internal" ||
    host === "metadata" ||
    host === "[fd00:ec2::254]"
  );
}

function isAbsoluteOrProtocolRelativePath(path: string): boolean {
  const trimmed = path.trimStart();
  return /^[a-z][a-z\d+.-]*:/i.test(trimmed) ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("\\\\");
}

function httpRejectedResult(input: {
  adapter: ToolAdapterDefinition;
  reason: string;
  message: string;
  externalRunId?: string | null;
}): ToolExecutionResult {
  return result({
    status: "failed",
    summary: `HTTP target is not allowed for ${input.adapter.adapterId}.`,
    eventType: "tool.execution.http_rejected",
    eventSeverity: "error",
    eventMessage: input.message,
    outputJson: null,
    eventPayload: {
      adapterId: input.adapter.adapterId,
      moduleId: input.adapter.moduleId,
      externalRunId: input.externalRunId,
      reason: input.reason,
    },
  });
}

function truncateText(text: string, maxBytes: number): {
  text: string;
  truncated: boolean;
} {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes <= maxBytes) return { text, truncated: false };
  return {
    text: Buffer.from(text, "utf8").subarray(0, maxBytes).toString("utf8"),
    truncated: true,
  };
}

async function readResponseText(
  response: Response,
  maxBytes: number,
): Promise<{
  text: string;
  truncated: boolean;
}> {
  const reader = response.body?.getReader();
  if (!reader) {
    return truncateText(await response.text(), maxBytes);
  }

  const chunks: Buffer[] = [];
  let capturedBytes = 0;
  let truncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = Buffer.from(value);
      const remaining = maxBytes - capturedBytes;
      if (remaining > 0) {
        const captured = chunk.subarray(0, remaining);
        chunks.push(captured);
        capturedBytes += captured.length;
      }

      if (chunk.length > remaining) {
        truncated = true;
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    text: Buffer.concat(chunks, capturedBytes).toString("utf8"),
    truncated,
  };
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Redirect rejection should not expose or depend on response body cleanup errors.
  }
}

function authorizationToken(
  adapter: ToolAdapterDefinition,
  env: Record<string, string | undefined>,
): string | null {
  const tokenEnv = adapter.optionalEnv.find((name) =>
    /(TOKEN|API_KEY|AUTHORIZATION|BEARER)/i.test(name),
  );
  return tokenEnv ? env[tokenEnv]?.trim() || null : null;
}

function result(input: {
  status: ToolExecutionResult["status"];
  summary: string;
  eventType: string;
  eventSeverity: ToolExecutionResult["eventSeverity"];
  eventMessage: string;
  outputJson: JsonObject | null;
  eventPayload: JsonObject;
}): ToolExecutionResult {
  return {
    status: input.status,
    summary: input.summary,
    outputJson: input.outputJson,
    eventType: input.eventType,
    eventTitle: input.summary,
    eventMessage: input.eventMessage,
    eventSeverity: input.eventSeverity,
    eventPayload: input.eventPayload,
  };
}

export class HttpToolAdapterExecutor implements ToolAdapterExecutor {
  constructor(
    private readonly env: Record<string, string | undefined> = process.env,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async execute({
    run,
    adapter,
  }: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const baseUrlValue = envValue(this.env, adapter.requiredEnv);
    const secrets = secretValues(adapter, this.env);
    if (!baseUrlValue) {
      return result({
        status: "failed",
        summary: `HTTP base URL is not configured for ${adapter.adapterId}.`,
        eventType: "tool.execution.http_configuration_failed",
        eventSeverity: "error",
        eventMessage: "HTTP base URL env is missing.",
        outputJson: null,
        eventPayload: {
          adapterId: adapter.adapterId,
          moduleId: adapter.moduleId,
          missingRequiredEnv: [...adapter.requiredEnv],
        },
      });
    }

    let url: URL;
    try {
      url = new URL(baseUrlValue);
    } catch {
      return result({
        status: "failed",
        summary: `HTTP base URL is invalid for ${adapter.adapterId}.`,
        eventType: "tool.execution.http_configuration_failed",
        eventSeverity: "error",
        eventMessage: "HTTP base URL env is invalid.",
        outputJson: null,
        eventPayload: {
          adapterId: adapter.adapterId,
          moduleId: adapter.moduleId,
        },
      });
    }

    if (
      isPrivateMetadataHost(url.hostname) &&
      this.env["AI_INTERFACE_HTTP_EXECUTOR_ALLOW_PRIVATE_METADATA"] !== "1"
    ) {
      return httpRejectedResult({
        adapter,
        reason: "private_metadata_endpoint",
        message: "HTTP metadata endpoint was rejected.",
      });
    }

    const input = run.inputJson ?? {};
    const method =
      typeof input["method"] === "string"
        ? input["method"].toUpperCase()
        : "POST";
    const path = typeof input["path"] === "string" ? input["path"] : "";
    if (isAbsoluteOrProtocolRelativePath(path)) {
      return httpRejectedResult({
        adapter,
        reason: "absolute_path_override",
        message: "HTTP request path must be relative to the configured base URL.",
        externalRunId: run.externalRunId,
      });
    }

    const requestUrl = new URL(path, url);
    if (requestUrl.origin !== url.origin) {
      return httpRejectedResult({
        adapter,
        reason: "origin_mismatch",
        message: "HTTP request URL left the configured base origin.",
        externalRunId: run.externalRunId,
      });
    }
    if (
      isPrivateMetadataHost(requestUrl.hostname) &&
      this.env["AI_INTERFACE_HTTP_EXECUTOR_ALLOW_PRIVATE_METADATA"] !== "1"
    ) {
      return httpRejectedResult({
        adapter,
        reason: "private_metadata_endpoint",
        message: "HTTP metadata endpoint was rejected.",
        externalRunId: run.externalRunId,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), adapter.timeoutMs);
    const token = authorizationToken(adapter, this.env);
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (token && requestUrl.origin === url.origin) {
      headers.authorization = /^bearer\s+/i.test(token)
        ? token
        : `Bearer ${token}`;
    }

    try {
      const response = await this.fetchFn(requestUrl, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(input),
        redirect: "manual",
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        await cancelResponseBody(response);
        clearTimeout(timeout);
        return httpRejectedResult({
          adapter,
          reason: "redirect_rejected",
          message: "HTTP redirects are not followed by the executor.",
          externalRunId: run.externalRunId,
        });
      }

      const truncated = await readResponseText(response, adapter.maxOutputBytes);
      clearTimeout(timeout);
      const parsed = redactJson(parseJsonBody(truncated.text), secrets);
      const statusCode = response.status;
      const eventPayload = redactJson(
        {
          adapterId: adapter.adapterId,
          moduleId: adapter.moduleId,
          externalRunId: run.externalRunId,
          statusCode,
          responseBody: parsed,
          responseTruncated: truncated.truncated,
        },
        secrets,
      );

      if (response.ok) {
        return result({
          status: "succeeded",
          summary: `HTTP execution completed for ${adapter.adapterId}.`,
          eventType: "tool.execution.http_completed",
          eventSeverity: "info",
          eventMessage: `HTTP ${adapter.moduleId} adapter execution completed.`,
          outputJson: jsonObject(parsed),
          eventPayload,
        });
      }

      return result({
        status: "failed",
        summary: `HTTP execution failed for ${adapter.adapterId}.`,
        eventType: "tool.execution.http_failed",
        eventSeverity: "error",
        eventMessage: `HTTP adapter returned status ${statusCode}.`,
        outputJson: redactJson(
          {
            statusCode,
            body: parsed,
          },
          secrets,
        ),
        eventPayload,
      });
    } catch (error) {
      clearTimeout(timeout);
      const timedOut =
        error instanceof Error && error.name === "AbortError";
      return result({
        status: "failed",
        summary: timedOut
          ? `HTTP execution timed out for ${adapter.adapterId}.`
          : `HTTP execution failed for ${adapter.adapterId}.`,
        eventType: timedOut
          ? "tool.execution.http_timeout"
          : "tool.execution.http_failed",
        eventSeverity: timedOut ? "warning" : "error",
        eventMessage: redactText(
          error instanceof Error ? error.message : "HTTP request failed.",
          secrets,
        ),
        outputJson: null,
        eventPayload: {
          adapterId: adapter.adapterId,
          moduleId: adapter.moduleId,
          externalRunId: run.externalRunId,
        },
      });
    }
  }
}
