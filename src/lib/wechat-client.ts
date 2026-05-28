import type {
  WechatCredentials,
  WechatDraftArticle,
  WechatDraftContentBlock,
  WechatDraftListItem,
  WechatSettingsStore,
} from "@/types/wechat";

function credentialsQuery(credentials: WechatCredentials): string {
  return new URLSearchParams({
    appId: credentials.appId,
    appSecret: credentials.appSecret,
  }).toString();
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `请求失败 (${response.status})`);
  }
  return data;
}

export async function testWechatConnection(
  settings: WechatSettingsStore
): Promise<void> {
  const response = await fetch("/api/wechat/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appId: settings.appId,
      appSecret: settings.appSecret,
    }),
  });
  await parseJson(response);
}

export async function uploadWechatMaterial(
  settings: WechatSettingsStore,
  imageSrc: string
): Promise<{ mediaId: string; url: string | null }> {
  const response = await fetch("/api/wechat/material", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appId: settings.appId,
      appSecret: settings.appSecret,
      imageSrc,
    }),
  });
  return parseJson(response);
}

export async function fetchWechatDraftList(
  settings: WechatSettingsStore,
  offset = 0,
  count = 10
): Promise<{
  total: number;
  items: WechatDraftListItem[];
}> {
  const qs = credentialsQuery({
    appId: settings.appId,
    appSecret: settings.appSecret,
  });
  const response = await fetch(
    `/api/wechat/draft?${qs}&offset=${offset}&count=${count}&noContent=1`
  );
  const data = await parseJson<{
    total: number;
    items: WechatDraftListItem[];
  }>(response);
  return { total: data.total, items: data.items ?? [] };
}

export async function createWechatDraftFromWork(
  settings: WechatSettingsStore,
  payload: {
    title: string;
    author?: string;
    digest?: string;
    content?: string;
    contentSourceUrl?: string;
    coverImageSrc: string;
    contentBlocks?: WechatDraftContentBlock[];
    contentImageSrcs?: string[];
  }
): Promise<{ mediaId: string; thumbMediaId: string }> {
  const response = await fetch("/api/wechat/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "fromWork",
      appId: settings.appId,
      appSecret: settings.appSecret,
      credentials: {
        appId: settings.appId,
        appSecret: settings.appSecret,
      },
      ...payload,
    }),
  });
  return parseJson(response);
}

export async function createWechatDraftWithArticles(
  settings: WechatSettingsStore,
  articles: WechatDraftArticle[]
): Promise<{ mediaId: string }> {
  const response = await fetch("/api/wechat/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appId: settings.appId,
      appSecret: settings.appSecret,
      articles,
    }),
  });
  return parseJson(response);
}

export async function deleteWechatDraft(
  settings: WechatSettingsStore,
  mediaId: string
): Promise<void> {
  const response = await fetch(
    `/api/wechat/draft/${encodeURIComponent(mediaId)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: settings.appId,
        appSecret: settings.appSecret,
      }),
    }
  );
  await parseJson(response);
}
