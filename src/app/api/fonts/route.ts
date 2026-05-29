import { NextRequest, NextResponse } from "next/server";
import {
  familyFromFilename,
  isAllowedFontExt,
  listCustomFonts,
  mimeTypeForFilename,
  sanitizeFilename,
  upsertCustomFont,
} from "@/lib/font-store";
import path from "path";

const MAX_FONT_BYTES = 15 * 1024 * 1024;

export async function GET() {
  try {
    const fonts = await listCustomFonts();
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
    if (!isAllowedFontExt(ext)) {
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

    const filename = sanitizeFilename(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await upsertCustomFont({
      filename,
      family: familyFromFilename(filename),
      mimeType: mimeTypeForFilename(filename),
      data: buffer,
    });

    return NextResponse.json({
      family: familyFromFilename(filename),
      url: `/api/fonts/file/${encodeURIComponent(filename)}`,
      filename,
    });
  } catch {
    return NextResponse.json({ error: "字体保存失败" }, { status: 500 });
  }
}
