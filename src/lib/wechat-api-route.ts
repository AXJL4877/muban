import { NextResponse } from "next/server";
import { WechatApiError } from "@/lib/wechat-api";
import { validateWechatCredentials } from "@/lib/wechat-credentials";
import { formatWechatApiError } from "@/lib/wechat-error-hints";
import { resolveWechatCredentials } from "@/lib/wechat-settings";
import type { WechatCredentials } from "@/types/wechat";

interface CredentialBody {
  appId?: string;
  appSecret?: string;
}

export function getCredentialsFromBody(
  body: CredentialBody | null | undefined
): WechatCredentials | NextResponse {
  const credentials = resolveWechatCredentials(body ?? undefined);
  if (!credentials) {
    return NextResponse.json(
      {
        error:
          "请配置公众号 AppID 与 AppSecret（页面设置或环境变量 WECHAT_APP_ID / WECHAT_APP_SECRET）",
      },
      { status: 400 }
    );
  }
  const formatError = validateWechatCredentials(
    credentials.appId,
    credentials.appSecret
  );
  if (formatError) {
    return NextResponse.json({ error: formatError }, { status: 400 });
  }
  return credentials;
}

export function wechatErrorResponse(err: unknown): NextResponse {
  if (err instanceof WechatApiError) {
    return NextResponse.json(
      {
        error: formatWechatApiError(err.errcode, err.message.replace(/^微信接口错误 \(\d+\): /, "")),
        errcode: err.errcode,
      },
      { status: 502 }
    );
  }
  const message = err instanceof Error ? err.message : "微信公众号接口调用失败";
  return NextResponse.json({ error: message }, { status: 500 });
}
