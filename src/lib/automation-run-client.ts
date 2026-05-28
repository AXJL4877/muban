import type { AutomationRunState } from "@/types/automation-run";

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

export async function loadAutomationRun(): Promise<AutomationRunState | null> {
  const data = await requestJson<{ run: AutomationRunState | null }>("/api/automation/run");
  return data.run;
}

export async function persistAutomationRun(run: AutomationRunState): Promise<AutomationRunState> {
  const data = await requestJson<{ run: AutomationRunState }>("/api/automation/run", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run }),
  });
  return data.run;
}

export async function resetAutomationRun(): Promise<void> {
  await requestJson("/api/automation/run", { method: "DELETE" });
}
