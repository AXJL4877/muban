import {
  APP_STATE_KEYS,
  deleteAppState,
  getAppState,
  setAppState,
} from "@/lib/app-state-store";
import type { AutomationRunState } from "@/types/automation-run";

export async function getAutomationRun(): Promise<AutomationRunState | null> {
  const value = await getAppState<AutomationRunState | null>(
    APP_STATE_KEYS.automationRun
  );
  if (!value || typeof value !== "object") return null;
  return value;
}

export async function saveAutomationRun(state: AutomationRunState): Promise<AutomationRunState> {
  await setAppState(APP_STATE_KEYS.automationRun, state);
  return state;
}

export async function clearAutomationRun(): Promise<void> {
  await deleteAppState(APP_STATE_KEYS.automationRun);
}
