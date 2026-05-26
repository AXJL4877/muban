import { parseApiErrorMessage } from "@/lib/ai-chat";
import { getGeminiModelSpec } from "@/lib/gemini-image-models";
import type { AiImageGenerationConfig, AiProviderId } from "@/types/ai";

export function resolveImagesGenerationsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (base.endsWith("/v1")) {
    return `${base}/images/generations`;
  }
  return `${base}/v1/images/generations`;
}

export function resolveGeminiGenerateContentUrl(
  baseUrl: string,
  model: string
): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (base.includes(":generateContent")) {
    return base;
  }
  if (/\/models\/[^/]+$/.test(base)) {
    return `${base}:generateContent`;
  }
  if (base.endsWith("/v1beta")) {
    return `${base}/models/${model}:generateContent`;
  }
  return `${base}/v1beta/models/${model}:generateContent`;
}

export interface ImageGenerationParams {
  providerId: AiProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  size: string;
  imageGeneration?: AiImageGenerationConfig;
}

export interface ImageGenerationResult {
  url?: string;
  b64Json?: string;
}

export async function callImageGeneration(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  if (params.providerId === "apiyi") {
    return callGeminiImageGeneration(params);
  }
  return callOpenAiImageGeneration(params);
}

async function callOpenAiImageGeneration(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  const url = resolveImagesGenerationsUrl(params.baseUrl);

  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    n: 1,
    size: params.size,
  };

  if (params.model.startsWith("dall-e-3")) {
    body.quality = "standard";
    body.response_format = "url";
  } else {
    body.response_format = "url";
  }

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
    data?: { url?: string; b64_json?: string }[];
  };

  const first = data.data?.[0];
  if (!first) {
    throw new Error("未返回图片数据");
  }

  return {
    url: first.url,
    b64Json: first.b64_json,
  };
}

type GeminiPart = {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
  fileData?: { fileUri?: string };
  file_data?: { file_uri?: string };
};

type GeminiGenerateResponse = {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
    finish_reason?: string;
  }[];
  promptFeedback?: {
    blockReason?: string;
    block_reason?: string;
  };
  prompt_feedback?: {
    block_reason?: string;
  };
  error?: { message?: string; code?: number; status?: string };
};

function parseGeminiApiError(status: number, errText: string): string {
  try {
    const errJson = JSON.parse(errText) as {
      error?: { message?: string };
    };
    if (errJson.error?.message) return errJson.error.message;
  } catch {
    /* fall through */
  }
  return parseApiErrorMessage(status, errText);
}

function extractImageFromGeminiResponse(
  data: GeminiGenerateResponse
): ImageGenerationResult | null {
  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.thought) continue;

      const inline = part.inlineData ?? part.inline_data;
      if (inline?.data) {
        return { b64Json: inline.data };
      }

      const fileUri = part.fileData?.fileUri ?? part.file_data?.file_uri;
      if (fileUri) {
        return { url: fileUri };
      }
    }
  }
  return null;
}

function describeGeminiEmptyResponse(data: GeminiGenerateResponse): string {
  const blockReason =
    data.promptFeedback?.blockReason ??
    data.promptFeedback?.block_reason ??
    data.prompt_feedback?.block_reason;
  if (blockReason) {
    return `内容被拦截：${blockReason}`;
  }

  const candidate = data.candidates?.[0];
  const finishReason =
    candidate?.finishReason ?? candidate?.finish_reason;
  if (finishReason && finishReason !== "STOP") {
    return `生成未完成：${finishReason}`;
  }

  const textParts =
    candidate?.content?.parts
      ?.filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join("") ?? "";
  if (textParts) {
    return `模型返回了文本而非图片：${textParts.slice(0, 120)}`;
  }

  return "未返回图片数据，请检查 API Key、模型权限或生图参数";
}

async function callGeminiImageGeneration(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  const url = resolveGeminiGenerateContentUrl(params.baseUrl, params.model);
  const imageCfg = params.imageGeneration;

  const aspectRatio =
    params.size.includes(":") ? params.size : imageCfg?.aspectRatio ?? "1:1";

  const spec = getGeminiModelSpec(params.model);
  const generationConfig: Record<string, unknown> = {
    responseModalities: imageCfg?.responseModalities ?? ["IMAGE"],
    imageConfig: {
      aspectRatio,
      imageSize: imageCfg?.imageSize ?? "1K",
    },
  };

  const thinkingLevel = imageCfg?.thinkingLevel ?? "minimal";
  const includeThoughts = imageCfg?.includeThoughts ?? false;
  if (
    spec?.supportsThinking &&
    (thinkingLevel === "High" || includeThoughts)
  ) {
    generationConfig.thinkingConfig = {
      thinkingLevel,
      includeThoughts,
    };
  }

  const body = {
    contents: [{ parts: [{ text: params.prompt }] }],
    generationConfig,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(parseGeminiApiError(res.status, rawText));
  }

  let data: GeminiGenerateResponse;
  try {
    data = JSON.parse(rawText) as GeminiGenerateResponse;
  } catch {
    throw new Error("API 返回了无法解析的响应");
  }

  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  const image = extractImageFromGeminiResponse(data);
  if (image) return image;

  throw new Error(describeGeminiEmptyResponse(data));
}

export function imageResultToPreviewSrc(result: ImageGenerationResult): string | null {
  if (result.url) return result.url;
  if (result.b64Json) return `data:image/png;base64,${result.b64Json}`;
  return null;
}
