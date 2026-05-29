import {
  APP_STATE_KEYS,
  getAppState,
  setAppState,
} from "@/lib/app-state-store";
import { decryptJson, encryptJson } from "@/lib/server-encryption";
import { mergeWechatSettings } from "@/lib/wechat-settings";
import type {
  WechatPrefsPatch,
  WechatPrefsStore,
  WechatWorkDraftPrefs,
} from "@/types/wechat-draft-prefs";

interface EncryptedWechatPrefsRecord {
  version: 1;
  encrypted: true;
  algorithm: "aes-256-gcm";
  payload: {
    iv: string;
    tag: string;
    cipherText: string;
  };
}

function buildEmptyStore(): WechatPrefsStore {
  return {
    version: 1,
    settings: mergeWechatSettings(null),
    workPrefs: {},
  };
}

function normalizeStore(parsed: Partial<WechatPrefsStore> | null | undefined): WechatPrefsStore {
  if (!parsed || typeof parsed !== "object") return buildEmptyStore();
  return {
    version: 1,
    settings: mergeWechatSettings(parsed.settings),
    workPrefs: parsed.workPrefs ?? {},
    lastSelectedWorkId: parsed.lastSelectedWorkId,
  };
}

function isEncryptedRecord(value: unknown): value is EncryptedWechatPrefsRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EncryptedWechatPrefsRecord>;
  return (
    candidate.encrypted === true &&
    candidate.algorithm === "aes-256-gcm" &&
    typeof candidate.payload?.iv === "string" &&
    typeof candidate.payload?.tag === "string" &&
    typeof candidate.payload?.cipherText === "string"
  );
}

async function readStoreRecord(): Promise<WechatPrefsStore> {
  const raw = await getAppState<EncryptedWechatPrefsRecord | Partial<WechatPrefsStore>>(
    APP_STATE_KEYS.wechatPrefs
  );
  if (!raw) return buildEmptyStore();

  if (isEncryptedRecord(raw)) {
    const decrypted = await decryptJson<WechatPrefsStore>(raw.payload);
    return normalizeStore(decrypted);
  }

  const normalized = normalizeStore(raw);
  await writeStoreRecord(normalized);
  return normalized;
}

async function writeStoreRecord(store: WechatPrefsStore): Promise<void> {
  const payload = await encryptJson(store);
  const wrapped: EncryptedWechatPrefsRecord = {
    version: 1,
    encrypted: true,
    algorithm: "aes-256-gcm",
    payload,
  };
  await setAppState(APP_STATE_KEYS.wechatPrefs, wrapped);
}

export async function getWechatPrefsStore(): Promise<WechatPrefsStore> {
  return readStoreRecord();
}

export async function patchWechatPrefsStore(
  patch: WechatPrefsPatch
): Promise<WechatPrefsStore> {
  const current = await readStoreRecord();
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

  await writeStoreRecord(next);
  return next;
}

export async function deleteWechatWorkPrefs(workId: string): Promise<WechatPrefsStore> {
  const current = await readStoreRecord();
  if (!current.workPrefs[workId]) return current;
  const { [workId]: _removed, ...rest } = current.workPrefs;
  const next: WechatPrefsStore = { ...current, workPrefs: rest };
  await writeStoreRecord(next);
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
