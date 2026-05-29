import { promises as fs } from "node:fs";

const raw = await fs.readFile("data/templates.json", "utf8");
console.log("文件字符数:", raw.length, "约", (raw.length / 1024 / 1024).toFixed(2), "MB");

const idRe = /"id":\s*"[0-9a-f-]{36}"/g;
const ids = [...raw.matchAll(idRe)];
console.log("顶层 id 字段出现次数:", ids.length);

const err = 768901;
console.log("\n损坏位置附近文本:");
console.log(raw.slice(err - 60, err + 100));
