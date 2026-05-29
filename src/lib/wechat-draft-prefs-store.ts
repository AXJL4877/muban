import { promises as fs } from "node:fs";
import path from "node:path";
import { mergeWechatSettings } from "@/lib/wechat-settings";
import type {
  WechatPrefsPatch,
  WechatPrefsStore,
  WechatWorkDraftPrefs,
} from "@/types/wechat-draft-prefs";

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(STORE_DIR, "wechat-prefs.json");

function buildEmptyStore(): WechatPrefsStore {
  return {
    version: 1,
    settings: mergeWechatSettings(null),
    workPrefs: {},
  };
}

async function ensureStoreFile(): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(
      STORE_FILE,
      JSON.stringify(buildEmptyStore(), null, 2),
      "utf8"
    );
  }
}

export async function getWechatPrefsStore(): Promise<WechatPrefsStore> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as Partial<WechatPrefsStore>;
    if (!parsed || typeof parsed !== "object") return buildEmptyStore();
    return {
      version: 1,
      settings: mergeWechatSettings(parsed.settings),
      workPrefs: parsed.workPrefs ?? {},
      lastSelectedWorkId: parsed.lastSelectedWorkId,
    };
  } catch {
    return buildEmptyStore();
  }
}

export async function patchWechatPrefsStore(
  patch: WechatPrefsPatch
): Promise<WechatPrefsStore> {
  const current = await getWechatPrefsStore();
  const next: WechatPrefsStore = {
    ...current,
    settings: patch.settings
      ? mergeWechatSettings({ ...current.settings, ...patch.settings })
      : current.settings,
    workPrefs: { ...current.workPrefs },
    lastSelectedWorkId:
      patch.lastSelectedWorkId !== undefined
        ? patch.lastSelectedWorkId
        : current.lastSelectedWorkId,
  };

  if (patch.workId && patch.workPrefs) {
    next.workPrefs[patch.workId] = {
      ...patch.workPrefs,
      updatedAt: patch.workPrefs.updatedAt || Date.now(),
    };
  }

  await fs.writeFile(STORE_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function deleteWechatWorkPrefs(workId: string): Promise<WechatPrefsStore> {
  const current = await getWechatPrefsStore();
  if (!current.workPrefs[workId]) return current;
  const { [workId]: _removed, ...rest } = current.workPrefs;
  const next: WechatPrefsStore = { ...current, workPrefs: rest };
  await fs.writeFile(STORE_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function countWorkPrefs(store: WechatPrefsStore): number {
  return Object.keys(store.workPrefs).length;
}

export function getWorkPrefs(
  store: WechatPrefsStore,
  workId: string
): WechatWorkDraftPrefs | null {
  return store.workPrefs[workId] ?? null;
}
