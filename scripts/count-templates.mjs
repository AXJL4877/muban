import { promises as fs } from "node:fs";
import path from "node:path";

function extractFirstJsonArray(raw) {
  const start = raw.indexOf("[");
  if (start === -1) return "[]";
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
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return "[]";
}

const raw = await fs.readFile(path.join("data", "templates.json"), "utf8");
const arr = JSON.parse(extractFirstJsonArray(raw));
console.log("数组长度:", arr.length);
for (const t of arr) {
  console.log("-", t.id, t.name, t.recordType ?? "(无 recordType)");
}
