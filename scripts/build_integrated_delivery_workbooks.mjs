import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const repoRoot = process.cwd();
const targetRoot = process.argv[2];
if (!targetRoot || !path.isAbsolute(targetRoot)) {
  throw new Error("Usage: node scripts/build_integrated_delivery_workbooks.mjs <absolute-package-root>");
}

const fontName = "Arial";
const darkBlue = "#17365D";
const lightBlue = "#D9EAF7";
const lightGray = "#F2F2F2";

function columnName(columnNumber) {
  let result = "";
  let value = columnNumber;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

async function readCsvValues(relativePath, sheetName) {
  const csv = (await fs.readFile(path.join(repoRoot, relativePath), "utf8")).replace(/^\uFEFF/, "");
  const csvWorkbook = await Workbook.fromCSV(csv, { sheetName });
  return csvWorkbook.worksheets.getItem(sheetName).getUsedRange(true).values;
}

function inferredWidth(header, values) {
  const text = String(header ?? "");
  if (/编号|状态|难度|类型|确认人|冲突|置信度|文件数|数量/.test(text)) return 14;
  if (/日期|版本|扩展名|大小/.test(text)) return 16;
  if (/来源|路径|问题|需求|理由|条件|分工|答案|备注|别名|规则|限制/.test(text)) return 34;
  const longest = values.slice(0, 20).reduce((max, value) => Math.max(max, String(value ?? "").length), text.length);
  return Math.max(12, Math.min(28, longest + 2));
}

function styleTitle(sheet, title, subtitle, lastColumn) {
  sheet.showGridLines = false;
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1").format = { font: { name: fontName, size: 16, bold: true, color: "#1F2937" } };
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A2").format = { font: { name: fontName, size: 10, italic: true, color: "#667085" } };
  sheet.getRange(`A2:${lastColumn}2`).format.borders = { bottom: { style: "thin", color: "#B4C6E7" } };
  sheet.getRange("A1:A2").format.rowHeight = 24;
}

function styleHeader(range) {
  range.format = {
    fill: darkBlue,
    font: { name: fontName, size: 10, bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "inside", style: "thin", color: "#FFFFFF" },
  };
  range.format.rowHeight = 32;
}

function addDataSheet(workbook, name, matrix, tableName, options = {}) {
  if (!matrix.length || !matrix[0].length) throw new Error(`${name} has no data`);
  const sheet = workbook.worksheets.add(name);
  const rows = matrix.length;
  const columns = matrix[0].length;
  const lastColumn = columnName(columns);
  sheet.showGridLines = false;
  sheet.tabColor = options.tabColor ?? "#5B9BD5";
  sheet.getRangeByIndexes(0, 0, rows, columns).values = matrix;
  const table = sheet.tables.add(`A1:${lastColumn}${rows}`, true, tableName);
  table.style = "TableStyleMedium2";
  table.showFilterButton = true;
  styleHeader(sheet.getRange(`A1:${lastColumn}1`));
  const body = sheet.getRange(`A2:${lastColumn}${rows}`);
  body.format = { font: { name: fontName, size: 9, color: "#1F2937" }, verticalAlignment: "top", wrapText: true };
  body.format.rowHeight = options.rowHeight ?? 42;
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(options.freezeColumns ?? 2);
  matrix[0].forEach((header, index) => {
    const values = matrix.slice(1).map((row) => row[index]);
    const column = columnName(index + 1);
    sheet.getRange(`${column}1:${column}${rows}`).format.columnWidth = inferredWidth(header, values);
  });
  return sheet;
}

function addNotesSheet(workbook, name, title, rows) {
  const sheet = workbook.worksheets.add(name);
  styleTitle(sheet, title, "内部知识维护与售前测试使用", "F");
  const matrix = [["项目", "说明"], ...rows];
  sheet.getRangeByIndexes(3, 0, matrix.length, 2).values = matrix;
  styleHeader(sheet.getRange("A4:B4"));
  sheet.getRange(`A5:B${matrix.length + 3}`).format = {
    font: { name: fontName, size: 10, color: "#1F2937" },
    verticalAlignment: "top",
    wrapText: true,
    borders: { insideHorizontal: { style: "thin", color: "#D9E2F3" } },
  };
  sheet.getRange(`A5:B${matrix.length + 3}`).format.rowHeight = 44;
  sheet.getRange("A:A").format.columnWidth = 24;
  sheet.getRange("B:B").format.columnWidth = 90;
  return sheet;
}

async function exportWorkbook(workbook, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
}

async function buildTdhWorkbook() {
  const aliases = await readCsvValues("docs/knowledge/TDH_PRODUCT_ALIASES.csv", "Aliases");
  const capabilities = await readCsvValues("docs/knowledge/TDH_CAPABILITY_PRODUCT_MAPPING.csv", "Capabilities");
  const combinations = await readCsvValues("docs/knowledge/CROSS_PRODUCT_COMBINATION_MAPPING.csv", "Combinations");
  const tdhQuestions = await readCsvValues("docs/knowledge/TDH_SYNTHETIC_TEST_QUESTIONS_100.csv", "TdhQuestions");
  const crossQuestions = await readCsvValues("docs/knowledge/CROSS_PRODUCT_SYNTHETIC_TEST_QUESTIONS_100.csv", "CrossQuestions");
  const context = await readCsvValues("docs/knowledge/CONTEXT_TWO_TURN_TEST_QUESTIONS_100.csv", "Context");
  const inventory = await readCsvValues("docs/TDH_SOURCE_INVENTORY.csv", "Inventory");

  const workbook = Workbook.create();
  const overview = workbook.worksheets.add("产品总览");
  styleTitle(overview, "TDH 产品与配套产品知识库", "包含 TDH 单产品、ArgoDB、TDC、TDS、Astro 及跨产品组合；版本日期 2026-09-04", "H");
  overview.getRange("A4:H8").values = [
    ["资料清单", "核心资料", "产品别名", "功能映射", "组合映射", "单轮问题", "双轮测试", "当前状态"],
    [145, 6, 32, 34, 40, 200, 100, "待产品专家确认"],
    [null, null, null, null, null, null, null, null],
    ["产品", "主要职责", "产品", "主要职责", "产品", "主要职责", "产品", "主要职责"],
    ["TDH", "数据湖、湖仓集、批流处理和统一数据底座", "ArgoDB", "实时分析、HTAP 和数据库替代", "TDC", "数据平台、多集群和 AI 服务", "TDS", "接入、开发、治理、目录、质量和服务"],
  ];
  overview.getRange("A10:B10").values = [["Astro", "自然语言交互、智能建议与治理任务编排；不替代数据底座或专业治理工具"]];
  styleHeader(overview.getRange("A4:H4"));
  styleHeader(overview.getRange("A7:H7"));
  overview.getRange("A5:H5").format = { fill: lightBlue, font: { name: fontName, size: 11, bold: true }, horizontalAlignment: "center" };
  overview.getRange("A8:H10").format = { font: { name: fontName, size: 10 }, wrapText: true, verticalAlignment: "top" };
  overview.getRange("A:A").format.columnWidth = 18;
  overview.getRange("B:B").format.columnWidth = 36;
  overview.getRange("C:C").format.columnWidth = 18;
  overview.getRange("D:D").format.columnWidth = 36;
  overview.getRange("E:E").format.columnWidth = 18;
  overview.getRange("F:F").format.columnWidth = 36;
  overview.getRange("G:G").format.columnWidth = 18;
  overview.getRange("H:H").format.columnWidth = 36;

  addDataSheet(workbook, "产品别名", aliases, "TdhAliases", { tabColor: "#A5A5A5" });
  addDataSheet(workbook, "TDH功能映射", capabilities, "TdhCapabilities", { tabColor: "#70AD47" });
  addDataSheet(workbook, "配套组合映射", combinations, "TdhCombinations", { tabColor: "#70AD47", rowHeight: 50 });
  addDataSheet(workbook, "TDH单轮问题", tdhQuestions, "TdhSingleQuestions", { rowHeight: 48 });
  addDataSheet(workbook, "配套单轮问题", crossQuestions, "TdhCrossQuestions", { rowHeight: 48 });
  addDataSheet(workbook, "双轮上下文", context, "TdhContextQuestions", { rowHeight: 48 });
  addDataSheet(workbook, "资料清单", inventory, "TdhSourceInventory", { tabColor: "#A5A5A5" });
  addNotesSheet(workbook, "使用说明", "TDH 知识库总表使用说明", [
    ["使用顺序", "先在产品总览确认产品职责，再用功能映射或组合映射选型，最后用问题集和上下文集验证回答。"],
    ["TDH 单产品", "按售卖 Edition、版本、客户底座和数据时效确认，不能只回答笼统的 TDH。"],
    ["配套产品", "ArgoDB、TDC、TDS 和 Astro 各自承担不同职责，回答产品组合时必须说明分工。"],
    ["回答框架", "功能介绍：结论 + 主要功能 + 口径说明；产品选型：结论 + 推荐组合 + 产品分工；风险追问：冲突点 + 实际影响 + 销售口径。"],
    ["实时口径", "分钟级、秒级、亚秒级和毫秒级不能混用；资料没有明确证据时必须追问端到端要求。"],
    ["审核状态", "当前映射均为内部实验口径，产品专家确认后才能作为正式销售口径。"],
    ["资料来源", "所有知识条目保留文件名、页码或工作表来源；没有可靠来源时不得生成产品承诺。"],
    ["维护方法", "新增资料先完成重复、过期、冲突和敏感检查，再更新映射、问题集并运行完整回归测试。"],
  ]);

  const outputPath = path.join(targetRoot, "01_TDH/02_MD与Excel/TDH_知识库总表.xlsx");
  await exportWorkbook(workbook, outputPath);
  return { workbook, outputPath };
}

async function walkFiles(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const rows = [];
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (relative === "00_交付索引.xlsx" || relative === "00_文件校验清单.sha256") continue;
    if (entry.isDirectory()) rows.push(...await walkFiles(root, absolute));
    else {
      const stat = await fs.lstat(absolute);
      rows.push({ relative, size: stat.size, isLink: entry.isSymbolicLink() });
    }
  }
  return rows;
}

