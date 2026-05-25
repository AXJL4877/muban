export interface StreamDelta {
  content?: string;
  reasoning?: string;
}

export async function consumeChatSSE(
  response: Response,
  onDelta: (delta: StreamDelta) => void
): Promise<void> {
  if (!response.body) {
    throw new Error("流式响应体为空");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const json = JSON.parse(data) as {
          choices?: {
            delta?: {
              content?: string | null;
              reasoning_content?: string | null;
            };
          }[];
          error?: { message?: string };
        };

        if (json.error?.message) {
          throw new Error(json.error.message);
        }

        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;

        const patch: StreamDelta = {};
        if (delta.content) patch.content = delta.content;
        if (delta.reasoning_content) patch.reasoning = delta.reasoning_content;
        if (patch.content || patch.reasoning) onDelta(patch);
      } catch (err) {
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }
  }
}
