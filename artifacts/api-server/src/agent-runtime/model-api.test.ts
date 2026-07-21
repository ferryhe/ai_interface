import assert from "node:assert/strict";
import test from "node:test";

import { OpenAICompatibleModelApi } from "./model-api";

const request = {
  modelId: "local-model:latest",
  reasoningEffort: "none" as const,
  systemPrompt: "Return JSON.",
  userPrompt: "Plan this task.",
  jsonSchema: {
    type: "object",
    properties: { summary: { type: "string" } },
    required: ["summary"],
  },
};

test("OpenAI-compatible model API uses configured base URL and model", async () => {
  const calls: Array<{
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }> = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return new Response(
      JSON.stringify({ choices: [{ message: { content: '{"summary":"ok"}' } }] }),
      { status: 200 },
    );
  }) as typeof fetch;

  const api = new OpenAICompatibleModelApi(
    {
      baseUrl: "http://127.0.0.1:9000/custom/v1",
      endpoint: "chat_completions",
      supportsReasoningEffort: false,
    },
    fetchFn,
  );

  const result = await api.generateJson(request);

  assert.equal(result, '{"summary":"ok"}');
  assert.equal(calls[0]?.url, "http://127.0.0.1:9000/custom/v1/chat/completions");
  assert.equal(calls[0]?.body["model"], "local-model:latest");
  assert.equal(calls[0]?.headers["authorization"], undefined);
  const responseFormat = calls[0]?.body["response_format"] as {
    json_schema: { strict?: boolean };
  };
  assert.equal(responseFormat.json_schema.strict, undefined);
});

test("Responses model API uses configured credentials without exposing them", async () => {
  const calls: Array<{
    url: string;
    headers: Record<string, string>;
  }> = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      headers: init?.headers as Record<string, string>,
    });
    return new Response(JSON.stringify({ output_text: '{"summary":"ok"}' }), {
      status: 200,
    });
  }) as typeof fetch;

  const api = new OpenAICompatibleModelApi(
    {
      baseUrl: "https://models.example.test/v1/",
      apiKey: "test-secret",
      endpoint: "responses",
      supportsReasoningEffort: true,
    },
    fetchFn,
  );

  await api.generateJson(request);

  assert.equal(calls[0]?.url, "https://models.example.test/v1/responses");
  assert.equal(calls[0]?.headers["authorization"], "Bearer test-secret");
});
