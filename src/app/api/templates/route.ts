import { NextResponse } from "next/server";
import { listTemplates, upsertTemplate } from "@/lib/template-store";
import type { SavedImageTemplate } from "@/types/image-template";

export async function GET() {
  const templates = await listTemplates();
  return NextResponse.json({
    templates,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { template?: SavedImageTemplate };
    if (!body.template) {
      return NextResponse.json({ error: "缺少模板数据" }, { status: 400 });
    }

    const template = await upsertTemplate(body.template);

    return NextResponse.json({ template }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "保存模板失败" }, { status: 500 });
  }
}
