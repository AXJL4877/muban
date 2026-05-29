import type { SavedImageTemplate } from "@/types/image-template";
import type { WechatSettingsStore } from "@/types/wechat";
import {
  extractWechatContentOptions,
  resolvePublishContentSelection,
} from "@/lib/wechat-work-content";
import {
  guessDefaultTitleFieldKey,
  resolveWorkTextByKey,
  WECHAT_TEXT_SOURCE_MANUAL,
  WECHAT_TITLE_SOURCE_WORK_NAME,
} from "@/lib/wechat-work-text-fields";

export interface WechatDraftFormState {
  coverId: string;
  bodyIds: string[];
  titleSourceKey: string;
  title: string;
  digestSourceKey: string;
  digest: string;
  useFixedAuthor: boolean;
  author: string;
  contentSourceUrl: string;
  needOpenComment: boolean;
  onlyFansCanComment: boolean;
  useCustomHtml: boolean;
  customContent: string;
}

function resolveTitleSourceKey(
  work: SavedImageTemplate,
  settings: WechatSettingsStore
): string {
  const configured = settings.defaultTitleFieldKey?.trim();
  if (configured && resolveWorkTextByKey(work, configured)) return configured;
  if (configured === WECHAT_TITLE_SOURCE_WORK_NAME) {
    return WECHAT_TITLE_SOURCE_WORK_NAME;
  }
  return guessDefaultTitleFieldKey(work) ?? WECHAT_TEXT_SOURCE_MANUAL;
}

function resolveTitleText(
  work: SavedImageTemplate,
  titleSourceKey: string,
  fallbackTitle: string
): string {
  if (titleSourceKey === WECHAT_TEXT_SOURCE_MANUAL) {
    return fallbackTitle.trim() || work.name;
  }
  return resolveWorkTextByKey(work, titleSourceKey) ?? fallbackTitle.trim() ?? work.name;
}

function resolveDigestText(
  work: SavedImageTemplate,
  digestSourceKey: string,
  fallbackDigest: string
): string {
  if (digestSourceKey === WECHAT_TEXT_SOURCE_MANUAL) return fallbackDigest;
  return resolveWorkTextByKey(work, digestSourceKey) ?? fallbackDigest;
}

/** 默认表单（使用全局发布模板） */
export function buildDefaultDraftFormState(
  work: SavedImageTemplate,
  settings: WechatSettingsStore
): WechatDraftFormState {
  const options = extractWechatContentOptions(work);
  const contentDefaults = resolvePublishContentSelection(options, {
    coverId: settings.defaultPublishCoverId,
    bodyPattern: settings.defaultPublishBodyPattern,
  });
  const titleSourceKey = resolveTitleSourceKey(work, settings);
  const digestSourceKey =
    settings.defaultDigestFieldKey?.trim() || WECHAT_TEXT_SOURCE_MANUAL;
  const hasFixedAuthor = !!settings.defaultAuthor?.trim();

  return {
    coverId: contentDefaults.coverId,
    bodyIds: contentDefaults.bodyIds,
    titleSourceKey,
    title: resolveTitleText(work, titleSourceKey, work.name),
    digestSourceKey,
    digest: resolveDigestText(work, digestSourceKey, ""),
    useFixedAuthor: hasFixedAuthor,
    author: settings.defaultAuthor ?? "",
    contentSourceUrl: "",
    needOpenComment: settings.needOpenComment ?? false,
    onlyFansCanComment: settings.onlyFansCanComment ?? false,
    useCustomHtml: false,
    customContent: "",
  };
}
