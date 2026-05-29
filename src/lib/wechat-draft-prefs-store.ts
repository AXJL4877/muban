import { promises as fs } from "node:fs";
import path from "node:path";
import {
  decryptJsonFromFile,
  encryptJsonForFile,
} from "@/lib/server-encryption";
import { mergeWechatSettings } from "@/lib/wechat-settings";
import type {
  WechatPrefsPatch,
  WechatPrefsStore,
  WechatWorkDraftPrefs,
} from "@/types/wechat-draft-prefs";

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(STORE_DIR, "wechat-prefs.json");
const STORE_BACKUP_FILE = path.join(STORE_DIR, "wechat-prefs.json.bak");

interface EncryptedWechatPrefsFile {
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

function isEncryptedWechatPrefsFile(value: unknown): value is EncryptedWechatPrefsFile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EncryptedWechatPrefsFile>;
  return (
    candidate.encrypted === true &&
    candidate.algorithm === "aes-256-gcm" &&
    typeof candidate.payload?.iv === "string" &&
    typeof candidate.payload?.tag === "string" &&
    typeof candidate.payload?.cipherText === "string"
  );
}

async function writeEncryptedStore(store: WechatPrefsStore): Promise<void> {
  const payload = await encryptJsonForFile(STORE_DIR, store);
  const wrapped: EncryptedWechatPrefsFile = {
    version: 1,
    encrypted: true,
    algorithm: "aes-256-gcm",
    payload,
  };
  await fs.writeFile(STORE_FILE, JSON.stringify(wrapped, null, 2), "utf8");
}

async function backupPlaintextStore(raw: string): Promise<void> {
  try {
    await fs.access(STORE_BACKUP_FILE);
  } catch {
    await fs.writeFile(STORE_BACKUP_FILE, raw, "utf8");
  }
}

async function ensureStoreFile(): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await writeEncryptedStore(buildEmptyStore());
  }
}

export async function getWechatPrefsStore(): Promise<WechatPrefsStore> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (isEncryptedWechatPrefsFile(parsed)) {
    const decrypted = await decryptJsonFromFile<WechatPrefsStore>(
      STORE_DIR,
      parsed.payload
    );
    return normalizeStore(decrypted);
  }

  // 兼容旧版明文：先保留备份，再迁移为加密存储，避免密钥丢失。
  const normalized = normalizeStore(parsed as Partial<WechatPrefsStore>);
  await backupPlaintextStore(raw);
  await writeEncryptedStore(normalized);
  return normalized;
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

  await writeEncryptedStore(next);
  return next;
}

export async function deleteWechatWorkPrefs(workId: string): Promise<WechatPrefsStore> {
  const current = await getWechatPrefsStore();
  if (!current.workPrefs[workId]) return current;
  const { [workId]: _removed, ...rest } = current.workPrefs;
  const next: WechatPrefsStore = { ...current, workPrefs: rest };
  await writeEncryptedStore(next);
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
