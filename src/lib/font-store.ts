import path from "node:path";
import { db } from "@/lib/db";

const ALLOWED_EXT = new Set([".ttf", ".otf", ".woff", ".woff2"]);

const MIME_BY_EXT: Record<string, string> = {
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export function familyFromFilename(filename: string): string {
  const stem = path.basename(filename, path.extname(filename));
  return stem.replace(/[-_]+/g, " ").trim() || "Custom Font";
}

export function sanitizeFilename(name: string): string {
  const base = path.basename(name);
  const ext = path.extname(base).toLowerCase();
  const stem = path.basename(base, path.extname(base));
  const safeStem = stem.replace(/[^\w.\-\u4e00-\u9fff\u3400-\u4dbf]/g, "_").slice(0, 80);
  return `${safeStem || "font"}${ext}`;
}

export function fontFileUrl(filename: string): string {
  return `/api/fonts/file/${encodeURIComponent(filename)}`;
}

export function isAllowedFontExt(ext: string): boolean {
  return ALLOWED_EXT.has(ext.toLowerCase());
}

export function mimeTypeForFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export async function listCustomFonts(): Promise<
  Array<{ family: string; url: string; filename: string }>
> {
  const rows = await db.customFont.findMany({
    orderBy: { filename: "asc" },
  });
  return rows.map((row) => ({
    family: row.family,
    url: fontFileUrl(row.filename),
    filename: row.filename,
  }));
}

export async function getCustomFont(filename: string) {
  return db.customFont.findUnique({ where: { filename } });
}

export async function upsertCustomFont(input: {
  filename: string;
  family: string;
  mimeType: string;
  data: Buffer;
}) {
  return db.customFont.upsert({
    where: { filename: input.filename },
    create: {
      filename: input.filename,
      family: input.family,
      mimeType: input.mimeType,
      data: new Uint8Array(input.data),
    },
    update: {
      family: input.family,
      mimeType: input.mimeType,
      data: new Uint8Array(input.data),
    },
  });
}

export async function deleteCustomFont(filename: string): Promise<void> {
  await db.customFont.deleteMany({ where: { filename } });
}
