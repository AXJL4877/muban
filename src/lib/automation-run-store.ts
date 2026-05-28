import { promises as fs } from "node:fs";
import path from "node:path";
import type { AutomationRunState } from "@/types/automation-run";

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(STORE_DIR, "automation-run.json");

async function ensureStoreFile(): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(STORE_FILE, "null", "utf8");
  }
}

export async function getAutomationRun(): Promise<AutomationRunState | null> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  if (!raw.trim() || raw.trim() === "null") return null;
  try {
    const parsed = JSON.parse(raw) as AutomationRunState;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveAutomationRun(state: AutomationRunState): Promise<AutomationRunState> {
  await ensureStoreFile();
  await fs.writeFile(STORE_FILE, JSON.stringify(state, null, 2), "utf8");
  return state;
}

export async function clearAutomationRun(): Promise<void> {
  await ensureStoreFile();
  await fs.writeFile(STORE_FILE, "null", "utf8");
}
