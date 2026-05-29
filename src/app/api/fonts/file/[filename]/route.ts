import { NextResponse } from "next/server";
import { getCustomFont, mimeTypeForFilename } from "@/lib/font-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    const decoded = decodeURIComponent(filename);
    const row = await getCustomFont(decoded);
    if (!row) {
      return NextResponse.json({ error: "字体不存在" }, { status: 404 });
    }

    const body = Buffer.from(row.data);
    return new NextResponse(body, {
      headers: {
        "Content-Type": row.mimeType || mimeTypeForFilename(row.filename),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "读取字体失败" }, { status: 500 });
  }
}
