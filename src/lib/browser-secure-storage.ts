"use client";

const ENCRYPTED_PREFIX = "enc:v1:";
const MASTER_SECRET_KEY = "__secure_storage_master_secret__";
const KDF_SALT = "my-fullstack-app-secure-storage";
const PBKDF2_ITERATIONS = 120_000;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

function getOrCreateMasterSecret(): string {
  const existing = localStorage.getItem(MASTER_SECRET_KEY);
  if (existing) return existing;
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const created = toBase64(random);
  localStorage.setItem(MASTER_SECRET_KEY, created);
  return created;
}

async function deriveAesKey(secretBase64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(fromBase64(secretBase64)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(KDF_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptText(plainText: string): Promise<string> {
  const secret = getOrCreateMasterSecret();
  const key = await deriveAesKey(secret);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    toArrayBuffer(new TextEncoder().encode(plainText))
  );
  return `${ENCRYPTED_PREFIX}${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

async function decryptText(encryptedText: string): Promise<string> {
  if (!encryptedText.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error("not encrypted");
  }
  const payload = encryptedText.slice(ENCRYPTED_PREFIX.length);
  const [ivBase64, cipherBase64] = payload.split(".");
  if (!ivBase64 || !cipherBase64) {
    throw new Error("invalid encrypted payload");
  }

  const secret = getOrCreateMasterSecret();
  const key = await deriveAesKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(fromBase64(ivBase64)) },
    key,
    toArrayBuffer(fromBase64(cipherBase64))
  );
  return new TextDecoder().decode(decrypted);
}

export async function saveEncryptedJson<T>(storageKey: string, value: T): Promise<void> {
  const encoded = JSON.stringify(value);
  try {
    const encrypted = await encryptText(encoded);
    localStorage.setItem(storageKey, encrypted);
  } catch {
    // Fallback: crypto 不可用时至少保持兼容，不阻断用户保存。
    localStorage.setItem(storageKey, encoded);
  }
}

export async function loadEncryptedJson<T>(storageKey: string): Promise<T | null> {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  if (raw.startsWith(ENCRYPTED_PREFIX)) {
    const decrypted = await decryptText(raw);
    return JSON.parse(decrypted) as T;
  }

  const parsed = JSON.parse(raw) as T;
  await saveEncryptedJson(storageKey, parsed);
  return parsed;
}
