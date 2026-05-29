import type { WechatAnalyticsResponse } from "@/types/wechat-analytics";
import type { WechatSettingsStore } from "@/types/wechat";

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `请求失败 (${response.status})`);
  }
  return data;
}

export async function fetchWechatAnalytics(
  settings: WechatSettingsStore,
  beginDate: string,
  endDate: string
): Promise<WechatAnalyticsResponse> {
  const response = await fetch("/api/wechat/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appId: settings.appId,
      appSecret: settings.appSecret,
      beginDate,
      endDate,
    }),
  });
  return parseJson<WechatAnalyticsResponse>(response);
}
