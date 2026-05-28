import { NextResponse } from "next/server";
import { deleteDraft, getDraftDetail } from "@/lib/wechat-api";
import {
  getCredentialsFromBody,
  wechatErrorResponse,
} from "@/lib/wechat-api-route";

interface RouteContext {
  params: Promise<{ mediaId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { mediaId } = await context.params;
    const { searchParams } = new URL(request.url);
    const credentials = getCredentialsFromBody({
      appId: searchParams.get("appId") ?? undefined,
      appSecret: searchParams.get("appSecret") ?? undefined,
    });
    if (credentials instanceof NextResponse) return credentials;

    if (!mediaId?.trim()) {
      return NextResponse.json({ error: "缺少 mediaId" }, { status: 400 });
    }

    const detail = await getDraftDetail(credentials, mediaId.trim());
    return NextResponse.json({ newsItem: detail.news_item });
  } catch (err) {
    return wechatErrorResponse(err);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { mediaId } = await context.params;
    const body = (await request.json()) as {
      appId?: string;
      appSecret?: string;
    };

    const credentials = getCredentialsFromBody(body);
    if (credentials instanceof NextResponse) return credentials;

    if (!mediaId?.trim()) {
      return NextResponse.json({ error: "缺少 mediaId" }, { status: 400 });
    }

    await deleteDraft(credentials, mediaId.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return wechatErrorResponse(err);
  }
}
