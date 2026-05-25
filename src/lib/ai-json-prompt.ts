import {
  buildFieldInstructions,
  buildJsonSchemaExample,
  getEnabledKeys,
} from "@/lib/ai-template-keys";
import type { TemplateJsonKeyConfig } from "@/types/ai-template-keys";

/** DeepSeek json_object 模式建议的 max_tokens，降低 JSON 被截断风险 */
export const JSON_MAX_TOKENS = 8192;

const JSON_RULES = `规则：
1. 只输出 json 对象本身，不要 Markdown 代码块，不要任何解释性文字。
2. 键名必须与下列字段列表完全一致，不要增加未列出的顶层键（除非字段说明中允许嵌套对象/数组）。
3. 字符串、数组、嵌套对象须符合 json 语法；不要尾随逗号。
4. 若信息不足，用合理默认值补全；可加 "_note" 字段说明假设。
5. 若无法生成，输出 json：{"error":"原因说明"}`;

export function buildSystemMessageFromTemplateKeys(
  keys: TemplateJsonKeyConfig[],
  structuredJson: boolean
): string | undefined {
  const enabled = getEnabledKeys(keys);
  if (enabled.length === 0) return undefined;

  const schema = buildJsonSchemaExample(keys);
  const fields = buildFieldInstructions(keys);
  const keyList = enabled.map((k) => k.key.trim()).join("、");

  const templatePart = `本次输出 json 对象必须包含且仅重点关注以下键：${keyList}

json 结构样例（值仅为占位，请按各字段要求生成真实内容）：

${schema}

各 json 键的生成要求：

${fields}`;

  if (!structuredJson) {
    return `You are a content generation assistant. 请根据下列字段要求生成内容，并以 json 对象形式组织输出（须含 json 字样之结构）。

${templatePart}`;
  }

  return `You are a JSON generation assistant. 你的唯一任务是输出一个完整、合法的 json 对象。

${templatePart}

${JSON_RULES}`;
}

export function buildUserMessage(
  topic: string,
  structuredJson: boolean,
  hasTemplateKeys: boolean
): string {
  const parts: string[] = [];
  const t = topic.trim();
  if (t) {
    parts.push(`本次主题：${t}`);
  }
  if (structuredJson) {
    parts.push(
      hasTemplateKeys
        ? "请结合 system 中的 json 键定义与各字段生成要求，围绕上述主题生成单个 json 对象。"
        : "请结合 system 中的 json 规则，围绕上述主题生成单个 json 对象。"
    );
  } else if (parts.length === 0) {
    parts.push("请根据 system 提示完成生成。");
  } else {
    parts.push("请根据 system 提示，围绕上述主题完成生成。");
  }
  return parts.join("\n\n");
}
