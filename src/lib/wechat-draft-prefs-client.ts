import { mergeWechatSettings, saveWechatSettings } from "@/lib/wechat-settings";
import type { WechatSettingsStore } from "@/types/wechat";
import type {
  WechatPrefsPatch,
  WechatPrefsStore,
  WechatWorkDraftPrefs,
} from "@/types/wechat-draft-prefs";

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

export async function loadWechatPrefsStore(): Promise<WechatPrefsStore> {
  const data = await requestJson<{ store: WechatPrefsStore }>("/api/wechat/prefs");
  return data.store;
}

export async function patchWechatPrefs(
  patch: WechatPrefsPatch
): Promise<WechatPrefsStore> {
  const data = await requestJson<{ store: WechatPrefsStore }>("/api/wechat/prefs", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.store;
}

export async function persistWechatSettingsToServer(
  settings: WechatSettingsStore
): Promise<void> {
  saveWechatSettings(settings);
  await patchWechatPrefs({ settings });
}

export async function persistWorkDraftPrefs(
  workId: string,
  prefs: WechatWorkDraftPrefs,
  settingsUpdate?: WechatSettingsStore
): Promise<void> {
  await patchWechatPrefs({
    workId,
    workPrefs: prefs,
    settings: settingsUpdate,
    lastSelectedWorkId: workId,
  });
}

export async function persistLastSelectedWorkId(workId: string): Promise<void> {
  await patchWechatPrefs({ lastSelectedWorkId: workId });
}

/** 从服务端加载并同步到 localStorage（服务端优先） */
export async function hydrateWechatSettingsFromServer(): Promise<WechatSettingsStore> {
  try {
    const store = await loadWechatPrefsStore();
    const merged = mergeWechatSettings(store.settings);
    saveWechatSettings(merged);
    return merged;
  } catch {
    return mergeWechatSettings(null);
  }
}
