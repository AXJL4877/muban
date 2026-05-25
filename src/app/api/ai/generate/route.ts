import { NextResponse } from "next/server";
import {
  buildSystemMessageFromTemplateKeys,
  buildUserMessage,
} from "@/lib/ai-json-prompt";
import {
  callChatCompletion,
  fetchChatCompletionStream,
  parseApiErrorMessage,
} from "@/lib/ai-chat";
import type { ReasoningEffort } from "@/lib/ai-chat";
import { getEnabledKeys, validateKeyConfigs } from "@/lib/ai-template-keys";
import type { AiProviderId } from "@/types/ai";
import type { TemplateJsonKeyPayload } from "@/types/ai-template-keys";
import type { TemplateJsonKeyConfig } from "@/types/ai-template-keys";

interface GenerateBody {
  topic?: string;
  templateKeys?: TemplateJsonKeyPayload[];
  structuredJson?: boolean;
  stream?: boolean;
  thinkingEnabled?: boolean;
  reasoningEffort?: ReasoningEffort;
  providerId?: AiProviderId;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
}

function payloadToConfigs(
  payloads: TemplateJsonKeyPayload[]
): TemplateJsonKeyConfig[] {
  return payloads.map((p, i) => ({
    key: p.key,
    elementIndex: i,
    label: p.label,
    enabled: p.enabled,
    instruction: p.instruction ?? "",
    maxChars: p.maxChars,
    minChars: p.minChars,
  }));
}

function buildChatParams(body: GenerateBody) {
  const {
    topic = "",
    templateKeys = [],
    structuredJson = true,
    stream = false,
    thinkingEnabled = false,
    reasoningEffort = "high",
    providerId,
    model,
    apiKey,
    baseUrl,
    temperature = 0.7,
  } = body;

  const configs = payloadToConfigs(templateKeys);
  const enabled = getEnabledKeys(configs);
  const system = buildSystemMessageFromTemplateKeys(configs, structuredJson);
  const userMessage = buildUserMessage(
    topic,
    structuredJson,
    enabled.length > 0
  );

  return {
    providerId: providerId!,
    baseUrl: baseUrl!.trim(),
    apiKey: apiKey!.trim(),
    model: model!,
    temperature,
    structuredJson,
    stream,
    thinkingEnabled,
    reasoningEffort,
    systemPrompt: system,
    userMessage,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateBody;
    const { templateKeys = [], providerId, model, apiKey, baseUrl } = body;

    const configs = payloadToConfigs(templateKeys);
    const keyError = validateKeyConfigs(configs);
    if (keyError) {
      return NextResponse.json({ error: keyError }, { status: 400 });
    }

    if (!providerId || !model) {
      return NextResponse.json(
        { error: "请选择模型" },
        { status: 400 }
      );
    }
    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "请先在 AI 设置中配置并保存 API Key" },
        { status: 400 }
      );
    }
    if (!baseUrl?.trim()) {
      return NextResponse.json(
        { error: "请先在 AI 设置中配置 API 地址" },
        { status: 400 }
      );
    }

    const params = buildChatParams(body);

    if (body.stream) {
      const upstream = await fetchChatCompletionStream(params);
      if (!upstream.ok) {
        const errText = await upstream.text();
        return NextResponse.json(
          { error: parseApiErrorMessage(upstream.status, errText) },
          { status: upstream.status }
        );
      }
      if (!upstream.body) {
        return NextResponse.json(
          { error: "上游未返回流式数据" },
          { status: 502 }
        );
      }

      return new Response(upstream.body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const content = await callChatCompletion(params);
    return NextResponse.json({ content });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "生成失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
