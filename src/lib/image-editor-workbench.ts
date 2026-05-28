const EDITING_WORK_IDS_KEY = "image-editor-editing-work-ids";

function parseEditingIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}

function writeEditingIds(ids: string[]): void {
  localStorage.setItem(EDITING_WORK_IDS_KEY, JSON.stringify(Array.from(new Set(ids))));
}

function emitEditingChanged(): void {
  window.dispatchEvent(new CustomEvent("image-editor-editing-works-changed"));
}

export function loadEditingWorkIds(): string[] {
  if (typeof window === "undefined") return [];
  return parseEditingIds(localStorage.getItem(EDITING_WORK_IDS_KEY));
}

export function setWorkEditing(workId: string, editing: boolean): void {
  if (typeof window === "undefined") return;
  const current = loadEditingWorkIds();
  const next = editing
    ? Array.from(new Set([...current, workId]))
    : current.filter((id) => id !== workId);
  writeEditingIds(next);
  emitEditingChanged();
}

export function subscribeEditingWorks(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === EDITING_WORK_IDS_KEY) listener();
  };
  const onCustom = () => listener();
  window.addEventListener("storage", onStorage);
  window.addEventListener("image-editor-editing-works-changed", onCustom as EventListener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("image-editor-editing-works-changed", onCustom as EventListener);
  };
}
