/** 宜在此类标点之后断行 */
const BREAK_AFTER_CHARS =
  "，。！？；：、,.!?;:…—·）)】》」』\"'”’";

/** 不宜在此类标点之前断行（应留在下一行开头） */
const BREAK_BEFORE_CHARS = "，。！？；：、,.!?;:…—·（(【《「『\"'“‘";

export interface WrapTextOptions {
  /** 每行最大字数（含标点） */
  maxCharsPerLine: number;
  /** 优先在标点处断行 */
  respectPunctuation?: boolean;
}

function isBreakAfter(ch: string): boolean {
  return /\s/.test(ch) || BREAK_AFTER_CHARS.includes(ch);
}

function isBreakBefore(ch: string): boolean {
  return BREAK_BEFORE_CHARS.includes(ch);
}

function findBreakIndex(
  text: string,
  start: number,
  maxEnd: number,
  respectPunctuation: boolean
): number {
  const hardEnd = Math.min(start + maxEnd, text.length);
  if (hardEnd >= text.length) return text.length;

  if (!respectPunctuation) return hardEnd;

  let best = -1;
  for (let i = hardEnd; i > start; i--) {
    const prev = text[i - 1];
    if (prev && isBreakAfter(prev)) {
      best = i;
      break;
    }
  }

  if (best > start) return best;

  for (let i = hardEnd; i > start + 1; i--) {
    if (!isBreakBefore(text[i])) {
      return i;
    }
  }

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
 * 按每行字数上限自动换行，优先在标点处断开
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
