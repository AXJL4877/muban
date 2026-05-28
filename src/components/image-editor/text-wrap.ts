export interface WrapTextOptions {
  /** 每行最大字数（含标点） */
  maxCharsPerLine: number;
  /** @deprecated 已改为严格按字数换行，此字段保留兼容 */
  respectPunctuation?: boolean;
}

function findBreakIndex(
  text: string,
  start: number,
  maxEnd: number,
  _respectPunctuation: boolean
): number {
  const hardEnd = Math.min(start + maxEnd, text.length);
  if (hardEnd >= text.length) return text.length;
  return hardEnd;
}

function wrapParagraph(
  paragraph: string,
  maxChars: number,
  respectPunctuation: boolean
): string {
  const trimmed = paragraph.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;

  const lines: string[] = [];
  let i = 0;
  while (i < trimmed.length) {
    let breakAt = findBreakIndex(trimmed, i, maxChars, respectPunctuation);
    if (breakAt <= i) {
      breakAt = Math.min(i + maxChars, trimmed.length);
      if (breakAt <= i) breakAt = Math.min(i + 1, trimmed.length);
    }

    const chunk = trimmed.slice(i, breakAt).trimEnd();
    if (chunk.length > 0) lines.push(chunk);

    i = breakAt;
    while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
  }

  return lines.join("\n");
}

/**
 * 按每行字数上限自动换行（严格按字数，不因标点提前断行）
 */
export function wrapTextByRules(
  text: string,
  options: WrapTextOptions
): string {
  const max = Math.max(2, Math.min(80, Math.round(options.maxCharsPerLine)));
  const respectPunctuation = options.respectPunctuation !== false;

  return text
    .split("\n")
    .map((p) => wrapParagraph(p, max, respectPunctuation))
    .map((line) => line.trimEnd())
    .join("\n");
}

/** 校验换行后字符是否完整（忽略换行符与空白差异） */
export function assertWrapPreservesText(source: string, wrapped: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, "");
  return norm(source) === norm(wrapped);
}
