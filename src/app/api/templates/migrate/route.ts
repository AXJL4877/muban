import { NextResponse } from "next/server";
import { upsertTemplate } from "@/lib/template-store";
import type { SavedImageTemplate } from "@/types/image-template";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { templates?: SavedImageTemplate[] };
    const templates = Array.isArray(body.templates) ? body.templates : [];
    if (templates.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    await Promise.all(templates.map((template) => upsertTemplate(template)));

    return NextResponse.json({ ok: true, count: templates.length });
  } catch {
    return NextResponse.json({ error: "迁移模板失败" }, { status: 500 });
  }
}
