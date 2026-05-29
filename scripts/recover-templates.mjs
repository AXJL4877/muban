/**
 * 从损坏的 templates.json 中尽量恢复全部模板条目并导入 Neon。
 */
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const FILE = path.join("data", "templates.json");

function extractFirstJsonArray(raw) {
  const start = raw.indexOf("[");
  if (start === -1) return "[]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return "[]";
}

/** 在首个 ] 之后查找后续完整模板对象 */
function extractTrailingTemplates(raw, afterIndex) {
  const tail = raw.slice(afterIndex).replace(/\0/g, "");
  const templates = [];
  const marker = /"id"\s*:\s*"[0-9a-f-]{36}"/g;
  let match;

  while ((match = marker.exec(tail)) !== null) {
    const idStart = match.index;
    let objStart = tail.lastIndexOf("{", idStart);
    if (objStart === -1) continue;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let found = false;

    for (let i = objStart; i < tail.length; i += 1) {
      const ch = tail[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const chunk = tail.slice(objStart, i + 1);
          try {
            const obj = JSON.parse(chunk);
            if (obj?.id && obj?.canvasSize && obj?.json) {
              templates.push(obj);
            }
          } catch {
            /* 跳过无法解析的块 */
          }
          found = true;
          marker.lastIndex = i + 1;
          break;
        }
      }
    }
    if (!found) continue;
  }

  return templates;
}

async function upsertTemplate(template) {
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
}

async function main() {
  const raw = await fs.readFile(FILE, "utf8");
  const start = raw.indexOf("[");
  let firstEnd = -1;
  {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < raw.length; i += 1) {
      const ch = raw[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "[") depth += 1;
      if (ch === "]") {
        depth -= 1;
        if (depth === 0) {
          firstEnd = i;
          break;
        }
      }
    }
  }

  const firstBatch = JSON.parse(extractFirstJsonArray(raw));
  const trailing = extractTrailingTemplates(raw, firstEnd + 1);
  const byId = new Map();

  for (const t of [...firstBatch, ...trailing]) {
    if (t?.id) byId.set(t.id, t);
  }

  console.log(`首个数组: ${firstBatch.length} 条，后续恢复: ${trailing.length} 条，去重后: ${byId.size} 条`);

  let imported = 0;
  for (const template of byId.values()) {
    await upsertTemplate(template);
    imported += 1;
    console.log(`  ✓ ${template.name}`);
  }

  console.log(`\n共导入 ${imported} 个模板/作品到数据库`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
