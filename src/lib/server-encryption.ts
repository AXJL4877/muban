import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const KEY_FILE_NAME = ".data-encryption.key";
const KEY_BYTES = 32;
const LOCAL_KEY_DIR = path.join(process.cwd(), "data");

export interface EncryptedPayload {
  iv: string;
  tag: string;
  cipherText: string;
}

function normalizeKey(input: string): Buffer {
  const raw = input.trim();
  if (!raw) throw new Error("empty key");

  if (/^[0-9a-f]+$/i.test(raw) && raw.length >= KEY_BYTES * 2) {
    return Buffer.from(raw.slice(0, KEY_BYTES * 2), "hex");
  }

  try {
    const b64 = Buffer.from(raw, "base64");
    if (b64.length >= KEY_BYTES) return b64.subarray(0, KEY_BYTES);
  } catch {
    // ignore
  }

  return createHash("sha256").update(raw).digest();
}

async function getOrCreateDataKey(): Promise<Buffer> {
  const envKey = process.env.APP_DATA_ENCRYPTION_KEY;
  if (envKey?.trim()) {
    return normalizeKey(envKey);
  }

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error(
      "缺少 APP_DATA_ENCRYPTION_KEY 环境变量，无法解密公众号配置"
    );
  }

  const keyFile = path.join(LOCAL_KEY_DIR, KEY_FILE_NAME);
  try {
    const existing = await fs.readFile(keyFile, "utf8");
    return normalizeKey(existing);
  } catch {
    await fs.mkdir(LOCAL_KEY_DIR, { recursive: true });
    const created = randomBytes(KEY_BYTES).toString("base64");
    await fs.writeFile(keyFile, created, "utf8");
    return normalizeKey(created);
  }
}

export async function encryptJson<T>(value: T): Promise<EncryptedPayload> {
  const key = await getOrCreateDataKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const source = Buffer.from(JSON.stringify(value), "utf8");
  const cipherText = Buffer.concat([cipher.update(source), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    cipherText: cipherText.toString("base64"),
  };
}

export async function decryptJson<T>(payload: EncryptedPayload): Promise<T> {
  const key = await getOrCreateDataKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plain.toString("utf8")) as T;
}

/** @deprecated 兼容旧调用，密钥不再依赖 dataDir */
export async function encryptJsonForFile<T>(
  _dataDir: string,
  value: T
): Promise<EncryptedPayload> {
  return encryptJson(value);
}

/** @deprecated 兼容旧调用，密钥不再依赖 dataDir */
export async function decryptJsonFromFile<T>(
  _dataDir: string,
  payload: EncryptedPayload
): Promise<T> {
  return decryptJson(payload);
}
