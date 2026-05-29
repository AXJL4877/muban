import {
  addDraft,
  fetchImageBuffer,
  uploadArticleContentImage,
  uploadPermanentImageMaterial,
} from "@/lib/wechat-api";
import type {
  CreateDraftFromWorkPayload,
  WechatDraftContentBlock,
} from "@/types/wechat";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function buildHtmlFromContentBlocks(
  credentials: { appId: string; appSecret: string },
  blocks: WechatDraftContentBlock[]
): Promise<string> {
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      const text = block.text?.trim();
      if (!text) continue;
      parts.push(`<p>${escapeHtml(text)}</p>`);
      continue;
    }

    if (block.type === "image" && block.imageSrc?.trim()) {
      const img = await fetchImageBuffer(block.imageSrc.trim());
      const uploaded = await uploadArticleContentImage(
        credentials,
        img.buffer,
        `content-${parts.length}.${img.ext}`
      );
      parts.push(`<p><img src="${uploaded.url}" alt="" /></p>`);
    }
  }

  return parts.join("\n");
}

function legacyBlocksFromImageSrcs(
  srcs: string[]
): WechatDraftContentBlock[] {
  return srcs.map((imageSrc) => ({ type: "image" as const, imageSrc }));
}

/**
 * 官方流程：封面与正文图先上传素材，再调用草稿新增接口。
 */
export async function createDraftFromWork(
  payload: CreateDraftFromWorkPayload
): Promise<{ mediaId: string; thumbMediaId: string }> {
  const { credentials, title, author, digest, contentSourceUrl } = payload;
  const credentialsOnly = {
    appId: credentials.appId,
    appSecret: credentials.appSecret,
  };

  const cover = await fetchImageBuffer(payload.coverImageSrc);
  const coverUpload = await uploadPermanentImageMaterial(
    credentialsOnly,
    cover.buffer,
    `cover.${cover.ext}`
  );

  let content = payload.content?.trim() ?? "";
  if (!content) {
    const blocks =
      payload.contentBlocks ??
      legacyBlocksFromImageSrcs(payload.contentImageSrcs ?? []);
    content = await buildHtmlFromContentBlocks(credentialsOnly, blocks);
  }

  if (!content.trim()) {
    throw new Error("正文为空，请至少选择一项正文内容");
  }

  const needOpenComment = payload.needOpenComment ? 1 : 0;
  const onlyFansCanComment =
    payload.needOpenComment && payload.onlyFansCanComment ? 1 : 0;

  const draft = await addDraft(credentialsOnly, [
    {
      article_type: "news",
      title,
      author: author ?? "",
      digest: digest ?? title.slice(0, 120),
      content,
      content_source_url: contentSourceUrl ?? "",
      thumb_media_id: coverUpload.media_id,
      need_open_comment: needOpenComment,
      only_fans_can_comment: onlyFansCanComment,
    },
  ]);

  return {
    mediaId: draft.media_id,
    thumbMediaId: coverUpload.media_id,
  };
}