function fileIndexRows(files) {
  const header = ["分类", "资料层级", "相对路径", "扩展名", "大小(MB)", "用途", "使用限制"];
  const rows = files.sort((a, b) => a.relative.localeCompare(b.relative, "zh-CN")).map((file) => {
    const parts = file.relative.split("/");
    const category = parts[0] === "01_TDH" ? "TDH" : parts[0] === "02_Ops" ? "Ops" : parts[0] === "03_无涯" ? "无涯" : "总览";
    const layer = file.relative.includes("/01_原始资料/") ? "原始资料" : file.relative.includes("/02_MD与Excel/") ? "MD与Excel" : "根目录";
    const extension = file.isLink ? "链接" : path.extname(file.relative).toLowerCase().replace(/^\./, "") || "无扩展名";
    let purpose = layer === "原始资料" ? "原始业务资料" : extension === "md" ? "知识说明" : extension === "xlsx" ? "知识表或审核表" : "交付文件";
    let restriction = layer === "原始资料" ? "按资料清单、版本和保密要求使用" : "脱敏知识成果";
    if (["zip", "rar", "7z"].includes(extension)) {
      purpose = "压缩包或演示包";
      restriction = "受控使用；禁止默认执行或上传公开仓库";
    } else if (["mp4", "mov", "avi"].includes(extension)) {
      purpose = "视频资料";
      restriction = "没有复核转写时不单独支撑产品承诺";
    } else if (["wedrive", "ds_store"].includes(extension) || file.relative.includes("/.Temp/")) {
      purpose = "系统或网盘元数据";
      restriction = "排除知识检索";
    }
    return [category, layer, file.relative, extension, Number((file.size / 1048576).toFixed(3)), purpose, restriction];
  });
  return [header, ...rows];
}

