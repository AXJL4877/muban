import type { WechatSettingsStore } from "@/types/wechat";

export const WECHAT_SETTINGS_STORAGE_KEY = "wechat-official-settings";

export function buildDefaultWechatSettings(): WechatSettingsStore {
  return {
    appId: "",
    appSecret: "",
    defaultAuthor: "",
  };
}

export function mergeWechatSettings(
  partial: Partial<WechatSettingsStore> | null | undefined
): WechatSettingsStore {
  const defaults = buildDefaultWechatSettings();
  if (!partial) return defaults;
  return {
    appId: partial.appId?.trim() ?? defaults.appId,
    appSecret: partial.appSecret?.trim() ?? defaults.appSecret,
    defaultAuthor: partial.defaultAuthor?.trim() ?? defaults.defaultAuthor,
  };
}

export function loadWechatSettings(): WechatSettingsStore {
  if (typeof window === "undefined") return buildDefaultWechatSettings();
  try {
    const raw = localStorage.getItem(WECHAT_SETTINGS_STORAGE_KEY);
    if (!raw) return buildDefaultWechatSettings();
    return mergeWechatSettings(JSON.parse(raw) as Partial<WechatSettingsStore>);
  } catch {
    return buildDefaultWechatSettings();
  }
}

export function saveWechatSettings(settings: WechatSettingsStore): void {
  localStorage.setItem(WECHAT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function resolveWechatCredentials(
  fromBody?: Partial<WechatSettingsStore> | null
): { appId: string; appSecret: string } | null {
  const appId =
    fromBody?.appId?.trim() ||
    process.env.WECHAT_APP_ID?.trim() ||
    "";
  const appSecret =
    fromBody?.appSecret?.trim() ||
    process.env.WECHAT_APP_SECRET?.trim() ||
    "";
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}
