import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/wechat-api";
import {
  getCredentialsFromBody,
  wechatErrorResponse,
} from "@/lib/wechat-api-route";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { appId?: string; appSecret?: string };
    const credentials = getCredentialsFromBody(body);
    if (credentials instanceof NextResponse) return credentials;

    await getAccessToken(credentials);
    return NextResponse.json({ ok: true, message: "access_token 获取成功" });
  } catch (err) {
    return wechatErrorResponse(err);
  }
}
