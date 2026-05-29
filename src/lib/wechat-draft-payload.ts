import type { SavedImageTemplate } from "@/types/image-template";
import type { WechatSettingsStore } from "@/types/wechat";
import {
  buildDefaultDraftFormState,
  type WechatDraftFormState,
} from "@/lib/wechat-draft-prefs-apply";
import {
  resolveWechatContentBlocks,
  resolveWechatCoverImageSrc,
} from "@/lib/wechat-resolve-content";
import type { createWechatDraftFromWork } from "@/lib/wechat-client";
import {
  extractWechatContentOptions,
  getCoverImageOptions,
} from "@/lib/wechat-work-content";

export type WechatDraftWorkPayload = Parameters<
  typeof createWechatDraftFromWork
>[1];

export interface WorkDraftValidation {
  ok: boolean;
  reason?: string;
  form?: WechatDraftFormState;
}

export function validateWorkDraftDefaults(
  work: SavedImageTemplate,
  settings: WechatSettingsStore
): WorkDraftValidation {
  const form = buildDefaultDraftFormState(work, settings);
  const options = extractWechatContentOptions(work);

  if (options.length === 0) {
    return { ok: false, reason: "无可选内容" };
  }

  const coverOptions = getCoverImageOptions(options);
  if (!form.coverId || !coverOptions.some((option) => option.id === form.coverId)) {
    return { ok: false, reason: "无有效封面" };
  }

  if (!form.title.trim()) {
    return { ok: false, reason: "标题为空" };
  }

  if (!form.useCustomHtml && form.bodyIds.length === 0) {
    return { ok: false, reason: "无正文内容" };
  }

  return { ok: true, form };
}

export async function buildDraftPayloadFromForm(
  work: SavedImageTemplate,
  form: WechatDraftFormState,
  settings: WechatSettingsStore
): Promise<WechatDraftWorkPayload | null> {
  const contentOptions = extractWechatContentOptions(work);
  const composedCache = new Map<string, string>();

  const coverImageSrc = await resolveWechatCoverImageSrc(
    work,
    contentOptions,
    form.coverId,
    composedCache
  );
  if (!coverImageSrc) return null;

  const resolvedAuthor =
    form.useFixedAuthor && settings.defaultAuthor?.trim()
      ? settings.defaultAuthor.trim()
      : form.author.trim();

  const payload: WechatDraftWorkPayload = {
    title: form.title.trim(),
    author: resolvedAuthor || undefined,
    digest: form.digest.trim() || undefined,
    contentSourceUrl: form.contentSourceUrl.trim() || undefined,
    coverImageSrc,
    needOpenComment: form.needOpenComment,
    onlyFansCanComment: form.onlyFansCanComment,
  };

  if (form.useCustomHtml && form.customContent.trim()) {
    payload.content = form.customContent.trim();
    return payload;
  }

  if (form.bodyIds.length === 0) return null;

  const contentBlocks = await resolveWechatContentBlocks(
    work,
    contentOptions,
    form.bodyIds,
    composedCache
  );
  if (contentBlocks.length === 0) return null;

  payload.contentBlocks = contentBlocks;
  return payload;
}

export async function buildDraftPayloadFromWork(
  work: SavedImageTemplate,
  settings: WechatSettingsStore
): Promise<WechatDraftWorkPayload | null> {
  const validation = validateWorkDraftDefaults(work, settings);
  if (!validation.ok || !validation.form) return null;
  return buildDraftPayloadFromForm(work, validation.form, settings);
}
