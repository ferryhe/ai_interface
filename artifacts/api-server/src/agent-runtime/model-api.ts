import type {
  AgentEndpoint,
  AgentReasoningEffort,
} from "../agent-config/agent-config-service";

export interface ModelApiRequest {
  modelId: string;
  reasoningEffort: AgentReasoningEffort;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
}

export interface ModelApi {
  generateJson(request: ModelApiRequest): Promise<string>;
}

export interface OpenAICompatibleModelApiOptions {
  baseUrl: string;
  apiKey?: string;
  endpoint: Extract<AgentEndpoint, "responses" | "chat_completions">;
  supportsReasoningEffort: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function apiUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), normalizedBaseUrl).toString();
}

function extractOpenAIResponsesText(payload: unknown): string {
  const record = asRecord(payload);
  if (typeof record["output_text"] === "string") return record["output_text"];

  const output = record["output"];
  if (!Array.isArray(output)) return "";

  const fragments: string[] = [];
  for (const item of output) {
    const content = asRecord(item)["content"];
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const text = asRecord(part)["text"];
      if (typeof text === "string") fragments.push(text);
    }
  }
  return fragments.join("\n");
}

function extractChatCompletionsText(payload: unknown): string {
  const choices = asRecord(payload)["choices"];
  if (!Array.isArray(choices)) return "";
  const content = asRecord(asRecord(choices[0])["message"])["content"];
  return typeof content === "string" ? content : "";
}

function extractAnthropicText(payload: unknown): string {
  const content = asRecord(payload)["content"];
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => asRecord(part)["text"])
    .filter((text): text is string => typeof text === "string")
    .join("\n");
}

function extractOllamaText(payload: unknown): string {
  const record = asRecord(payload);
  const messageContent = asRecord(record["message"])["content"];
  if (typeof messageContent === "string") return messageContent;
  return typeof record["response"] === "string" ? record["response"] : "";
}

export class OpenAICompatibleModelApi implements ModelApi {
  constructor(
    private readonly options: OpenAICompatibleModelApiOptions,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async generateJson(request: ModelApiRequest): Promise<string> {
    const authorization = this.options.apiKey?.trim();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(authorization ? { authorization: `Bearer ${authorization}` } : {}),
    };

    if (this.options.endpoint === "responses") {
      const response = await this.fetchFn(apiUrl(this.options.baseUrl, "responses"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: request.modelId,
          reasoning:
            this.options.supportsReasoningEffort &&
            request.reasoningEffort !== "none"
              ? { effort: request.reasoningEffort }
              : undefined,
          input: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "agent_runtime_plan",
              schema: request.jsonSchema,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Model API request failed with status ${response.status}`);
      }
      return extractOpenAIResponsesText(await response.json());
    }

    const response = await this.fetchFn(
      apiUrl(this.options.baseUrl, "chat/completions"),
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: request.modelId,
          reasoning_effort:
            this.options.supportsReasoningEffort &&
            request.reasoningEffort !== "none"
              ? request.reasoningEffort
              : undefined,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "agent_runtime_plan",
              schema: request.jsonSchema,
            },
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Model API request failed with status ${response.status}`);
    }
    return extractChatCompletionsText(await response.json());
  }
}

export class AnthropicModelApi implements ModelApi {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async generateJson(request: ModelApiRequest): Promise<string> {
    const response = await this.fetchFn(apiUrl(this.baseUrl, "messages"), {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: request.modelId,
        max_tokens: 4096,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userPrompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Model API request failed with status ${response.status}`);
    }
    return extractAnthropicText(await response.json());
  }
}

export class OllamaModelApi implements ModelApi {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async generateJson(request: ModelApiRequest): Promise<string> {
    const response = await this.fetchFn(apiUrl(this.baseUrl, "api/chat"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: request.modelId,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Model API request failed with status ${response.status}`);
    }
    return extractOllamaText(await response.json());
  }
}
