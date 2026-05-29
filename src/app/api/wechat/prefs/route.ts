import { NextResponse } from "next/server";
import {
  countWorkPrefs,
  getWechatPrefsStore,
  patchWechatPrefsStore,
} from "@/lib/wechat-draft-prefs-store";
import type { WechatPrefsPatch } from "@/types/wechat-draft-prefs";

export async function GET() {
  try {
    const store = await getWechatPrefsStore();
    return NextResponse.json({
      store,
      workPrefsCount: countWorkPrefs(store),
    });
  } catch {
    return NextResponse.json({ error: "读取公众号偏好失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as WechatPrefsPatch;
    const store = await patchWechatPrefsStore(body);
    return NextResponse.json({
      store,
      workPrefsCount: countWorkPrefs(store),
    });
  } catch {
    return NextResponse.json({ error: "保存公众号偏好失败" }, { status: 500 });
  }
}