async function buildIndexWorkbook() {
  const files = await walkFiles(targetRoot);
  const workbook = Workbook.create();
  const overview = workbook.worksheets.add("交付总览");
  styleTitle(overview, "金融售前产品助手交付索引", "TDH、Ops、无涯三类原始资料与知识库成果；版本日期 2026-09-04", "I");
  overview.getRange("A4:I8").values = [
    ["分类", "原始目录", "资料清单", "核心资料", "产品别名", "功能映射", "组合映射", "单轮问题", "双轮测试"],
    ["TDH", "TDH/", 145, 6, 32, 34, 40, 200, 100],
    ["Ops", "LLMops/", 36, 5, 24, 34, 15, 100, 100],
    ["无涯", "无涯/", 89, 9, 22, 34, 15, 100, 100],
    ["合计", "—", null, null, null, null, null, null, null],
  ];
  styleHeader(overview.getRange("A4:I4"));
  overview.getRange("C8").formulas = [["=SUM(C5:C7)"]];
  overview.getRange("D8").formulas = [["=SUM(D5:D7)"]];
  overview.getRange("E8").formulas = [["=SUM(E5:E7)"]];
  overview.getRange("F8").formulas = [["=SUM(F5:F7)"]];
  overview.getRange("G8").formulas = [["=SUM(G5:G7)"]];
  overview.getRange("H8").formulas = [["=SUM(H5:H7)"]];
  overview.getRange("I8").formulas = [["=SUM(I5:I7)"]];
  overview.getRange("A5:I8").format = { font: { name: fontName, size: 10 }, verticalAlignment: "center" };
  overview.getRange("A8:I8").format = { fill: lightBlue, font: { name: fontName, size: 10, bold: true } };
  overview.getRange("A11:D16").values = [
    ["验证项目", "结果", "状态", "说明"],
    ["Python 仓库检查", "26/26", "通过", "资料、映射、题库、工作簿结构和安全基线"],
    ["TypeScript 类型检查", "无错误", "通过", "tsc --noEmit"],
    ["TypeScript 功能测试", "69/69", "通过", "检索、回答框架、上下文、企业微信和安全"],
    ["单轮模拟检索", "400 条", "通过", "全部存在可追溯的 Top 3 知识结果"],
    ["真实销售与群测", "待执行", "未完成", "内部模拟指标不等同于真实销售正确率"],
  ];
  styleHeader(overview.getRange("A11:D11"));
  overview.getRange("A12:D16").format = { font: { name: fontName, size: 10 }, wrapText: true, verticalAlignment: "top" };
  overview.getRange("A19:B24").values = [
    ["上线前事项", "当前要求"],
    ["产品专家审核", "复核功能、组合、版本冲突和正式销售口径"],
    ["企业微信群测", "执行各产品 20 轮真实问答并登记错题"],
    ["凭证安全", "轮换已暴露凭证，不在 Excel、Markdown 或 GitHub 保存密钥"],
    ["完整回归", "专家修订和真实群测后再次运行全部测试"],
    ["发布评审", "完成灰度、监控、回滚和 Go/No-Go 评审"],
  ];
  styleHeader(overview.getRange("A19:B19"));
  overview.getRange("A20:B24").format = { font: { name: fontName, size: 10 }, wrapText: true, verticalAlignment: "top" };
  ["A", "B", "C", "D", "E", "F", "G", "H", "I"].forEach((column) => overview.getRange(`${column}:${column}`).format.columnWidth = column === "B" ? 30 : 18);
  overview.getRange("D:D").format.columnWidth = 28;

  const fileSheet = addDataSheet(workbook, "文件索引", fileIndexRows(files), "DeliveryFileIndex", { tabColor: "#A5A5A5", rowHeight: 30 });
  fileSheet.getRange("E:E").format.numberFormat = "0.000";

  addDataSheet(workbook, "产品总览", [["分类", "产品或模块", "主要职责", "不应混用"],
    ["TDH", "TDH", "数据湖、湖仓集、批流处理和统一数据底座", "按 Edition 和版本确认，不等同于所有配套产品"],
    ["TDH", "ArgoDB", "实时分析、HTAP 和数据库替代", "不等同于 TDH 数据湖"],
    ["TDH", "TDC", "数据平台、多集群统一管理和 AI 服务", "按版本区分数据服务与 AI 服务"],
    ["TDH", "TDS", "数据接入、开发、治理、目录、质量和服务", "不等同于数据底座"],
    ["TDH", "Astro", "智能识别、生成建议和编排治理任务", "不替代专业治理执行工具"],
    ["Ops", "Corpus Studio", "数据集、语料和知识加工", "不等同于业务知识门户"],
    ["Ops", "Model Foundry", "模型接入、训练、评测、发布和资产管理", "不等同于单一推理接口"],
    ["Ops", "Knowledge Lodge", "知识库、RAG 和知识工程", "不等同于无涯问知的完整用户入口"],
    ["Ops", "Agent Go", "智能体创建、编排和工具调用", "旧称与当前名称需按版本确认"],
    ["Ops", "AI Infra", "GPU、推理服务、资源调度和运维", "不等同于业务智能体"],
    ["无涯", "TKH / 无涯·问知", "企业知识平台、多模态知识和 RAG 问答", "问知不承担专业结构化问数"],
    ["无涯", "无涯·问数 / Logits", "自然语言查询结构化数据、分析和可视化", "不替代完整数据治理平台"],
    ["无涯", "Co-Worker / XClaw", "跨系统执行多步骤任务并交付结果", "XClaw 与 Co-Worker 关系需按版本确认"],
  ], "DeliveryProductOverview", { tabColor: "#70AD47", rowHeight: 44 });

  addDataSheet(workbook, "测试汇总", [["分类", "测试集", "数量", "当前结果", "口径限制", "下一步"],
    ["全量", "单轮模拟检索", 400, "可追溯 Top 3 结果", "内部模拟映射一致性", "产品专家审核"],
    ["全量", "双轮上下文", 300, "已纳入自动回归", "只继承同群同用户上一轮", "企业微信真实群测"],
    ["Ops", "有明确预期映射的单轮问题", 96, "96/96 Top 3 命中", "不等同于真实销售正确率", "专家复核错题和边界"],
    ["无涯", "有明确预期映射的单轮问题", 96, "96/96 Top 3 命中", "不等同于真实销售正确率", "专家复核错题和边界"],
    ["无涯", "双轮继承判断", 100, "100/100 符合预期", "模拟会话", "测试群验证"],
    ["仓库", "Python 检查", 26, "26/26 通过", "本地自动检查", "保持持续集成"],
    ["仓库", "TypeScript 测试", 69, "69/69 通过", "本地自动检查", "保持持续集成"],
  ], "DeliveryTestSummary", { tabColor: "#ED7D31", rowHeight: 38 });

  addNotesSheet(workbook, "使用说明", "整合交付包使用说明", [
    ["目录结构", "每个分类的 01_原始资料 保持源目录结构，02_MD与Excel 提供重新整理的知识成果。"],
    ["查找产品", "先看产品总览，再进入分类知识库总表的功能映射和组合映射。"],
    ["资料溯源", "知识条目通过资料来源字段定位文件、页码、幻灯片或工作表。"],
    ["版本冲突", "优先使用明确版本和当前资料；无法确认时提示风险并追问，不直接承诺。"],
    ["专家审核", "当前映射为内部候选口径，产品专家需要填写正式结论、审核人和日期。"],
    ["企业微信", "真实群测后填写实际回答、命中知识、响应时间、判定和缺陷级别。"],
    ["敏感资料", "本地原始资料可能包含内部部署文件和压缩包，只能受控使用；禁止上传公开仓库。"],
    ["GitHub", "仅上传脱敏文档、知识表、脚本和自动测试，不上传公司原始资料或凭证。"],
  ]);

  const outputPath = path.join(targetRoot, "00_交付索引.xlsx");
  await exportWorkbook(workbook, outputPath);
  return { workbook, outputPath, fileCount: files.length };
}

