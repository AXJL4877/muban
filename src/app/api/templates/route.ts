import { NextResponse } from "next/server";
import { listTemplates, listTemplatesByType, upsertTemplate } from "@/lib/template-store";
import type { TemplateRecordType } from "@/lib/image-templates";
import type { SavedImageTemplate } from "@/types/image-template";

function parseRecordType(searchParams: URLSearchParams): TemplateRecordType | null {
  const type = searchParams.get("recordType");
  if (type === "template" || type === "work") return type;
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recordType = parseRecordType(searchParams);
  const templates = recordType ? await listTemplatesByType(recordType) : await listTemplates();
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
