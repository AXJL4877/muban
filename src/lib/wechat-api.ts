import type {
  WechatAccessTokenResult,
  WechatApiErrorBody,
  WechatCredentials,
  WechatDraftAddResult,
  WechatDraftArticle,
  WechatDraftBatchGetResult,
  WechatDraftCountResult,
  WechatDraftGetResult,
  WechatMaterialUploadResult,
} from "@/types/wechat";

const WECHAT_API_BASE = "https://api.weixin.qq.com/cgi-bin";

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenCacheEntry>();

function cacheKey(credentials: WechatCredentials): string {
  return `${credentials.appId}:${credentials.appSecret}`;
}

export class WechatApiError extends Error {
  errcode: number;

  constructor(errcode: number, errmsg: string) {
    super(`微信接口错误 (${errcode}): ${errmsg}`);
    this.name = "WechatApiError";
    this.errcode = errcode;
  }
}

async function parseWechatJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & WechatApiErrorBody;
  if (
    typeof data === "object" &&
    data !== null &&
    "errcode" in data &&
    typeof data.errcode === "number" &&
    data.errcode !== 0
  ) {
    throw new WechatApiError(data.errcode, data.errmsg ?? "未知错误");
  }
  return data;
}

export async function getAccessToken(
  credentials: WechatCredentials,
  forceRefresh = false
): Promise<string> {
  const key = cacheKey(credentials);
  const cached = tokenCache.get(key);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const url = new URL(`${WECHAT_API_BASE}/token`);
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", credentials.appId);
  url.searchParams.set("secret", credentials.appSecret);

  const response = await fetch(url.toString());
  const data = await parseWechatJson<WechatAccessTokenResult>(response);

  const expiresAt = Date.now() + Math.max(data.expires_in - 300, 60) * 1000;
  tokenCache.set(key, { token: data.access_token, expiresAt });
  return data.access_token;
}

/** 永久素材上传（图片），用于草稿封面 thumb_media_id */
export async function uploadPermanentImageMaterial(
  credentials: WechatCredentials,
  imageBuffer: Buffer,
  filename = "image.jpg"
): Promise<WechatMaterialUploadResult> {
  const accessToken = await getAccessToken(credentials);
  const form = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" });
  form.append("media", blob, filename);

  const url = `${WECHAT_API_BASE}/material/add_material?access_token=${encodeURIComponent(accessToken)}&type=image`;
  const response = await fetch(url, { method: "POST", body: form });
  return parseWechatJson<WechatMaterialUploadResult>(response);
}

/** 正文内图片上传，返回可写入 HTML 的 URL */
export async function uploadArticleContentImage(
  credentials: WechatCredentials,
  imageBuffer: Buffer,
  filename = "content.jpg"
): Promise<{ url: string }> {
  const accessToken = await getAccessToken(credentials);
  const form = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" });
  form.append("media", blob, filename);

  const url = `${WECHAT_API_BASE}/media/uploadimg?access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url, { method: "POST", body: form });
  return parseWechatJson<{ url: string }>(response);
}

export async function deletePermanentMaterial(
  credentials: WechatCredentials,
  mediaId: string
): Promise<void> {
  const accessToken = await getAccessToken(credentials);
  const response = await fetch(
    `${WECHAT_API_BASE}/material/del_material?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: mediaId }),
    }
  );
  await parseWechatJson<{ errcode: number; errmsg: string }>(response);
}

export async function addDraft(
  credentials: WechatCredentials,
  articles: WechatDraftArticle[]
): Promise<WechatDraftAddResult> {
  const accessToken = await getAccessToken(credentials);
  const response = await fetch(
    `${WECHAT_API_BASE}/draft/add?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles }),
    }
  );
  return parseWechatJson<WechatDraftAddResult>(response);
}

export async function batchGetDrafts(
  credentials: WechatCredentials,
  offset: number,
  count: number,
  noContent = 1
): Promise<WechatDraftBatchGetResult> {
  const accessToken = await getAccessToken(credentials);
  const response = await fetch(
    `${WECHAT_API_BASE}/draft/batchget?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offset, count, no_content: noContent }),
    }
  );
  return parseWechatJson<WechatDraftBatchGetResult>(response);
}

export async function getDraftDetail(
  credentials: WechatCredentials,
  mediaId: string
): Promise<WechatDraftGetResult> {
  const accessToken = await getAccessToken(credentials);
  const response = await fetch(
    `${WECHAT_API_BASE}/draft/get?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: mediaId }),
    }
  );
  return parseWechatJson<WechatDraftGetResult>(response);
}

export async function getDraftCount(
  credentials: WechatCredentials
): Promise<WechatDraftCountResult> {
  const accessToken = await getAccessToken(credentials);
  const response = await fetch(
    `${WECHAT_API_BASE}/draft/count?access_token=${encodeURIComponent(accessToken)}`
  );
  return parseWechatJson<WechatDraftCountResult>(response);
}

export async function deleteDraft(
  credentials: WechatCredentials,
  mediaId: string
): Promise<void> {
  const accessToken = await getAccessToken(credentials);
  const response = await fetch(
    `${WECHAT_API_BASE}/draft/delete?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: mediaId }),
    }
  );
  await parseWechatJson<{ errcode: number; errmsg: string }>(response);
}

export function dataUrlToBuffer(dataUrl: string): {
  buffer: Buffer;
  mime: string;
  ext: string;
} {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("无效的图片 data URL");
  }
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return { buffer, mime, ext };
}

export async function fetchImageBuffer(
  src: string
): Promise<{ buffer: Buffer; ext: string }> {
  if (src.startsWith("data:")) {
    const { buffer, ext } = dataUrlToBuffer(src);
    return { buffer, ext };
  }
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  return { buffer: Buffer.from(arrayBuffer), ext };
}
