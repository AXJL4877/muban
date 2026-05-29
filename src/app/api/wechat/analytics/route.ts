import { NextResponse } from "next/server";
import {
  buildAnalyticsResponse,
  enumerateDates,
  validateAnalyticsDateRange,
} from "@/lib/wechat-analytics";
import {
  getCredentialsFromBody,
  wechatErrorResponse,
} from "@/lib/wechat-api-route";
import {
  getArticleRead,
  getUserCumulate,
  getUserSummary,
} from "@/lib/wechat-datacube";
import type { WechatArticleReadItem } from "@/types/wechat-analytics";

interface AnalyticsRequestBody {
  appId?: string;
  appSecret?: string;
  beginDate?: string;
  endDate?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyticsRequestBody;
    const credentials = getCredentialsFromBody(body);
    if (credentials instanceof NextResponse) return credentials;

    const beginDate = body.beginDate?.trim() ?? "";
    const endDate = body.endDate?.trim() ?? "";
    const rangeError = validateAnalyticsDateRange(beginDate, endDate);
    if (rangeError) {
      return NextResponse.json({ error: rangeError }, { status: 400 });
    }

    const range = { begin_date: beginDate, end_date: endDate };

    const [userSummary, userCumulate] = await Promise.all([
      getUserSummary(credentials, range),
      getUserCumulate(credentials, range),
    ]);

    const dates = enumerateDates(beginDate, endDate);
    const articleResults = await Promise.all(
      dates.map((date) => getArticleRead(credentials, date))
    );

    const articleReads: WechatArticleReadItem[] = [];
    let isArticleDataDelayed = false;
    for (const result of articleResults) {
      articleReads.push(...(result.list ?? []));
      if (result.is_delay === true || result.is_delay === "true") {
        isArticleDataDelayed = true;
      }
    }

    const data = buildAnalyticsResponse(
      beginDate,
      endDate,
      userSummary.list,
      userCumulate.list,
      articleReads,
      isArticleDataDelayed
    );

    return NextResponse.json(data);
  } catch (err) {
    return wechatErrorResponse(err);
  }
}