const tdh = await buildTdhWorkbook();
const index = await buildIndexWorkbook();

const tdhInspect = await tdh.workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 5000 });
const indexInspect = await index.workbook.inspect({ kind: "table", range: "交付总览!A1:I24", include: "values,formulas", tableMaxRows: 24, tableMaxCols: 9, maxChars: 8000 });
const tdhErrors = await tdh.workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 300 }, summary: "TDH formula error scan" });
const indexErrors = await index.workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 300 }, summary: "index formula error scan" });

const previewDir = path.join(repoRoot, "work/integrated_delivery/previews");
await fs.mkdir(previewDir, { recursive: true });
for (const [workbook, sheetName, fileName] of [
  [tdh.workbook, "产品总览", "TDH_产品总览.png"],
  [tdh.workbook, "TDH功能映射", "TDH_功能映射.png"],
  [tdh.workbook, "配套组合映射", "TDH_配套组合映射.png"],
  [index.workbook, "交付总览", "交付总览.png"],
  [index.workbook, "文件索引", "文件索引.png"],
  [index.workbook, "产品总览", "全产品总览.png"],
]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(path.join(previewDir, fileName), new Uint8Array(await preview.arrayBuffer()));
}

console.log(JSON.stringify({
  tdhOutput: tdh.outputPath,
  indexOutput: index.outputPath,
  indexedFiles: index.fileCount,
  tdhSheets: tdhInspect.ndjson,
  indexOverview: indexInspect.ndjson,
  tdhFormulaErrors: tdhErrors.ndjson,
  indexFormulaErrors: indexErrors.ndjson,
}, null, 2));
