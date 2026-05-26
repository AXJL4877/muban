export interface FontOption {
  family: string;
  source: "system" | "custom";
  url?: string;
}

export const SYSTEM_FONT_OPTIONS = [
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Verdana",
  "微软雅黑",
  "宋体",
  "黑体",
  "PingFang SC",
  "sans-serif",
] as const;

export function buildSystemFontOptions(): FontOption[] {
  return SYSTEM_FONT_OPTIONS.map((family) => ({
    family,
    source: "system",
  }));
}

export async function fetchCustomFonts(): Promise<FontOption[]> {
  try {
    const res = await fetch("/api/fonts", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      fonts?: { family: string; url: string }[];
    };
    return (data.fonts ?? []).map((f) => ({
      family: f.family,
      source: "custom" as const,
      url: f.url,
    }));
  } catch {
    return [];
  }
}

const loadedFamilies = new Set<string>();

export async function loadFontFace(family: string, url: string): Promise<void> {
  if (loadedFamilies.has(family)) return;

  const font = new FontFace(family, `url(${url})`);
  await font.load();
  document.fonts.add(font);
  loadedFamilies.add(family);
}

export async function loadAllCustomFonts(fonts: FontOption[]): Promise<void> {
  const tasks = fonts
    .filter((f) => f.source === "custom" && f.url)
    .map((f) => loadFontFace(f.family, f.url!));
  await Promise.allSettled(tasks);
}

export async function uploadFontFile(file: File): Promise<FontOption> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/fonts", {
    method: "POST",
    body: formData,
  });

  const data = (await res.json()) as {
    family?: string;
    url?: string;
    error?: string;
  };

  if (!res.ok || !data.family || !data.url) {
    throw new Error(data.error ?? "字体上传失败");
  }

  return {
    family: data.family,
    source: "custom",
    url: data.url,
  };
}

/** 拉取并注册全部自定义字体，返回合并后的字体列表 */
export async function prepareFontCatalog(): Promise<FontOption[]> {
  const custom = await fetchCustomFonts();
  await loadAllCustomFonts(custom);
  return mergeFontOptions(custom);
}

export function mergeFontOptions(custom: FontOption[]): FontOption[] {
  const system = buildSystemFontOptions();
  const seen = new Set(system.map((f) => f.family));
  const merged = [...system];
  for (const font of custom) {
    if (seen.has(font.family)) continue;
    seen.add(font.family);
    merged.push(font);
  }
  return merged;
}
