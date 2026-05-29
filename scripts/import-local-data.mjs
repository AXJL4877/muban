/**
 * 将本地 data/*.json 与 public/fonts 导入 Neon PostgreSQL。
 * 用法：在项目根目录配置 .env 后执行 npm run db:import-local
 */
import { PrismaClient } from "@prisma/client";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const FONTS_DIR = path.join(ROOT, "public", "fonts");

function normalizeKey(input) {
  const raw = input.trim();
  if (/^[0-9a-f]+$/i.test(raw) && raw.length >= 64) {
    return Buffer.from(raw.slice(0, 64), "hex");
  }
  try {
    const b64 = Buffer.from(raw, "base64");
    if (b64.length >= 32) return b64.subarray(0, 32);
  } catch {
    // ignore
  }
  return createHash("sha256").update(raw).digest();
}

async function readEncryptionKey() {
  if (process.env.APP_DATA_ENCRYPTION_KEY?.trim()) {
    return normalizeKey(process.env.APP_DATA_ENCRYPTION_KEY);
  }
  const keyFile = path.join(DATA_DIR, ".data-encryption.key");
  const existing = await fs.readFile(keyFile, "utf8");
  return normalizeKey(existing);
}

function familyFromFilename(filename) {
  const stem = path.basename(filename, path.extname(filename));
  return stem.replace(/[-_]+/g, " ").trim() || "Custom Font";
}

function mimeTypeForFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };
  return map[ext] ?? "application/octet-stream";
}

async function importTemplates() {
  const file = path.join(DATA_DIR, "templates.json");
  try {
    await fs.access(file);
  } catch {
    console.log("跳过 templates.json（文件不存在）");
    return 0;
  }

  const raw = await fs.readFile(file, "utf8");
  const parsed = JSON.parse(raw);
  const templates = Array.isArray(parsed) ? parsed : [];
  let count = 0;

  for (const template of templates) {
    if (!template?.id) continue;
    await prisma.template.upsert({
      where: { id: template.id },
      create: {
        id: template.id,
        name: template.name ?? "未命名",
        recordType: template.recordType ?? "template",
        savedAt: BigInt(template.savedAt ?? Date.now()),
        canvasSize: template.canvasSize,
        json: template.json,
        thumbnail: template.thumbnail ?? null,
        elements: template.elements ?? [],
        elementCount: template.elementCount ?? 0,
        jsonPromptConfig: template.jsonPromptConfig ?? null,
        imagePromptConfig: template.imagePromptConfig ?? null,
      },
      update: {
        name: template.name ?? "未命名",
        recordType: template.recordType ?? "template",
        savedAt: BigInt(template.savedAt ?? Date.now()),
        canvasSize: template.canvasSize,
        json: template.json,
        thumbnail: template.thumbnail ?? null,
        elements: template.elements ?? [],
        elementCount: template.elementCount ?? 0,
        jsonPromptConfig: template.jsonPromptConfig ?? null,
        imagePromptConfig: template.imagePromptConfig ?? null,
      },
    });
    count += 1;
  }

  console.log(`已导入 ${count} 个模板/作品`);
  return count;
}

async function encryptJsonValue(value) {
  const key = await readEncryptionKey();
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

async function importWechatPrefs() {
  const file = path.join(DATA_DIR, "wechat-prefs.json");
  try {
    await fs.access(file);
  } catch {
    console.log("跳过 wechat-prefs.json（文件不存在）");
    return;
  }

  const raw = await fs.readFile(file, "utf8");
  const parsed = JSON.parse(raw);
  let stored = parsed;

  if (!(parsed?.encrypted === true && parsed.payload)) {
    const payload = await encryptJsonValue(parsed);
    stored = {
      version: 1,
      encrypted: true,
      algorithm: "aes-256-gcm",
      payload,
    };
  }

  await prisma.appState.upsert({
    where: { key: "wechat-prefs" },
    create: { key: "wechat-prefs", value: stored },
    update: { value: stored },
  });
  console.log("已导入公众号偏好");
}

async function importAutomationRun() {
  const file = path.join(DATA_DIR, "automation-run.json");
  try {
    await fs.access(file);
  } catch {
    console.log("跳过 automation-run.json（文件不存在）");
    return;
  }

  const raw = (await fs.readFile(file, "utf8")).trim();
  if (!raw || raw === "null") return;

  const parsed = JSON.parse(raw);
  await prisma.appState.upsert({
    where: { key: "automation-run" },
    create: { key: "automation-run", value: parsed },
    update: { value: parsed },
  });
  console.log("已导入自动化运行状态");
}

async function importFonts() {
  let files = [];
  try {
    files = await fs.readdir(FONTS_DIR);
  } catch {
    console.log("跳过 public/fonts（目录不存在）");
    return 0;
  }

  const allowed = new Set([".ttf", ".otf", ".woff", ".woff2"]);
  let count = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!allowed.has(ext)) continue;
    const buffer = await fs.readFile(path.join(FONTS_DIR, file));
    await prisma.customFont.upsert({
      where: { filename: file },
      create: {
        filename: file,
        family: familyFromFilename(file),
        mimeType: mimeTypeForFilename(file),
        data: buffer,
      },
      update: {
        family: familyFromFilename(file),
        mimeType: mimeTypeForFilename(file),
        data: buffer,
      },
    });
    count += 1;
  }

  console.log(`已导入 ${count} 个字体文件`);
  return count;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("请在 .env 中配置 DATABASE_URL（Neon PostgreSQL 连接串）");
  }

  await importTemplates();
  await importWechatPrefs();
  await importAutomationRun();
  await importFonts();
  console.log("本地数据导入完成");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
