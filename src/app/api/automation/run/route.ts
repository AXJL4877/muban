import { NextResponse } from "next/server";
import {
  clearAutomationRun,
  getAutomationRun,
  saveAutomationRun,
} from "@/lib/automation-run-store";
import type { AutomationRunState } from "@/types/automation-run";

export async function GET() {
  const run = await getAutomationRun();
  return NextResponse.json({ run });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { run?: AutomationRunState };
    if (!body.run) {
      return NextResponse.json({ error: "缺少自动化状态" }, { status: 400 });
    }
    const run = await saveAutomationRun({
      ...body.run,
      updatedAt: Date.now(),
    });
    return NextResponse.json({ run });
  } catch {
    return NextResponse.json({ error: "保存自动化状态失败" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearAutomationRun();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "重置自动化状态失败" }, { status: 500 });
  }
}
