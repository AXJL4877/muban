import { promises as fs } from "node:fs";

function extractFirstJsonArray(raw) {
  const start = raw.indexOf("[");
  if (start === -1) return { end: -1, slice: "[]" };
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) return { end: i, slice: raw.slice(start, i + 1) };
    }
  }
  return { end: -1, slice: "[]" };
}

const raw = await fs.readFile("data/templates.json", "utf8");
const { end, slice } = extractFirstJsonArray(raw);
const arr = JSON.parse(slice);
console.log("解析结束位置:", end, "约行", raw.slice(0, end).split("\n").length);
console.log("解析出条数:", arr.length);
console.log("slice 末尾 200 字符:", slice.slice(-200));
