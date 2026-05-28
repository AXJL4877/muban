import { NextResponse } from "next/server";
import {
  addDraft,
  batchGetDrafts,
  getDraftCount,
} from "@/lib/wechat-api";
import { createDraftFromWork } from "@/lib/wechat-draft-from-work";
import {
  getCredentialsFromBody,
  wechatErrorResponse,
} from "@/lib/wechat-api-route";
import type { CreateDraftFromWorkPayload, WechatDraftArticle } from "@/types/wechat";

interface DraftListQuery {
  appId?: string;
  appSecret?: string;
  offset?: string;
  count?: string;
  noContent?: string;
}

interface DraftAddBody {
  appId?: string;
  appSecret?: string;
  articles: WechatDraftArticle[];
}

interface DraftFromWorkBody extends CreateDraftFromWorkPayload {
  mode?: "fromWork";
  appId?: string;
  appSecret?: string;
}

type DraftPostBody = DraftAddBody | DraftFromWorkBody;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query: DraftListQuery = {
      appId: searchParams.get("appId") ?? undefined,
      appSecret: searchParams.get("appSecret") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      count: searchParams.get("count") ?? undefined,
      noContent: searchParams.get("noContent") ?? undefined,
    };

    const credentials = getCredentialsFromBody(query);
    if (credentials instanceof NextResponse) return credentials;

    const offset = Math.max(0, Number(query.offset ?? 0) || 0);
    const count = Math.min(20, Math.max(1, Number(query.count ?? 10) || 10));
    const noContent = query.noContent === "0" ? 0 : 1;

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

/** 新增草稿：支持直接传 articles，或 fromWork 模式（先上传素材再建草稿） */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DraftPostBody;

    const credentials = getCredentialsFromBody(body);
    if (credentials instanceof NextResponse) return credentials;

    if ("mode" in body && body.mode === "fromWork") {
      const workBody = body as CreateDraftFromWorkPayload;
      if (!workBody.title?.trim()) {
        return NextResponse.json({ error: "请填写标题" }, { status: 400 });
      }
      if (!workBody.coverImageSrc?.trim()) {
        return NextResponse.json({ error: "请提供封面图" }, { status: 400 });
      }
      const result = await createDraftFromWork({
        ...workBody,
        credentials,
      });
      return NextResponse.json(result);
    }

    const addBody = body as DraftAddBody;
    if (!addBody.articles?.length) {
      return NextResponse.json({ error: "请提供 articles" }, { status: 400 });
    }
    for (const article of addBody.articles) {
      if (!article.title?.trim() || !article.thumb_media_id?.trim()) {
        return NextResponse.json(
          { error: "每篇文章需包含 title 与 thumb_media_id（先上传封面素材）" },
          { status: 400 }
        );
      }
    }

    const result = await addDraft(credentials, addBody.articles);
    return NextResponse.json({ mediaId: result.media_id });
  } catch (err) {
    return wechatErrorResponse(err);
  }
}
