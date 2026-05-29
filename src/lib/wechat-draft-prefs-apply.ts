import type { SavedImageTemplate } from "@/types/image-template";
import type { WechatSettingsStore } from "@/types/wechat";
import type { WechatWorkDraftPrefs } from "@/types/wechat-draft-prefs";
import {
  extractWechatContentOptions,
  resolvePublishContentSelection,
  type WechatContentOption,
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

function coverOptionIds(options: WechatContentOption[]): Set<string> {
  return new Set(
    options
      .filter((o) => o.kind === "cover" || o.kind === "composed" || o.kind === "image")
      .map((o) => o.id)
  );
}

function bodyOptionIds(options: WechatContentOption[]): Set<string> {
  return new Set(options.map((o) => o.id));
}

export function sanitizeWorkDraftPrefs(
  prefs: WechatWorkDraftPrefs,
  contentOptions: WechatContentOption[]
): WechatWorkDraftPrefs {
  const covers = coverOptionIds(contentOptions);
  const bodies = bodyOptionIds(contentOptions);
  const coverId = covers.has(prefs.coverId) ? prefs.coverId : "";
  const bodyIds = prefs.bodyIds.filter((id) => bodies.has(id));
  return { ...prefs, coverId, bodyIds };
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

/** 无已保存偏好时的默认表单（使用全局发布模板） */
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

/** 将已保存偏好合并为表单状态（校验选项仍有效） */
export function applySavedWorkDraftPrefs(
  work: SavedImageTemplate,
  settings: WechatSettingsStore,
  saved: WechatWorkDraftPrefs
): WechatDraftFormState {
  const options = extractWechatContentOptions(work);
  const sanitized = sanitizeWorkDraftPrefs(saved, options);
  const defaults = buildDefaultDraftFormState(work, settings);

  let coverId = sanitized.coverId || defaults.coverId;
  let bodyIds =
    sanitized.bodyIds.length > 0 ? sanitized.bodyIds : defaults.bodyIds;

  return {
    coverId,
    bodyIds,
    titleSourceKey: sanitized.titleSourceKey || defaults.titleSourceKey,
    title: resolveTitleText(work, sanitized.titleSourceKey, sanitized.title),
    digestSourceKey: sanitized.digestSourceKey || defaults.digestSourceKey,
    digest: resolveDigestText(work, sanitized.digestSourceKey, sanitized.digest),
    useFixedAuthor: sanitized.useFixedAuthor,
    author: sanitized.useFixedAuthor
      ? settings.defaultAuthor ?? sanitized.author
      : sanitized.author,
    contentSourceUrl: sanitized.contentSourceUrl ?? "",
    needOpenComment: sanitized.needOpenComment,
    onlyFansCanComment: sanitized.onlyFansCanComment,
    useCustomHtml: sanitized.useCustomHtml ?? false,
    customContent: sanitized.customContent ?? "",
  };
}

export function buildWorkDraftPrefsFromForm(
  form: WechatDraftFormState
): WechatWorkDraftPrefs {
  return {
    ...form,
    updatedAt: Date.now(),
  };
}
