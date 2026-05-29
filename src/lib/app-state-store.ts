import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function getAppState<T>(key: string): Promise<T | null> {
  const row = await db.appState.findUnique({ where: { key } });
  if (!row) return null;
  return row.value as T;
}

export async function setAppState<T>(key: string, value: T): Promise<void> {
  await db.appState.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue },
  });
}

export async function deleteAppState(key: string): Promise<void> {
  await db.appState.deleteMany({ where: { key } });
}

export const APP_STATE_KEYS = {
  automationRun: "automation-run",
  wechatPrefs: "wechat-prefs",
} as const;
