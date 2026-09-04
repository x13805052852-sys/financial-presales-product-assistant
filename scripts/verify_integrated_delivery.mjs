import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const [packageRoot, tdhSource, opsSource, wuyaSource] = process.argv.slice(2);
if (![packageRoot, tdhSource, opsSource, wuyaSource].every((value) => value && path.isAbsolute(value))) {
  throw new Error("Usage: node scripts/verify_integrated_delivery.mjs <package-root> <tdh-source> <ops-source> <wuya-source>");
}

const categories = [
  { name: "TDH", source: tdhSource, destination: path.join(packageRoot, "01_TDH/01_原始资料/TDH") },
  { name: "Ops", source: opsSource, destination: path.join(packageRoot, "02_Ops/01_原始资料/LLMops") },
  { name: "无涯", source: wuyaSource, destination: path.join(packageRoot, "03_无涯/01_原始资料/无涯") },
];

async function listFiles(root, current = root) {
  const entries = await fsp.readdir(current, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (entry.isDirectory()) result.push(...await listFiles(root, absolute));
    else {
      const stat = await fsp.lstat(absolute);
      result.push({ absolute, relative, size: stat.size, type: entry.isSymbolicLink() ? "symlink" : "file" });
    }
  }
  return result;
}

async function sha256(entry) {
  if (entry.type === "symlink") {
    return crypto.createHash("sha256").update(await fsp.readlink(entry.absolute)).digest("hex");
  }
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(entry.absolute);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function mapConcurrent(items, limit, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await callback(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, () => worker()));
  return results;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(3)} GB`;
}

const summaries = [];
const destinationHashes = new Map();
let verifiedFiles = 0;

for (const category of categories) {
  const [sourceFiles, destinationFiles] = await Promise.all([listFiles(category.source), listFiles(category.destination)]);
  const sourceMap = new Map(sourceFiles.map((entry) => [entry.relative, entry]));
  const destinationMap = new Map(destinationFiles.map((entry) => [entry.relative, entry]));
  const allPaths = [...new Set([...sourceMap.keys(), ...destinationMap.keys()])].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const mismatches = [];
  await mapConcurrent(allPaths, 4, async (relative) => {
    const source = sourceMap.get(relative);
    const destination = destinationMap.get(relative);
    if (!source || !destination) {
      mismatches.push(`${relative}: ${source ? "副本缺失" : "源目录不存在"}`);
      return;
    }
    if (source.type !== destination.type || source.size !== destination.size) {
      mismatches.push(`${relative}: 类型或大小不一致`);
      return;
    }
    const [sourceHash, destinationHash] = await Promise.all([sha256(source), sha256(destination)]);
    if (sourceHash !== destinationHash) mismatches.push(`${relative}: SHA-256 不一致`);
    destinationHashes.set(destination.absolute, destinationHash);
    verifiedFiles += 1;
    if (verifiedFiles % 100 === 0) console.log(`已校验 ${verifiedFiles} 个文件`);
  });
  const sourceBytes = sourceFiles.reduce((sum, entry) => sum + entry.size, 0);
  const destinationBytes = destinationFiles.reduce((sum, entry) => sum + entry.size, 0);
  summaries.push({
    name: category.name,
    sourceFiles: sourceFiles.length,
    destinationFiles: destinationFiles.length,
    sourceBytes,
    destinationBytes,
    mismatches: mismatches.sort(),
  });
}

const passed = summaries.every((item) => item.sourceFiles === item.destinationFiles && item.sourceBytes === item.destinationBytes && item.mismatches.length === 0);
const generatedAt = new Date().toISOString();
const reportLines = [
  "# 整合交付包校验报告",
  "",
  `生成时间：${generatedAt}`,
  "",
  `总结果：${passed ? "通过" : "不通过"}`,
  "",
  "## 原始资料副本校验",
  "",
  "| 分类 | 源文件数 | 副本文件数 | 源文件大小 | 副本大小 | SHA-256 不一致 | 结果 |",
  "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ...summaries.map((item) => `| ${item.name} | ${item.sourceFiles} | ${item.destinationFiles} | ${formatBytes(item.sourceBytes)} | ${formatBytes(item.destinationBytes)} | ${item.mismatches.length} | ${item.mismatches.length === 0 && item.sourceFiles === item.destinationFiles && item.sourceBytes === item.destinationBytes ? "通过" : "不通过"} |`),
  "",
  "校验同时比较相对路径、文件类型、文件大小和 SHA-256。隐藏文件、视频和压缩包均纳入校验。",
  "",
];
for (const item of summaries.filter((value) => value.mismatches.length)) {
  reportLines.push(`## ${item.name} 差异`, "", ...item.mismatches.map((difference) => `- ${difference}`), "");
}
const reportPath = path.join(packageRoot, "00_交付校验报告.md");
await fsp.writeFile(reportPath, `${reportLines.join("\n")}\n`, "utf8");

if (!passed) {
  console.error(JSON.stringify({ passed, summaries }, null, 2));
  process.exitCode = 2;
} else {
  const packageFiles = await listFiles(packageRoot);
  const manifestEntries = packageFiles.filter((entry) => entry.relative !== "00_文件校验清单.sha256");
  const manifestHashes = await mapConcurrent(manifestEntries, 4, async (entry, index) => {
    const hash = destinationHashes.get(entry.absolute) ?? await sha256(entry);
    if ((index + 1) % 200 === 0) console.log(`已生成 ${index + 1}/${manifestEntries.length} 条交付清单`);
    return { relative: entry.relative, hash };
  });
  manifestHashes.sort((a, b) => a.relative.localeCompare(b.relative, "zh-CN"));
  const manifest = manifestHashes.map((entry) => `${entry.hash}  ${entry.relative}`).join("\n");
  await fsp.writeFile(path.join(packageRoot, "00_文件校验清单.sha256"), `${manifest}\n`, "utf8");
  console.log(JSON.stringify({
    passed,
    verifiedSourceFiles: verifiedFiles,
    packageManifestFiles: manifestHashes.length,
    summaries,
  }, null, 2));
}
