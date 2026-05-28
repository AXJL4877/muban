import { promises as fs } from "node:fs";
import path from "node:path";
import type { SavedImageTemplate } from "@/types/image-template";

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(STORE_DIR, "templates.json");

function extractFirstJsonArray(raw: string): string {
  const start = raw.indexOf("[");
  if (start === -1) return "[]";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  return "[]";
}

async function ensureStoreFile(): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(STORE_FILE, "[]", "utf8");
  }
}

export async function listTemplates(): Promise<SavedImageTemplate[]> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  const safeRaw = extractFirstJsonArray(raw);
  const parsed = JSON.parse(safeRaw) as SavedImageTemplate[];
  return (Array.isArray(parsed) ? parsed : []).sort((a, b) => b.savedAt - a.savedAt);
}

async function writeTemplates(templates: SavedImageTemplate[]): Promise<void> {
  await ensureStoreFile();
  await fs.writeFile(STORE_FILE, JSON.stringify(templates, null, 2), "utf8");
}

export async function upsertTemplate(template: SavedImageTemplate): Promise<SavedImageTemplate> {
  const list = await listTemplates();
  const index = list.findIndex((t) => t.id === template.id);
  if (index >= 0) list[index] = template;
  else list.push(template);
  await writeTemplates(list);
  return template;
}

export async function getTemplate(id: string): Promise<SavedImageTemplate | null> {
  const list = await listTemplates();
  return list.find((t) => t.id === id) ?? null;
}

export async function removeTemplate(id: string): Promise<void> {
  const list = await listTemplates();
  await writeTemplates(list.filter((t) => t.id !== id));
}

export async function renameTemplateInStore(id: string, name: string): Promise<SavedImageTemplate | null> {
  const list = await listTemplates();
  const item = list.find((t) => t.id === id);
  if (!item) return null;
  item.name = name.trim() || item.name;
  await writeTemplates(list);
  return item;
}
