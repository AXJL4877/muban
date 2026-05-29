import { parseWechatJson, withWechatAccessToken } from "@/lib/wechat-api";
import type { WechatCredentials } from "@/types/wechat";
import type {
  WechatArticleReadResult,
  WechatDatacubeDateRange,
  WechatUserCumulateResult,
  WechatUserSummaryResult,
} from "@/types/wechat-analytics";

const DATACUBE_BASE = "https://api.weixin.qq.com/datacube";

async function postDatacube<T>(
  credentials: WechatCredentials,
  path: string,
  body: WechatDatacubeDateRange
): Promise<T> {
  return withWechatAccessToken(credentials, async (accessToken) => {
    const response = await fetch(
      `${DATACUBE_BASE}/${path}?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    return parseWechatJson<T>(response);
  });
}

/** 获取用户增减数据，日期跨度最大 7 天 */
export async function getUserSummary(
  credentials: WechatCredentials,
  range: WechatDatacubeDateRange
): Promise<WechatUserSummaryResult> {
  const data = await postDatacube<WechatUserSummaryResult & { errcode?: number }>(
    credentials,
    "getusersummary",
    range
  );
  return { list: data.list ?? [] };
}

/** 获取累计用户数据，日期跨度最大 7 天 */
export async function getUserCumulate(
  credentials: WechatCredentials,
  range: WechatDatacubeDateRange
): Promise<WechatUserCumulateResult> {
  const data = await postDatacube<WechatUserCumulateResult & { errcode?: number }>(
    credentials,
    "getusercumulate",
    range
  );
  return { list: data.list ?? [] };
}

/** 获取发表内容每日阅读数据，日期范围仅支持 1 天 */
export async function getArticleRead(
  credentials: WechatCredentials,
  date: string
): Promise<WechatArticleReadResult> {
  const data = await postDatacube<WechatArticleReadResult & { errcode?: number }>(
    credentials,
    "getarticleread",
    { begin_date: date, end_date: date }
  );
  return {
    list: data.list ?? [],
    is_delay: data.is_delay,
  };
}

