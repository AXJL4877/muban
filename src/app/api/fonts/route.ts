import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const FONTS_DIR = path.join(process.cwd(), "public", "fonts");
const ALLOWED_EXT = new Set([".ttf", ".otf", ".woff", ".woff2"]);
const MAX_FONT_BYTES = 15 * 1024 * 1024;

function familyFromFilename(filename: string): string {
  const stem = path.basename(filename, path.extname(filename));
  return stem.replace(/[-_]+/g, " ").trim() || "Custom Font";
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name);
  const ext = path.extname(base).toLowerCase();
  const stem = path.basename(base, path.extname(base));
  const safeStem = stem.replace(/[^\w.\-\u4e00-\u9fff\u3400-\u4dbf]/g, "_").slice(0, 80);
  return `${safeStem || "font"}${ext}`;
}

async function listFontFiles() {
  await fs.mkdir(FONTS_DIR, { recursive: true });
  const files = await fs.readdir(FONTS_DIR);
  return files
    .filter((file) => ALLOWED_EXT.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "zh-CN"))
    .map((file) => ({
      family: familyFromFilename(file),
      url: `/fonts/${encodeURIComponent(file)}`,
      filename: file,
    }));
}

export async function GET() {
  try {
    const fonts = await listFontFiles();
    return NextResponse.json({ fonts });
  } catch {
    return NextResponse.json({ error: "读取字体列表失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择字体文件" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { error: "仅支持 .ttf / .otf / .woff / .woff2 格式" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FONT_BYTES) {
      return NextResponse.json(
        { error: "字体文件不能超过 15MB" },
        { status: 400 }
      );
    }

    await fs.mkdir(FONTS_DIR, { recursive: true });

    const filename = sanitizeFilename(file.name);
    const target = path.join(FONTS_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(target, buffer);

    return NextResponse.json({
      family: familyFromFilename(filename),
      url: `/fonts/${encodeURIComponent(filename)}`,
      filename,
    });
  } catch {
    return NextResponse.json({ error: "字体保存失败" }, { status: 500 });
  }
}
