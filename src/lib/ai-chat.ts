import { JSON_MAX_TOKENS } from "@/lib/ai-json-prompt";
import type { AiProviderId } from "@/types/ai";

export type ReasoningEffort = "low" | "medium" | "high";

export function resolveChatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (base.endsWith("/v1")) {
    return `${base}/chat/completions`;
  }
  if (base.includes("deepseek")) {
    return `${base}/chat/completions`;
  }
  return `${base}/v1/chat/completions`;
}

export interface ChatCompletionParams {
  providerId: AiProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt?: string;
  userMessage: string;
  structuredJson?: boolean;
  maxTokens?: number;
  stream?: boolean;
  thinkingEnabled?: boolean;
  reasoningEffort?: ReasoningEffort;
}

export function buildRequestBody(
  params: ChatCompletionParams
): Record<string, unknown> {
  const messages: { role: string; content: string }[] = [];
  if (params.systemPrompt) {
    messages.push({ role: "system", content: params.systemPrompt });
  }
  messages.push({ role: "user", content: params.userMessage });

  const body: Record<string, unknown> = {
    model: params.model,
    messages,
    temperature: params.temperature,
    stream: params.stream ?? false,
  };

  if (params.structuredJson) {
    body.max_tokens = params.maxTokens ?? JSON_MAX_TOKENS;
    body.response_format = { type: "json_object" };
  }

  if (
    params.providerId === "deepseek" &&
    params.thinkingEnabled
  ) {
    body.thinking = { type: "enabled" };
    body.reasoning_effort = params.reasoningEffort ?? "high";
  }

  return body;
}

export function parseApiErrorMessage(
  status: number,
  errText: string
): string {
  let message = `请求失败 (${status})`;
  try {
    const errJson = JSON.parse(errText) as {
      error?: { message?: string };
    };
    if (errJson.error?.message) message = errJson.error.message;
  } catch {
    if (errText) message = errText.slice(0, 300);
  }
  return message;
}

export async function callChatCompletion(
  params: ChatCompletionParams
): Promise<string> {
  const url = resolveChatCompletionsUrl(params.baseUrl);
  const body = buildRequestBody({ ...params, stream: false });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(parseApiErrorMessage(res.status, await res.text()));
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (content == null || content === "") {
    throw new Error("模型未返回有效内容");
  }
  return content.trim();
}

/** 服务端：向上游发起流式请求并返回原始 SSE 响应体 */
export async function fetchChatCompletionStream(
  params: ChatCompletionParams
): Promise<Response> {
  const url = resolveChatCompletionsUrl(params.baseUrl);
  const body = buildRequestBody({ ...params, stream: true });

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

export function extractJsonFromText(raw: string): string {
  let text = raw.trim();
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (block) text = block[1].trim();
  return text;
}

export function formatJsonPreview(text: string): {
  formatted: string;
  valid: boolean;
} {
  const raw = extractJsonFromText(text);
  try {
    const parsed = JSON.parse(raw);
    return { formatted: JSON.stringify(parsed, null, 2), valid: true };
  } catch {
    return { formatted: raw, valid: false };
  }
}
