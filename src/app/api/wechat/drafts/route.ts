import { NextResponse } from "next/server";
import { batchGetDrafts, getDraftCount } from "@/lib/wechat-api";
import {
  getCredentialsFromBody,
  wechatErrorResponse,
} from "@/lib/wechat-api-route";

interface DraftListBody {
  appId?: string;
  appSecret?: string;
  offset?: number;
  count?: number;
  noContent?: number;
}

/** 查询草稿列表（凭证放 body，避免出现在 URL） */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DraftListBody;
    const credentials = getCredentialsFromBody(body);
    if (credentials instanceof NextResponse) return credentials;

    const offset = Math.max(0, Number(body.offset ?? 0) || 0);
    const count = Math.min(20, Math.max(1, Number(body.count ?? 10) || 10));
    const noContent = body.noContent === 0 ? 0 : 1;

    const [list, countResult] = await Promise.all([
      batchGetDrafts(credentials, offset, count, noContent),
      getDraftCount(credentials),
    ]);

    return NextResponse.json({
      total: countResult.total_count,
      offset,
      count,
      items: list.item ?? [],
      itemCount: list.item_count,
    });
  } catch (err) {
    return wechatErrorResponse(err);
  }
}
