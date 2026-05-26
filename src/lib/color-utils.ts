/** 将 #RGB / #RRGGBB / #RRGGBBAA 或纯十六进制转为 #rrggbb（供 color input 与 Fabric） */
export function parseHexColorInput(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;

  if (!raw.startsWith("#")) {
    if (/^[0-9a-fA-F]{3,8}$/.test(raw)) {
      raw = `#${raw}`;
    } else {
      return null;
    }
  }

  const hex = raw.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;

  if (hex.length === 3) {
    const r = hex[0] + hex[0];
    const g = hex[1] + hex[1];
    const b = hex[2] + hex[2];
    return `#${r}${g}${b}`.toLowerCase();
  }

  if (hex.length === 6) {
    return `#${hex}`.toLowerCase();
  }

  if (hex.length === 8) {
    return `#${hex.slice(0, 6)}`.toLowerCase();
  }

  return null;
}

/** 将任意 CSS 颜色尽量转为 #rrggbb，无法解析时返回 null */
export function toHexColor(color: string): string | null {
  const fromHex = parseHexColorInput(color);
  if (fromHex) return fromHex;

  const rgb = color.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i
  );
  if (rgb) {
    const parts = [rgb[1], rgb[2], rgb[3]].map((n) => {
      const v = Math.min(255, Math.max(0, Number(n)));
      return v.toString(16).padStart(2, "0");
    });
    return `#${parts.join("")}`;
  }

  return null;
}

/** 供 type=color 使用，无法解析时回退默认色 */
export function toHexColorOrFallback(
  color: string,
  fallback = "#1a1a1a"
): string {
  return toHexColor(color) ?? fallback;
}
