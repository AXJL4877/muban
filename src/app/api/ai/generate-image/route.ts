import { NextResponse } from "next/server";
import { callImageGeneration } from "@/lib/ai-image-generate";
import type { AiImageGenerationConfig, AiProviderId } from "@/types/ai";

interface GenerateImageBody {
  prompt?: string;
  size?: string;
  providerId?: AiProviderId;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  imageGeneration?: AiImageGenerationConfig;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateImageBody;
    const {
      prompt = "",
      size = "1024x1024",
      providerId,
      model,
      apiKey,
      baseUrl,
      imageGeneration,
    } = body;

    if (!prompt.trim()) {
      return NextResponse.json({ error: "请输入提示词" }, { status: 400 });
    }
    if (!providerId || !model) {
      return NextResponse.json({ error: "请选择模型" }, { status: 400 });
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

    const result = await callImageGeneration({
      providerId,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      model,
      prompt: prompt.trim(),
      size,
      imageGeneration,
    });

    return NextResponse.json({
      url: result.url ?? null,
      b64Json: result.b64Json ?? null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "图片生成失败，请稍后重试";
    if (process.env.NODE_ENV === "development") {
      console.error("[generate-image]", message, err);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
