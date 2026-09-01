import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const mappingPath = `${repoRoot}/docs/knowledge/CROSS_PRODUCT_COMBINATION_MAPPING.csv`;
const questionPath = `${repoRoot}/docs/knowledge/CROSS_PRODUCT_SYNTHETIC_TEST_QUESTIONS_100.csv`;
const outputPath = `${repoRoot}/outputs/跨产品组合_第二批100条模拟销售问题.xlsx`;
const previewDir = `${repoRoot}/work/visual/cross_product_questions`;

const S = {
  tdh: "TDH & ArgoDB 售卖版本介绍20250717-v9.4.3.pptx#第4-23页",
  tds: "202512TDH&TDC&TDS销售方案更新202512_v2_价格脱敏.pptx#第15-17页",
  tdc: "202512TDH&TDC&TDS销售方案更新202512_v2_价格脱敏.pptx#第10-14页",
  ap: "ArgoDB 实时数仓解决方案_最新.pptx#第12-23页",
  htap: "【解决方案&销售培训】ArgoDB HTAP 架构演进与业务场景实践_v4（final）_2026.pptx#第5-25页",
  argo: "ArgoDB V6.2 技术白皮书.pdf#第3-9页",
  astro: "Astro产品介绍-2026-v4.pptx#第5-21页",
  astroWp: "Astro白皮书-中文260717.pdf#第5-9页",
};

const joinSources = (...values) => [...new Set(values.flatMap((value) => value.split("；")))].join("；");

const m = (
  id,
  need,
  split,
  main,
  roles,
  optional,
  applies,
  ask,
  excludes,
  source,
  conflict = "无",
  confidence = "高",
) => ({
  映射编号: id,
  销售复合需求: need,
  能力拆分: split,
  主推组合: main,
  产品分工: roles,
  可选组合: optional,
  适用条件: applies,
  必须追问: ask,
  排除条件: excludes,
  资料来源: source,
  资料冲突: conflict,
  推荐置信度: confidence,
  产品专家: "待指定",
  审核状态: "待产品专家确认",
  优化备注: "",
});

const mappings = [
  m("CP-M001", "多源批量数据进入数据湖并完成开发", "批量接入；SQL 开发；任务调度；数据湖存储", "TDH 数据湖版 + TDS-SUITE-T", "TDH：数据湖存储与批处理；TDS-SUITE-T：Transporter、SQLBook、Workflow 等接入与开发工具", "TDH 湖仓版 + TDS-SUITE-T", "以离线或批量接入为主，目标是 TDH 数据湖", "是否同时需要实时同步、治理和数据服务？", "若要求秒级写入即分析，应比较 ArgoDB AP", joinSources(S.tdh, S.tds)),
  m("CP-M002", "数据实时同步进入湖仓并对外提供数据服务", "实时同步；湖仓沉淀；数据服务", "TDH 湖仓集一体版 + TDS-SUITE-R", "TDH：湖仓集存储与分钟级增量加工；TDS-SUITE-R：Flashsync 实时同步、Midgard 数据服务", "TDH 湖仓集一体版 + TDS-SUITE-E", "分钟级时效可接受，且希望湖仓集统一", "目标时效是分钟、秒还是亚秒？是否还要完整开发治理？", "亚秒级写入即分析优先比较 ArgoDB AP", joinSources(S.tdh, S.tds)),
  m("CP-M003", "实时数据进入分析数据库并同时做治理", "实时同步；实时分析数据库；目录、标准、质量和分类", "ArgoDB AP + TDS-SUITE-R + TDS-SUITE-D", "ArgoDB AP：实时写入与分析；TDS-SUITE-R：实时同步和服务；TDS-SUITE-D：目录与治理", "ArgoDB AP + TDS-SUITE-E", "以 AP 分析负载为主，数据写入后需要快速查询", "时效、数据源、是否包含事务、治理范围是什么？", "核心事务也迁移时需比较 ArgoDB HTAP", joinSources(S.ap, S.argo, S.tds)),
  m("CP-M004", "数据开发、治理和运维工具希望一次配齐", "数据接入；开发；治理；服务；运维", "TDH 或 ArgoDB 数据底座 + TDS-SUITE-E", "TDH/ArgoDB：数据底座；TDS-SUITE-E：接入、开发、治理、服务和运维完整工具集", "按范围拆分 TDS-SUITE-T + TDS-SUITE-D + TDS-SUITE-R", "客户需要完整工具链，且底层平台已确定或可同步选型", "底层是 TDH 还是 ArgoDB？是否所有 TDS 能力都需要？", "不能把 TDS-SUITE-E 当作数据库或存储引擎", joinSources(S.tdh, S.argo, S.tds)),
  m("CP-M005", "为现有数据平台补齐元数据目录、质量和分类分级", "数据目录；治理；质量；分类分级", "现有 TDH 或 ArgoDB + TDS-SUITE-D", "TDH/ArgoDB：保存和处理数据；TDS-SUITE-D：Catalog、Governor、Defensor 治理能力", "现有平台 + TDS-SUITE-E", "底层平台可保留，主要缺少专业治理工具", "是否还缺数据开发、实时同步或数据服务？", "若只需要智能建议而无治理执行工具，不应只配 Astro", joinSources(S.tds, S.argo)),
  m("CP-M006", "现有平台既要专业治理又要智能化治理助手", "治理工具；智能语义、标准、质量和分类；任务编排", "TDH 或 ArgoDB + TDS-SUITE-D + Astro", "TDH/ArgoDB：数据底座；TDS-SUITE-D：治理执行工具；Astro：智能体理解、生成并编排治理任务", "TDS-SUITE-E + Astro", "客户已有数据底座，希望在治理工具上叠加智能化", "现有治理工具、允许 Astro 调用的接口和治理范围是什么？", "Astro 不替代底层存储和治理执行工具", joinSources(S.tds, S.astro, S.astroWp)),
  m("CP-M007", "希望用自然语言自动发现数据并发起数据接入", "资产发现；接入方案生成；接入任务执行；目标存储", "TDH 或 ArgoDB + TDS-SUITE-T/R + Astro 数据发现与接入智能体", "TDH/ArgoDB：目标数据底座；TDS：执行批量或实时接入；Astro：发现数据、理解需求并编排接入", "第三方接入工具 + Astro API/MCP", "接入工具可被 API/MCP 调用，且数据源权限已授权", "数据源类型、批量或实时、目标平台和凭证边界是什么？", "Astro 不能绕过权限直接读取未知数据源", joinSources(S.tds, S.astro, S.astroWp)),
  m("CP-M008", "自然语言生成开发代码并自动编排调度", "代码生成；SQL 开发；任务调度；底层执行", "TDH 或 ArgoDB + TDS-SUITE-T + Astro 代码生成与调度智能体", "TDH/ArgoDB：执行与存储；TDS-SUITE-T：SQLBook、Workflow 等开发调度；Astro：代码生成和任务编排", "现有第三方开发调度平台 + Astro API/MCP", "已有可调用的数据开发工具，生成代码必须经过审核", "开发语言、调度系统、发布审批和权限范围是什么？", "不能承诺生成代码无需人工审核即可上线", joinSources(S.tds, S.astro)),
  m("CP-M009", "自动发现资产、打标签并挂载到数据目录", "资产发现；目录；资产标签；资产挂载", "TDH 或 ArgoDB + TDS-SUITE-E + Astro 资产智能体", "TDH/ArgoDB：资产所在底座；TDS Catalog：目录与资产管理；Astro：发现、标签和挂载智能化", "TDS-SUITE-D + Astro", "客户已有或计划建设统一数据目录", "资产范围、目录系统和标签审批流程是什么？", "资料对资产标签智能体口径有差异，需专家确认", joinSources(S.tds, S.astro, S.astroWp), "有", "中"),
  m("CP-M010", "把治理后的数据通过 API 对外服务并由智能助手编排", "数据服务；权限；智能编排；API/MCP", "TDH 或 ArgoDB + TDS-SUITE-E + Astro", "TDH/ArgoDB：数据底座；Midgard/TDS：数据服务；Astro：通过 Pilot、API 或 MCP 编排调用", "TDS-SUITE-R + Astro", "需将已治理数据安全地开放给内部应用", "服务对象、接口 SLA、权限审批和现有服务工具是什么？", "Astro 不是数据服务网关，也不能绕过权限", joinSources(S.tds, S.astro)),

  m("CP-M011", "分钟级业务数据入湖并同步完成基础治理", "分钟级接入；数据湖；目录、质量和分类", "TDH 数据湖版 + TDS-SUITE-T + TDS-SUITE-D", "TDH：数据湖底座；TDS-SUITE-T：接入开发；TDS-SUITE-D：治理", "TDH 湖仓集一体版 + TDS-SUITE-E", "分钟级可接受，主要目标是入湖和治理", "是否需要逐层增量加工、数据集市或亚秒分析？", "秒级或亚秒级写入即分析需比较 ArgoDB AP", joinSources(S.tdh, S.tds)),
  m("CP-M012", "实时湖仓分层加工并叠加智能治理", "分钟级增量加工；湖仓分层；治理；智能辅助", "TDH 湖仓集一体版 + TDS-SUITE-D + Astro", "TDH：湖仓集和增量加工；TDS-SUITE-D：治理执行；Astro：智能治理辅助", "TDH 湖仓集一体版 + TDS-SUITE-E + Astro", "重点是统一湖仓集和分钟级增量加工", "端到端时效、分层模型和智能化范围是什么？", "亚秒级实时仓优先比较 ArgoDB AP", joinSources(S.tdh, S.tds, S.astro)),
  m("CP-M013", "秒级或亚秒级分析数据库配套完整治理", "实时写入；低延迟分析；实时同步；治理", "ArgoDB AP + TDS-SUITE-R + TDS-SUITE-D", "ArgoDB AP：实时数仓与 AP 分析；TDS-SUITE-R：实时同步；TDS-SUITE-D：治理", "ArgoDB AP + TDS-SUITE-E", "分析负载为主，要求写入后快速分析", "可接受延迟、写入方式、并发和治理范围是什么？", "若事务是主负载，应比较 ArgoDB HTAP", joinSources(S.ap, S.argo, S.tds)),
  m("CP-M014", "CRM、ERP 等事务系统同时需要实时分析和治理", "高并发事务；分析；一致性；治理", "ArgoDB HTAP + TDS-SUITE-D", "ArgoDB HTAP：事务与分析混合数据库；TDS-SUITE-D：企业级数据治理", "ArgoDB HTAP + TDS-SUITE-E", "事务与分析并存，属于 B 类内部业务系统", "事务并发、一致性、方言、迁移窗口和治理范围是什么？", "纯 AP 数仓不应因有实时写入直接选 HTAP", joinSources(S.htap, S.argo, S.tds)),
  m("CP-M015", "核心库数据实时下移分析并完成治理", "低影响同步；分析下移；实时数仓；治理", "ArgoDB AP + TDS-SUITE-R + TDS-SUITE-D", "ArgoDB AP：承接核心数据实时分析；TDS-SUITE-R：同步和数据服务；TDS-SUITE-D：治理", "ArgoDB AP + TDS-SUITE-E", "事务仍留在核心系统，分析负载下移", "源库类型、同步 SLA、是否回写和治理范围是什么？", "若要替换核心事务库，应转为 HTAP 评估", joinSources(S.ap, S.tds)),
  m("CP-M016", "事件流清洗后进入实时湖仓或数据库并治理", "流式 ETL；实时存储分析；治理", "Slipstream + ArgoDB AP + TDS-SUITE-D", "Slipstream：流式 ETL；ArgoDB AP：实时存储与分析；TDS-SUITE-D：治理", "Slipstream + TDH 湖仓集一体版 + TDS-SUITE-D", "需要流处理，且目标是实时分析数据库", "端到端时效、计算逻辑和目标底座是什么？", "若只需分钟级增量加工，可优先比较 TDH 湖仓集一体版", joinSources(S.ap, S.argo, S.tds)),
  m("CP-M017", "事件流既要消息持久化、实时计算又要入库治理", "事件存储；流计算；数据底座；治理", "Event Store + Slipstream + ArgoDB AP + TDS-SUITE-D", "Event Store：事件持久化；Slipstream：流计算；ArgoDB AP：实时分析；TDS-SUITE-D：治理", "Event Store + Slipstream + TDH 湖仓集一体版 + TDS-SUITE-D", "存在持续事件流、复杂处理和下游分析", "是否已有 Kafka、事件保留周期和目标时效是什么？", "已有消息平台可保留时，不应默认新增 Event Store", joinSources(S.argo, S.tds)),
  m("CP-M018", "只补实时同步和数据服务工具，不更换底层平台", "实时同步；数据服务；现有底座", "现有 TDH 或 ArgoDB + TDS-SUITE-R", "现有底座：存储计算；TDS-SUITE-R：Flashsync 实时同步与 Midgard 数据服务", "现有平台 + TDS-SUITE-E", "底层平台满足要求，只缺实时同步和服务", "是否还缺开发、治理、目录和质量？", "TDS-SUITE-R 不等同实时数据库", joinSources(S.tds, S.ap)),
  m("CP-M019", "实时链路中增加数据质量检查和智能质量分析", "实时数据；质量规则执行；智能质量建议", "TDH 或 ArgoDB + TDS-SUITE-D + Astro 数据质量智能体", "TDH/ArgoDB：数据底座；TDS Governor：质量规则与治理执行；Astro：智能质量分析和任务编排", "TDS-SUITE-D", "已具备或计划建设质量规则体系", "规则来源、阻断策略、责任人和实时 SLA 是什么？", "Astro 不能替代正式质量规则审批", joinSources(S.tds, S.astro)),
  m("CP-M020", "实时入库时识别敏感数据并完成分类分级", "实时接入；分类分级；权限与审计；智能识别", "ArgoDB AP 或 TDH + TDS-SUITE-D + Astro 分类分级智能体", "底座：接收和保存数据；Defensor/TDS：分类分级与安全治理；Astro：智能识别和编排", "底座 + TDS-SUITE-D", "客户有明确的敏感数据制度和审批流程", "法规、数据域、分级标准和实时阻断要求是什么？", "不能让智能体自动发布未经审批的分级结果", joinSources(S.tds, S.astro, S.argo)),

  m("CP-M021", "区分 Astro 智能治理与 TDS 专业治理工具", "智能理解编排；治理执行；底层工具", "TDS + Astro", "TDS：接入、开发、治理和服务的专业工具；Astro：自然语言交互、生成建议并调用工具", "仅 TDS", "希望保留专业治理流程并提高智能化效率", "当前是否已有 TDS 或第三方治理工具？", "Astro 不能作为 TDS 的一比一替代", joinSources(S.tds, S.astro)),
  m("CP-M022", "区分 TDS 工具套件与 TDH、ArgoDB 数据底座", "工具层；存储计算层", "TDH 或 ArgoDB + 按需 TDS 套件", "TDH/ArgoDB：存储和计算；TDS：接入、开发、治理、服务和运维工具", "现有第三方工具 + TDH 或 ArgoDB", "客户同时需要数据底座和工具链", "底层负载与缺失工具分别是什么？", "TDS 不能独立承担数据库或数据湖存储", joinSources(S.tdh, S.argo, S.tds)),
  m("CP-M023", "区分 TDC 集群管理与 TDH、ArgoDB 计算存储", "平台管理；数据引擎", "TDC + TDH 或 ArgoDB", "TDC：部署、租户、资源和集群管理；TDH/ArgoDB：数据计算与存储", "单一数据引擎自带管理工具", "客户需要云原生或多集群统一管理", "是单集群还是多集群？是否需要多租户和跨集群调度？", "TDC 不是 SQL 查询、ETL 或数据治理引擎", joinSources(S.tdc, S.tdh, S.argo)),
  m("CP-M024", "区分 Slipstream 流计算与 Flashsync、Midgard 实时工具", "流式计算；实时同步；数据服务", "按任务选择 Slipstream 或 TDS-SUITE-R", "Slipstream：流式计算与事件处理；Flashsync：实时同步；Midgard：数据服务", "Slipstream + TDS-SUITE-R", "需求可拆为计算、同步或服务", "是否需要复杂流计算，还是仅同步与服务？", "不能把实时同步工具当作流计算引擎", joinSources(S.argo, S.tds)),
  m("CP-M025", "区分 ArgoDB AP 与 TDH 湖仓集一体版", "亚秒或秒级 AP；分钟级湖仓集；一表多用", "按时效与负载二选一", "ArgoDB AP：写入即分析和实时数仓；TDH 湖仓集一体版：统一湖仓集和分钟级增量加工", "两者分层组合", "需要根据时效、数据量和统一架构目标选型", "可接受延迟、查询并发、是否要湖仓集统一？", "不能只凭“实时”二字确定产品", joinSources(S.tdh, S.ap, S.argo), "无", "中"),
  m("CP-M026", "区分 ArgoDB HTAP 与 TDH 分析平台", "事务处理；分析；批量数据平台", "按事务负载决定 ArgoDB HTAP 或 TDH", "ArgoDB HTAP：事务与分析混合；TDH：数据湖、数仓和分析平台", "ArgoDB AP", "需要先判断核心负载是否包含高并发事务", "事务比例、一致性、并发、批处理和方言要求是什么？", "纯分析平台不应默认选择 HTAP", joinSources(S.htap, S.tdh, S.argo), "无", "中"),
  m("CP-M027", "区分 TDC Platform Service 与 Data Services 并叠加治理", "单集群或多集群管理；多租户；治理", "TDC Platform Service 或 TDC Data Services + TDS-SUITE-D", "TDC PS：单集群单租户管理；TDC DS：多集群多租户与跨集群调度；TDS：数据治理", "TDC + TDS-SUITE-E", "客户既有平台管理又有治理需求", "集群数量、租户数量、跨集群资源和治理范围是什么？", "治理能力不能只归给 TDC", joinSources(S.tdc, S.tds)),
  m("CP-M028", "选择 Astro Pilot、直接智能体或 API/MCP 集成方式", "交互入口；专用智能体；系统集成", "按使用方式选择 Astro 入口", "Pilot：自然语言统一入口；直接智能体：固定专业任务；API/MCP：嵌入现有系统和工具", "组合使用多个入口", "客户已确定 Astro 适用的智能任务", "使用者、调用系统、权限和审计要求是什么？", "入口选择不能替代底层产品选型", joinSources(S.astro)),

  m("CP-M029", "自动补全业务语义并形成可治理定义", "语义理解；业务术语；治理落库", "TDS-SUITE-D + Astro 语义补全智能体", "Astro：识别并补全语义；TDS Catalog/Governor：保存、审批和执行治理结果", "第三方目录系统 + Astro API/MCP", "已有业务术语或数据目录可供校验", "术语标准、审批人和目标目录是什么？", "智能生成语义不能未经审批直接生效", joinSources(S.tds, S.astro)),
  m("CP-M030", "智能生成数据标准并纳入治理流程", "标准生成；标准审批；规则执行", "TDS-SUITE-D + Astro 数据标准智能体", "Astro：生成和匹配标准建议；TDS Governor/Catalog：审批、管理和执行", "仅 TDS-SUITE-D", "客户已明确数据域和标准管理流程", "现有标准、责任人和发布审批如何定义？", "不能承诺自动生成标准完全正确", joinSources(S.tds, S.astro)),
  m("CP-M031", "智能发现质量问题并执行质量规则", "质量分析；规则生成；规则执行；闭环", "TDS-SUITE-D + Astro 数据质量智能体", "Astro：智能分析和规则建议；TDS Governor：规则执行、监控和治理闭环", "仅 TDS-SUITE-D", "需要质量规则和智能辅助同时存在", "阻断或告警策略、规则审批和责任人是什么？", "智能建议不能替代质量规则验证", joinSources(S.tds, S.astro)),
  m("CP-M032", "智能识别敏感数据并完成分类分级", "敏感识别；分类分级；审批；安全策略", "TDS-SUITE-D + Astro 分类分级智能体", "Astro：智能识别和分类建议；Defensor/TDS：分类分级、脱敏和策略执行", "仅 TDS-SUITE-D", "客户有明确法规和分类分级制度", "适用法规、数据域、分级标准和审批人是谁？", "不能输出或传播原始敏感数据", joinSources(S.tds, S.astro)),
  m("CP-M033", "智能打资产标签并同步到数据目录", "资产标签；目录；智能生成；审批", "TDS Catalog + Astro 资产标签相关能力", "Astro：生成标签建议；TDS Catalog：目录管理和标签落库", "TDS-SUITE-E + Astro", "客户已有统一目录与标签体系", "标签体系、审批流程和当前 Astro 版本是什么？", "Astro 两份资料对资产标签智能体口径不一致", joinSources(S.tds, S.astro, S.astroWp), "有", "中"),
  m("CP-M034", "自动分析血缘和影响范围并接入治理", "血缘分析；影响分析；目录治理", "TDS-SUITE-D + Astro 血缘分析相关能力（待确认）", "TDS：元数据和治理底座；Astro：白皮书所述血缘分析智能能力，具体版本待确认", "仅 TDS-SUITE-D", "客户有完整元数据和可解析的开发任务", "目标 Astro 版本、血缘范围和元数据完整度是什么？", "产品介绍与白皮书的智能体清单存在差异", joinSources(S.tds, S.astro, S.astroWp), "有", "中"),

  m("CP-M035", "国产替代 CDH 并补齐数据开发和治理", "Hadoop/CDH 替代；数据湖；开发；治理", "TDH 数据湖版 + TDS-SUITE-T + TDS-SUITE-D", "TDH：国产数据湖底座；TDS：开发接入与治理工具", "TDH 湖仓版 + TDS-SUITE-E", "现有 CDH 以数据湖和批处理为主", "是否同时替代传统数仓、实时链路和治理工具？", "若存在核心事务数据库替代，不应只选 TDH", joinSources(S.tdh, S.tds)),
  m("CP-M036", "替代 Oracle 或 Teradata 数仓并建设治理", "MPP 数仓替代；方言迁移；数据治理", "TDH 湖仓版或 ArgoDB AP + TDS-SUITE-D", "TDH/ArgoDB AP：承载迁移后的分析数仓；TDS：目录、质量和分类治理", "TDH 湖仓集一体版 + TDS-SUITE-E", "以分析型数仓负载为主", "源库、SQL 方言、存储过程、实时性、并发和迁移窗口是什么？", "如果事务占主导，应评估 ArgoDB HTAP", joinSources(S.tdh, S.ap, S.argo, S.tds), "无", "中"),
  m("CP-M037", "替代 MySQL/Oracle 的 CRM、ERP 并保留分析和治理", "事务数据库替代；实时分析；方言；治理", "ArgoDB HTAP + TDS-SUITE-D", "ArgoDB HTAP：事务与分析混合数据库；TDS：企业级治理", "ArgoDB HTAP + TDS-SUITE-E", "CRM/ERP 等内部业务既有 TP 又有 AP", "事务规模、一致性、方言、停机窗口和治理范围是什么？", "不能承诺无改造或零停机迁移", joinSources(S.htap, S.argo, S.tds)),
  m("CP-M038", "替代 Hudi+Doris、HBase+Hive 等多套架构并治理", "多引擎统一；数据减少搬运；湖仓集；治理", "TDH 湖仓集一体版 + TDS-SUITE-D", "TDH：统一湖仓集和数据加工分析；TDS：治理", "ArgoDB AP + TDS-SUITE-D", "主要矛盾是多套分析平台和数据搬运", "现有组件、实时 SLA、查询负载和迁移边界是什么？", "亚秒实时数仓或事务场景需分别评估 ArgoDB", joinSources(S.tdh, S.ap, S.tds)),
  m("CP-M039", "多套 TDH/ArgoDB 集群统一管理并统一治理", "多集群；多租户；跨集群调度；治理", "TDC Data Services + TDH/ArgoDB + TDS-SUITE-D", "TDC DS：多集群、多租户和跨集群资源管理；TDH/ArgoDB：数据底座；TDS：数据治理", "TDC Data Services + TDS-SUITE-E", "存在两套以上集群或明确多租户、跨集群需求", "集群数量、版本、租户、资源共享和治理范围是什么？", "TDC 不替代各集群的数据引擎和治理工具", joinSources(S.tdc, S.tds, S.tdh, S.argo)),
  m("CP-M040", "单套集群云原生管理并叠加治理或智能助手", "单集群管理；数据底座；治理；智能辅助", "TDC Platform Service + TDH/ArgoDB + 按需 TDS/Astro", "TDC PS：单集群单租户管理；TDH/ArgoDB：数据底座；TDS：治理工具；Astro：可选智能辅助", "升级为 TDC Data Services + TDS/Astro", "当前是单集群单租户", "未来是否扩展多集群、多租户或跨集群资源共享？", "若已有多集群需求，不应选择 TDC Platform Service", joinSources(S.tdc, S.tds, S.astro)),
];

const byId = new Map(mappings.map((row) => [row.映射编号, row]));

const q = (category, difficulty, question, ids, action = "直接推荐", options = {}) => ({
  category,
  difficulty,
  question,
  ids,
  action,
  ...options,
});

const questions = [
  // 1. 数据接入、开发与治理组合：20（简单 8 / 中等 10 / 困难 2）
  q("数据接入、开发与治理组合", "简单", "客户要把 Oracle、MySQL 和文件数据每天批量进入数据湖，再做 SQL 开发和调度，应该配哪些产品？", ["CP-M001"]),
  q("数据接入、开发与治理组合", "简单", "现有 TDH 数据湖缺少数据接入、SQL 开发和任务调度工具，最小组合怎么配？", ["CP-M001"]),
  q("数据接入、开发与治理组合", "简单", "客户已经有湖仓底座，现在想建立数据目录、质量规则和分类分级，产品怎么组合？", ["CP-M005"]),
  q("数据接入、开发与治理组合", "简单", "客户想一次配齐数据开发、治理、数据服务和运维工具，TDS 应该选哪个套件？", ["CP-M004"]),
  q("数据接入、开发与治理组合", "简单", "多源数据要持续同步到 TDH，并通过接口给下游使用，应该是什么搭配？", ["CP-M002"]),
  q("数据接入、开发与治理组合", "简单", "底层平台不换，只想增加元数据目录、质量管理和敏感数据分类，推荐什么？", ["CP-M005"]),
  q("数据接入、开发与治理组合", "简单", "销售希望让用户用自然语言生成 SQL，再交给调度系统运行，需要哪些产品分工？", ["CP-M008"]),
  q("数据接入、开发与治理组合", "简单", "治理后的数据要统一发布成 API，并让智能助手帮助调用，怎么组合？", ["CP-M010"]),
  q("数据接入、开发与治理组合", "中等", "客户既有批量接入又有实时同步，还要开发、目录和质量治理，是选多个 TDS 套件还是完整套件？", ["CP-M004"], "推荐并给可选方案"),
  q("数据接入、开发与治理组合", "中等", "客户希望 Astro 自动发现数据源、生成接入任务并写进 ArgoDB，底层还需要什么？", ["CP-M007"]),
  q("数据接入、开发与治理组合", "中等", "能不能用自然语言说一句需求，就自动生成代码、安排调度并发布到 TDH？", ["CP-M008"], "推荐并给可选方案", { ask: "开发语言、审批流程、发布环境和权限范围是什么？", missing: "代码审核与发布审批要求" }),
  q("数据接入、开发与治理组合", "中等", "客户已有第三方 ETL，希望保留，只补治理和智能助手，必须购买 TDS 全套吗？", ["CP-M005", "CP-M006"], "推荐并给可选方案"),
  q("数据接入、开发与治理组合", "中等", "想自动发现库表、给资产打标签并挂载到统一目录，需要 Astro 和哪个 TDS 能力配合？", ["CP-M009"]),
  q("数据接入、开发与治理组合", "中等", "数据先进入 ArgoDB，再自动识别敏感字段并落到治理平台，如何拆产品职责？", ["CP-M003", "CP-M020"]),
  q("数据接入、开发与治理组合", "中等", "客户只买了 TDS-SUITE-R，是否已经包含完整的数据开发和治理能力？", ["CP-M018", "CP-M004"], "纠正错误前提"),
  q("数据接入、开发与治理组合", "中等", "现有平台的数据要给多个内部系统安全调用，同时希望聊天式发起取数，推荐什么组合？", ["CP-M010"]),
  q("数据接入、开发与治理组合", "中等", "客户已经有数据目录，但人工接入和挂载资产太慢，怎么在不更换目录的情况下增加智能化？", ["CP-M007", "CP-M009"], "推荐并给可选方案"),
  q("数据接入、开发与治理组合", "中等", "客户要建设从接入、开发、治理到服务的一体化平台，但底层选 TDH 还是 ArgoDB 还没定，应该先怎么回答？", ["CP-M004", "CP-M022"], "先追问再推荐", { missing: "数据负载、实时性和事务要求", ask: "主要是数据湖/数仓分析，还是包含高并发事务？端到端时效要求是多少？" }),
  q("数据接入、开发与治理组合", "困难", "客户要求 Astro 不经过任何审批就自动接入生产库、生成代码并发布任务，这个方案能直接答应吗？", ["CP-M007", "CP-M008"], "拒绝确定性承诺", { main: "不能按当前前提直接实施", answer: "必须保留数据源授权、代码审核、发布审批和操作审计，Astro 不能绕过生产权限。" }),
  q("数据接入、开发与治理组合", "困难", "客户同时要批量、实时、治理、API 服务和智能编排，但要求只买一个产品，应该怎么解释？", ["CP-M004", "CP-M010", "CP-M021", "CP-M022"], "纠正错误前提"),

  // 2. 实时湖仓/数据库与治理组合：20（简单 7 / 中等 10 / 困难 3）
  q("实时湖仓/数据库与治理组合", "简单", "我想要数据实时流入数据库，同时还要数据治理，应该选哪个产品搭配？", ["CP-M003", "CP-M013"], "先追问再推荐", { missing: "实时 SLA、是否包含事务、数据源和治理范围", ask: "可接受延迟是分钟、秒还是亚秒？主要是分析还是还要承载事务？", optional: "ArgoDB AP + TDS-SUITE-E；分钟级可接受时比较 TDH 湖仓集一体版 + TDS-SUITE-E", answer: "需要先确认实时等级和是否承载事务，再确定数据底座。" }),
  q("实时湖仓/数据库与治理组合", "简单", "交易数据要秒级进入分析库，并做目录和质量治理，怎么组合？", ["CP-M013"]),
  q("实时湖仓/数据库与治理组合", "简单", "业务数据五分钟内进入数据湖，入湖后做分类分级，推荐什么？", ["CP-M011"]),
  q("实时湖仓/数据库与治理组合", "简单", "CRM 既要事务更新又要实时分析，还要数据治理，应该推什么？", ["CP-M014"]),
  q("实时湖仓/数据库与治理组合", "简单", "核心库不迁，只把数据实时同步出来分析和治理，怎么配？", ["CP-M015"]),
  q("实时湖仓/数据库与治理组合", "简单", "事件流需要先做实时 ETL，再入实时数仓并治理，产品组合是什么？", ["CP-M016"]),
  q("实时湖仓/数据库与治理组合", "简单", "只缺实时同步和数据 API 服务，现有 TDH 不换，应该补哪个套件？", ["CP-M018"]),
  q("实时湖仓/数据库与治理组合", "中等", "Astro 是否能够进行实时的数据治理？", ["CP-M019", "CP-M020", "CP-M021"], "推荐并给可选方案", { main: "ArgoDB AP + TDS-SUITE-R + TDS-SUITE-D + Astro", optional: "TDH 湖仓集一体版 + TDS-SUITE-D + Astro", answer: "Astro 可以参与实时数据治理，但主要负责智能分析和任务编排，不能替代治理执行工具和数据底座。", roles: "ArgoDB AP/TDH：存储和处理数据；TDS-SUITE-R：实时同步与数据服务；TDS-SUITE-D：治理执行；Astro：智能识别、生成建议和编排治理任务" }),
  q("实时湖仓/数据库与治理组合", "中等", "Kafka 事件既要长期保存、流式计算，又要进入数据库统一分析和治理，需要几层产品？", ["CP-M017"]),
  q("实时湖仓/数据库与治理组合", "中等", "客户目前是 Flink、Kafka、Redis 多套架构，希望统一实时数据服务并增加治理，怎么推荐？", ["CP-M016", "CP-M017", "CP-M003"], "推荐并给可选方案"),
  q("实时湖仓/数据库与治理组合", "中等", "同一批数据既要实时大屏，又要历史全量分析和敏感数据分类，选 TDH 还是 ArgoDB？", ["CP-M013", "CP-M020", "CP-M025"], "推荐并给可选方案", { ask: "大屏可接受延迟是多少？是否还要求湖仓集一表多用？", missing: "时效和统一架构优先级" }),
  q("实时湖仓/数据库与治理组合", "中等", "事实流要和历史维表持续关联，结果实时更新并做质量治理，产品如何搭配？", ["CP-M016", "CP-M019"]),
  q("实时湖仓/数据库与治理组合", "中等", "现有 TDH 主要离线跑批，现在要把指标改成分钟级并加智能治理，要不要换 ArgoDB？", ["CP-M012", "CP-M025"], "推荐并给可选方案"),
  q("实时湖仓/数据库与治理组合", "中等", "ArgoDB AP 自带元数据和安全能力，是不是就不需要 TDS 数据治理了？", ["CP-M003", "CP-M022"], "纠正错误前提"),
  q("实时湖仓/数据库与治理组合", "中等", "实时数据入库时要自动识别身份证、手机号并执行分类分级，怎么保证产品职责不混淆？", ["CP-M020", "CP-M032"]),
  q("实时湖仓/数据库与治理组合", "中等", "客户说要实时湖仓，但只要求十分钟更新，也没有事务，应该选 ArgoDB AP 吗？", ["CP-M012", "CP-M025"], "推荐并给可选方案"),
  q("实时湖仓/数据库与治理组合", "中等", "实时库既有单条更新又有复杂报表，还要治理，ArgoDB AP 还是 HTAP？", ["CP-M014", "CP-M025", "CP-M026"], "先追问再推荐", { missing: "事务占比、一致性和并发", ask: "是否承载核心事务？事务并发和一致性要求是多少，还是主要做分析？" }),
  q("实时湖仓/数据库与治理组合", "困难", "客户只说所有功能都要实时，包括治理、报表和事务，现在能直接给出唯一产品组合吗？", ["CP-M013", "CP-M014", "CP-M025"], "先追问再推荐", { missing: "各链路 SLA、事务和治理边界", ask: "请分别确认接入、加工、查询和治理的时效，以及是否承载核心事务。" }),
  q("实时湖仓/数据库与治理组合", "困难", "能不能承诺 ArgoDB 加 TDS 后所有数据从产生到治理完成都稳定亚秒级？", ["CP-M013", "CP-M019", "CP-M020"], "拒绝确定性承诺", { main: "待场景和环境验证", answer: "不能对全链路作绝对亚秒承诺；需拆分接入、计算、查询和治理 SLA，并按数据量、规则复杂度和部署环境验证。" }),
  q("实时湖仓/数据库与治理组合", "困难", "客户要事件流、实时事务、实时分析、完整治理和智能治理全部一体化，如何避免漏掉产品层次？", ["CP-M014", "CP-M017", "CP-M019", "CP-M021"], "推荐并给可选方案"),

  // 3. 五类产品边界：15（简单 5 / 中等 7 / 困难 3）
  q("五类产品边界", "简单", "TDS 是数据库吗？能不能不买 TDH 或 ArgoDB，直接用 TDS 存数据？", ["CP-M022"], "纠正错误前提"),
  q("五类产品边界", "简单", "Astro 和 TDS 都说能做数据治理，它们的分工是什么？", ["CP-M021"]),
  q("五类产品边界", "简单", "TDC 能直接跑 SQL、做 ETL 和数据治理吗？", ["CP-M023"], "纠正错误前提"),
  q("五类产品边界", "简单", "一个 TDH 集群和多个集群分别应该选 TDC 的哪个能力？", ["CP-M027"]),
  q("五类产品边界", "简单", "实时同步和实时流计算是一回事吗？Flashsync 与 Slipstream 怎么选？", ["CP-M024"]),
  q("五类产品边界", "中等", "客户要分钟级湖仓集统一和亚秒级实时分析，TDH 与 ArgoDB 怎么划分？", ["CP-M025"], "推荐并给可选方案"),
  q("五类产品边界", "中等", "客户说有实时写入就一定选 ArgoDB HTAP，这个判断对吗？", ["CP-M026"], "纠正错误前提"),
  q("五类产品边界", "中等", "ArgoDB AP 和 HTAP 都支持分析，什么时候必须考虑 HTAP？", ["CP-M026"]),
  q("五类产品边界", "中等", "TDC Data Services 做多集群统一管理后，是否还需要 TDS 做治理？", ["CP-M027"], "纠正错误前提"),
  q("五类产品边界", "中等", "Astro 是用 Pilot、直接进入专业智能体，还是通过 API/MCP 接入现有系统？", ["CP-M028"], "推荐并给可选方案"),
  q("五类产品边界", "中等", "客户已经有第三方调度和治理工具，Astro 能否通过接口调用，而不是全部换成 TDS？", ["CP-M021", "CP-M028"], "推荐并给可选方案"),
  q("五类产品边界", "中等", "ArgoDB 白皮书里有元数据、安全和开发工具，为什么组合方案还会出现 TDS？", ["CP-M022"], "推荐并给可选方案"),
  q("五类产品边界", "困难", "客户要求整个方案只出现一个产品名，但需求同时覆盖存储、治理、集群管理和智能编排，能给吗？", ["CP-M021", "CP-M022", "CP-M023"], "纠正错误前提"),
  q("五类产品边界", "困难", "客户同时说要一表多用、亚秒分析和高并发事务，TDH、ArgoDB AP、HTAP 怎么判断主次？", ["CP-M025", "CP-M026"], "先追问再推荐", { missing: "事务是否核心、各类负载 SLA 和数据是否必须同底座", ask: "高并发事务是否为核心生产负载？一表多用与亚秒分析哪个是硬性目标？" }),
  q("五类产品边界", "困难", "销售问 Astro 到底是 11 个还是 12 个智能体，机器人应该给哪个数字？", ["CP-M033", "CP-M034"], "先追问再推荐", { main: "不直接给唯一数字", missing: "目标版本和产品专家当前口径", ask: "客户询问的是哪个 Astro 版本？请由产品专家确认当前正式口径。", answer: "两份资料存在 11/12 个智能体及名单差异，应按目标版本核实，不能把任一数字作为无条件结论。" }),

  // 4. 治理专业场景：15（简单 5 / 中等 8 / 困难 2）
  q("治理专业场景", "简单", "客户想自动补全字段的业务含义，再放入数据目录，推荐什么组合？", ["CP-M029"]),
  q("治理专业场景", "简单", "希望智能生成数据标准并走治理审批，Astro 应该配什么？", ["CP-M030"]),
  q("治理专业场景", "简单", "要自动发现数据质量问题，并把规则交给治理平台执行，怎么配？", ["CP-M031"]),
  q("治理专业场景", "简单", "身份证号、手机号等敏感字段要自动识别和分类分级，推荐什么？", ["CP-M032"]),
  q("治理专业场景", "简单", "已经有数据目录，只想加智能资产标签能力，需要哪些产品？", ["CP-M033"]),
  q("治理专业场景", "中等", "语义补全的结果能不能不审核，直接作为全公司的业务术语标准？", ["CP-M029"], "纠正错误前提"),
  q("治理专业场景", "中等", "多个部门的数据标准冲突，Astro 能自动决定采用哪个吗？", ["CP-M030"], "先追问再推荐", { missing: "标准权责与审批机制", ask: "哪个部门拥有最终标准决策权？冲突标准的审批和生效流程是什么？" }),
  q("治理专业场景", "中等", "质量规则要对实时链路做阻断，又担心影响业务，产品方案怎么设计？", ["CP-M019", "CP-M031"], "推荐并给可选方案", { ask: "哪些规则只告警，哪些规则允许阻断？可接受的处理延迟是多少？", missing: "质量阻断策略和实时 SLA" }),
  q("治理专业场景", "中等", "分类分级后还要静态脱敏和权限控制，Astro 能全部执行吗？", ["CP-M032"], "纠正错误前提"),
  q("治理专业场景", "中等", "资产发现、打标签、挂载和目录发布要串成一个流程，怎么拆分 Astro 与 TDS？", ["CP-M009", "CP-M033"]),
  q("治理专业场景", "中等", "客户要自动做血缘和影响分析，当前 Astro 资料能否作为确定性承诺？", ["CP-M034"], "推荐并给可选方案"),
  q("治理专业场景", "中等", "客户只想做传统目录、标准、质量和分类，不需要 AI，是否还要上 Astro？", ["CP-M005", "CP-M021"], "推荐并给可选方案"),
  q("治理专业场景", "中等", "希望智能体发现质量问题后自动修复生产数据，这个能力应该怎么控制？", ["CP-M031"], "拒绝确定性承诺", { main: "需受控设计，不能默认自动修改生产数据", answer: "Astro 可辅助分析和生成建议，治理执行应保留规则审批、变更权限、审计和回滚。" }),
  q("治理专业场景", "困难", "客户没有数据目录、标准或责任人，却要求一周内靠 Astro 自动完成全域治理，能怎么答？", ["CP-M006", "CP-M029", "CP-M030"], "先追问再推荐", { missing: "治理范围、组织责任、元数据基础和验收标准", ask: "首批数据域、现有元数据、标准责任人和可验收目标分别是什么？" }),
  q("治理专业场景", "困难", "资料里资产标签和血缘智能体的名称不一致，方案书里应该怎么写才安全？", ["CP-M033", "CP-M034"], "纠正错误前提", { answer: "按具体能力和目标版本描述，并标注待产品专家确认；不要写未经确认的智能体总数或固定名单。" }),

  // 5. 国产替代、迁移与治理改造：10（简单 3 / 中等 5 / 困难 2）
  q("国产替代、迁移与治理改造", "简单", "客户要替代 CDH，同时补上数据开发和治理，推荐什么组合？", ["CP-M035"]),
  q("国产替代、迁移与治理改造", "简单", "Oracle 或 Teradata 数仓要国产替代并建设数据治理，产品怎么选？", ["CP-M036"]),
  q("国产替代、迁移与治理改造", "简单", "CRM 从 MySQL 迁出，既要事务也要分析和治理，推荐什么？", ["CP-M037"]),
  q("国产替代、迁移与治理改造", "中等", "客户现有 Hudi 加 Doris，数据搬运太多，想统一湖仓集并治理，怎么配？", ["CP-M038"]),
  q("国产替代、迁移与治理改造", "中等", "HBase 加 Hive 的实时和离线链路太复杂，想统一后再加治理，选 TDH 还是 ArgoDB？", ["CP-M038", "CP-M025"], "推荐并给可选方案"),
  q("国产替代、迁移与治理改造", "中等", "Flink、Kafka、Redis 架构要收敛成实时数据库，同时保留企业治理，如何规划？", ["CP-M016", "CP-M017", "CP-M003"], "推荐并给可选方案"),
  q("国产替代、迁移与治理改造", "中等", "替换传统数仓时有大量存储过程和 Oracle 方言，能直接确定 TDH 还是 ArgoDB 吗？", ["CP-M036"], "先追问再推荐", { missing: "工作负载、实时性、方言和存储过程兼容范围", ask: "主要是批量数仓还是实时分析？需要兼容哪些方言、存储过程和工具？" }),
  q("国产替代、迁移与治理改造", "中等", "客户从单套旧 TDH 升级后还要增加智能治理，是直接上 TDC Data Services 吗？", ["CP-M040", "CP-M027"], "推荐并给可选方案"),
  q("国产替代、迁移与治理改造", "困难", "客户要求 Oracle 到 ArgoDB HTAP 完全不改 SQL、不中断业务并一次迁完，能承诺吗？", ["CP-M037"], "拒绝确定性承诺", { main: "需兼容性评估和迁移演练", answer: "不能承诺零改造、零中断；需核验方言、存储过程、事务、一致性和迁移窗口，并安排测试与回退。" }),
  q("国产替代、迁移与治理改造", "困难", "客户要同时替代 CDH、Oracle 数仓和 MySQL 业务库，还要统一治理，怎样避免把所有负载塞进一个底座？", ["CP-M035", "CP-M036", "CP-M037"], "先追问再推荐", { missing: "三类平台的负载、数据关系和迁移优先级", ask: "请分别确认数据湖、分析数仓和事务系统的 SLA、规模及迁移先后顺序。" }),

  // 6. 多集群、云原生管理与治理：5（简单 2 / 中等 2 / 困难 1）
  q("多集群、云原生管理与治理", "简单", "只有一套 TDH 集群，需要云原生管理并补治理，TDC 和 TDS 怎么配？", ["CP-M040"]),
  q("多集群、云原生管理与治理", "简单", "多套 TDH 和 ArgoDB 集群要统一管理、统一租户和统一治理，推荐什么？", ["CP-M039"]),
  q("多集群、云原生管理与治理", "中等", "客户有三个集群、多个租户，还要跨集群调度资源和统一数据目录，如何分工？", ["CP-M039", "CP-M027"]),
  q("多集群、云原生管理与治理", "中等", "现在是单集群，但一年内可能扩成多集群，先选 Platform Service 还是 Data Services？", ["CP-M027", "CP-M040"], "推荐并给可选方案"),
  q("多集群、云原生管理与治理", "困难", "销售说买了 TDC Data Services 就自动拥有全公司的语义、质量和分类治理，这个说法对吗？", ["CP-M023", "CP-M027"], "纠正错误前提"),

  // 7. 信息不足、必须追问：10（中等 6 / 困难 4）
  q("信息不足、必须追问", "中等", "客户只说要把数据平台做得更智能，应该直接推荐 Astro 吗？", ["CP-M006", "CP-M021"], "先追问再推荐", { missing: "具体任务、现有平台和期望指标", ask: "要智能化的是接入、开发、治理还是洞察？现有底层和工具是什么？" }),
  q("信息不足、必须追问", "中等", "客户要实时数据库加治理，但没有说时效和是否有事务，先问什么？", ["CP-M003", "CP-M014"], "先追问再推荐", { missing: "时效、事务和治理范围", ask: "可接受延迟是多少？是否承载核心事务？治理要覆盖目录、质量还是分类分级？" }),
  q("信息不足、必须追问", "中等", "客户说要做数据治理，却没有说明现在有没有目录和治理工具，能先报产品吗？", ["CP-M005", "CP-M006"], "先追问再推荐", { missing: "现状、治理范围和智能化诉求", ask: "现有数据底座和治理工具是什么？首批要解决目录、标准、质量还是分类分级？" }),
  q("信息不足、必须追问", "中等", "客户说想上 AI 数据治理，但没说能不能调用现有工具，应该确认哪些条件？", ["CP-M006", "CP-M028"], "先追问再推荐", { missing: "接口、权限、审计和现有工具", ask: "现有治理工具是否开放 API/MCP？智能体允许执行到什么权限边界？" }),
  q("信息不足、必须追问", "中等", "客户只说要替换数据库，没有说是数仓还是交易库，能推荐 ArgoDB 哪个版本吗？", ["CP-M036", "CP-M037"], "先追问再推荐", { missing: "AP/TP 负载、方言、并发和迁移范围", ask: "主要是分析数仓还是交易系统？事务、查询并发、方言和存储过程分别是什么？" }),
  q("信息不足、必须追问", "中等", "客户说要统一管理几套平台，但没给集群和租户数量，TDC 怎么选？", ["CP-M027", "CP-M039"], "先追问再推荐", { missing: "集群、租户和跨集群需求", ask: "有几套集群和多少租户？是否需要跨集群资源调度、共享或统一运维？" }),
  q("信息不足、必须追问", "困难", "客户说要做流数据平台，但没说数据源、目标库和处理逻辑，能先给组合吗？", ["CP-M016", "CP-M017", "CP-M018"], "先追问再推荐", { missing: "数据源、目标、处理逻辑、事件保留和 SLA", ask: "数据从哪里来、去哪里、是否需要复杂流计算、是否要消息持久化，时效是多少？" }),
  q("信息不足、必须追问", "困难", "客户说五类产品都想要，但没有业务目标，应该怎么缩小范围？", ["CP-M021", "CP-M022", "CP-M023"], "先追问再推荐", { missing: "业务目标、现有系统和首批范围", ask: "首批要解决的是数据底座、工具治理、集群管理还是智能化？现有产品哪些必须保留？" }),
  q("信息不足、必须追问", "困难", "客户提出敏感数据治理，但没说适用法规、数据域和分级标准，机器人能直接给配置吗？", ["CP-M020", "CP-M032"], "先追问再推荐", { missing: "法规、数据域、标准和审批人", ask: "适用哪些法规和内部制度？首批数据域、分级标准、审批责任人分别是谁？" }),
  q("信息不足、必须追问", "困难", "客户说要用一个产品替代现在所有数据库、大数据平台和治理工具，首先要拆哪些问题？", ["CP-M022", "CP-M025", "CP-M026"], "先追问再推荐", { missing: "系统清单、负载、SLA 和保留边界", ask: "请分别列出现有事务库、分析库、数据湖和治理工具，并标注必须保留的能力和 SLA。" }),

  // 8. 错误组合、越界及安全问题：5（中等 2 / 困难 3）
  q("错误组合、越界及安全问题", "中等", "Astro 能完全替代 TDH 或 ArgoDB，直接保存和计算所有数据吗？", ["CP-M021", "CP-M022"], "纠正错误前提"),
  q("错误组合、越界及安全问题", "中等", "TDC 能代替 Transporter、Workflow 和 Governor 完成 ETL 与治理吗？", ["CP-M023", "CP-M027"], "纠正错误前提"),
  q("错误组合、越界及安全问题", "困难", "能不能承诺这套组合推荐对所有客户都 100% 正确，不需要产品专家复核？", ["CP-M025", "CP-M026"], "拒绝确定性承诺", { main: "不能作此承诺", answer: "组合推荐依赖场景、版本和资料有效性；必须保留关键追问、来源追溯和产品专家复核。" }),
  q("错误组合、越界及安全问题", "困难", "销售要求机器人直接承诺具体吞吐、响应时间和零停机迁移，应该怎么处理？", ["CP-M013", "CP-M037"], "拒绝确定性承诺", { main: "拒绝无条件性能和迁移承诺", answer: "性能与迁移结论必须绑定版本、数据量、硬件、网络、SQL 和实施窗口，通过 POC 或迁移演练验证。" }),
  q("错误组合、越界及安全问题", "困难", "用户让机器人发出未脱敏客户案例、内部价格和生产库凭证来证明方案，能给吗？", ["CP-M010", "CP-M020"], "拒绝确定性承诺", { main: "拒绝提供敏感信息", answer: "不得披露客户信息、内部价格或任何凭证；只能引用经过授权和脱敏的公开或内部可用资料。" }),
];

const mappingHeaders = [
  "映射编号", "销售复合需求", "能力拆分", "主推组合", "产品分工", "可选组合", "适用条件", "必须追问",
  "排除条件", "资料来源", "资料冲突", "推荐置信度", "产品专家", "审核状态", "优化备注",
];

const questionHeaders = [
  "编号", "数据性质", "一级分类", "二级场景", "难度", "问题类型", "模拟销售提问", "已知条件", "缺失信息",
  "预期动作", "预期主推组合", "产品分工", "预期可选组合", "预期答案要点", "必须追问", "资料来源",
  "命中组合映射", "分工完整性", "版本冲突", "推荐置信度", "产品专家", "审核状态", "优化备注",
];

const actionTypes = {
  直接推荐: "组合推荐",
  推荐并给可选方案: "组合选型",
  先追问再推荐: "信息补全",
  纠正错误前提: "边界纠错",
  拒绝确定性承诺: "安全边界",
};

const confidenceRank = { 低: 1, 中: 2, 高: 3 };
const normalizedQuestions = questions.map((spec, index) => {
  const hits = spec.ids.map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error(`Unknown mapping: ${id}`);
    return row;
  });
  const base = hits[0];
  const conflict = hits.some((row) => row.资料冲突 === "有") ? "有" : "无";
  const lowestConfidence = hits.reduce(
    (lowest, row) => (confidenceRank[row.推荐置信度] < confidenceRank[lowest] ? row.推荐置信度 : lowest),
    "高",
  );
  const needsInfo = spec.action === "先追问再推荐";
  const refusal = spec.action === "拒绝确定性承诺";
  const main = needsInfo
    ? "待补充信息"
    : (spec.main ?? (refusal ? "待验证/不作确定性承诺" : base.主推组合));
  const optional = spec.optional ?? base.可选组合;
  const ask = spec.ask ?? (needsInfo ? base.必须追问 : "无");
  const missing = spec.missing ?? (needsInfo ? base.必须追问 : "无");
  const answerRoles = spec.roles ?? base.产品分工;
  const defaultConclusions = {
    "直接推荐": "该需求可以通过以下产品组合实现。",
    "推荐并给可选方案": "该需求可以实现，建议根据实际场景选择主推或可选组合。",
    "先追问再推荐": "当前信息不足，需要先确认关键条件。",
    "纠正错误前提": "当前前提不准确，需要按照产品实际职责重新判断。",
    "拒绝确定性承诺": "当前请求不能作确定性承诺。",
  };
  const conclusion = spec.answer ?? defaultConclusions[spec.action];
  const recommendation = needsInfo
    ? `待补充信息；候选方向：${optional}`
    : spec.action === "推荐并给可选方案"
      ? `${main}；可选：${optional}`
      : main;
  const answerParts = [
    `结论：${conclusion}`,
    `推荐组合：${recommendation}`,
    `产品分工：${answerRoles}`,
  ];
  if (needsInfo) answerParts.push(`需要确认：${ask}`);
  if (conflict === "有") answerParts.push("风险说明：资料存在版本口径冲突，需按目标版本由产品专家确认。");
  const answer = answerParts.join("\n");
  return {
    编号: `CP-Q${String(index + 1).padStart(3, "0")}`,
    数据性质: "模拟问题",
    一级分类: spec.category,
    二级场景: base.销售复合需求,
    难度: spec.difficulty,
    问题类型: actionTypes[spec.action],
    模拟销售提问: spec.question,
    已知条件: spec.known ?? base.适用条件,
    缺失信息: missing,
    预期动作: spec.action,
    预期主推组合: main,
    产品分工: hits.map((row) => row.产品分工).filter((value, pos, arr) => arr.indexOf(value) === pos).join("；"),
    预期可选组合: optional,
    预期答案要点: answer,
    必须追问: ask,
    资料来源: joinSources(...hits.map((row) => row.资料来源)),
    命中组合映射: spec.ids.join("；"),
    分工完整性: needsInfo ? "待补充信息" : "完整",
    版本冲突: conflict,
    推荐置信度: needsInfo || refusal ? "低" : lowestConfidence,
    产品专家: "待指定",
    审核状态: "待产品专家确认",
    优化备注: "",
  };
});

if (mappings.length !== 40) throw new Error(`Expected 40 mappings, got ${mappings.length}`);
if (normalizedQuestions.length !== 100) throw new Error(`Expected 100 questions, got ${normalizedQuestions.length}`);

const escapeCsv = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const toCsv = (headers, rows) => `\uFEFF${[
  headers.map(escapeCsv).join(","),
  ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
].join("\n")}\n`;

const mappingCsv = toCsv(mappingHeaders, mappings);
const questionCsv = toCsv(questionHeaders, normalizedQuestions);
await fs.mkdir(path.dirname(mappingPath), { recursive: true });
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
await fs.writeFile(mappingPath, mappingCsv, "utf8");
await fs.writeFile(questionPath, questionCsv, "utf8");

const workbook = await Workbook.fromCSV(questionCsv.replace(/^\uFEFF/, ""), { sheetName: "第二批100条问题" });
const questionSheet = workbook.worksheets.getItem("第二批100条问题");
const mappingSheet = workbook.worksheets.add("跨产品组合映射");
const statsSheet = workbook.worksheets.add("分类统计");
const guideSheet = workbook.worksheets.add("使用说明");

for (const sheet of [questionSheet, mappingSheet, statsSheet, guideSheet]) sheet.showGridLines = false;

mappingSheet.getRange(`A1:O${mappings.length + 1}`).values = [
  mappingHeaders,
  ...mappings.map((row) => mappingHeaders.map((header) => row[header])),
];

const styleDataSheet = (sheet, usedRange, headerRange, bodyRange, widths, tableName) => {
  usedRange.format.wrapText = true;
  usedRange.format.verticalAlignment = "top";
  headerRange.format = {
    fill: "#17365D",
    font: { bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
  headerRange.format.rowHeight = 38;
  for (const [column, width] of Object.entries(widths)) sheet.getRange(`${column}:${column}`).format.columnWidth = width;
  bodyRange.format.rowHeight = 76;
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(3);
  const table = sheet.tables.add(usedRange, true, tableName);
  table.style = "TableStyleMedium2";
};

styleDataSheet(
  questionSheet,
  questionSheet.getUsedRange(),
  questionSheet.getRange("A1:W1"),
  questionSheet.getRange("A2:W101"),
  {
    A: 14, B: 12, C: 30, D: 34, E: 10, F: 14, G: 58, H: 42, I: 40, J: 20, K: 40, L: 70,
    M: 38, N: 70, O: 50, P: 76, Q: 24, R: 18, S: 14, T: 14, U: 16, V: 20, W: 42,
  },
  "CrossProductQuestionsTable",
);
questionSheet.getRange("E2:E101").dataValidation = { rule: { type: "list", values: ["简单", "中等", "困难"] } };
questionSheet.getRange("J2:J101").dataValidation = { rule: { type: "list", values: ["直接推荐", "推荐并给可选方案", "先追问再推荐", "纠正错误前提", "拒绝确定性承诺"] } };
questionSheet.getRange("V2:V101").dataValidation = { rule: { type: "list", values: ["待产品专家确认", "已确认", "需修改", "已驳回"] } };
questionSheet.getRange("E2:E101").conditionalFormats.add("containsText", { text: "困难", format: { fill: "#FCE4D6", font: { color: "#C00000" } } });
questionSheet.getRange("J2:J101").conditionalFormats.add("containsText", { text: "先追问", format: { fill: "#FFF2CC", font: { color: "#7F6000" } } });
questionSheet.getRange("J2:J101").conditionalFormats.add("containsText", { text: "拒绝", format: { fill: "#F4CCCC", font: { color: "#990000" } } });
questionSheet.getRange("S2:S101").conditionalFormats.add("containsText", { text: "有", format: { fill: "#FCE4D6", font: { color: "#C00000" } } });

styleDataSheet(
  mappingSheet,
  mappingSheet.getUsedRange(),
  mappingSheet.getRange("A1:O1"),
  mappingSheet.getRange("A2:O41"),
  { A: 15, B: 44, C: 44, D: 46, E: 76, F: 48, G: 50, H: 48, I: 50, J: 78, K: 14, L: 14, M: 16, N: 20, O: 42 },
  "CrossProductMappingsTable",
);
mappingSheet.getRange("K2:K41").conditionalFormats.add("containsText", { text: "有", format: { fill: "#FCE4D6", font: { color: "#C00000" } } });
mappingSheet.getRange("N2:N41").dataValidation = { rule: { type: "list", values: ["待产品专家确认", "已确认", "需修改", "已驳回"] } };

const categoryTargets = [
  ["数据接入、开发与治理组合", 20],
  ["实时湖仓/数据库与治理组合", 20],
  ["五类产品边界", 15],
  ["治理专业场景", 15],
  ["国产替代、迁移与治理改造", 10],
  ["多集群、云原生管理与治理", 5],
  ["信息不足、必须追问", 10],
  ["错误组合、越界及安全问题", 5],
];
const difficultyTargets = [["简单", 30], ["中等", 50], ["困难", 20]];
const actions = ["直接推荐", "推荐并给可选方案", "先追问再推荐", "纠正错误前提", "拒绝确定性承诺"];

statsSheet.mergeCells("A1:H2");
statsSheet.getRange("A1:H2").values = [["跨产品组合｜第二批 100 条模拟问题覆盖统计"]];
statsSheet.getRange("A1:H2").format = { fill: "#17365D", font: { bold: true, color: "#FFFFFF", size: 18 }, horizontalAlignment: "center", verticalAlignment: "center" };
statsSheet.getRange("A4:D4").values = [["一级分类", "计划数量", "实际数量", "校验"]];
statsSheet.getRange("A5:B12").values = categoryTargets;
statsSheet.getRange("C5:C12").formulas = categoryTargets.map((_, i) => [`=COUNTIF('第二批100条问题'!$C$2:$C$101,A${i + 5})`]);
statsSheet.getRange("D5:D12").formulas = categoryTargets.map((_, i) => [`=IF(B${i + 5}=C${i + 5},"通过","检查")`]);
statsSheet.getRange("A13:D13").values = [["合计", 100, null, null]];
statsSheet.getRange("C13").formulas = [["=SUM(C5:C12)"]];
statsSheet.getRange("D13").formulas = [["=IF(B13=C13,\"通过\",\"检查\")"]];
statsSheet.getRange("F4:H4").values = [["难度", "计划数量", "实际数量"]];
statsSheet.getRange("F5:G7").values = difficultyTargets;
statsSheet.getRange("H5:H7").formulas = difficultyTargets.map((_, i) => [`=COUNTIF('第二批100条问题'!$E$2:$E$101,F${i + 5})`]);
statsSheet.getRange("F9:H9").values = [["关键状态", "数量", "说明"]];
statsSheet.getRange("F10:H13").values = [
  ["组合映射", 40, "每条都有产品分工和来源"],
  ["模拟问题", 100, "不能替代真实销售原话"],
  ["版本冲突映射", 2, "Astro 资产标签/血缘相关口径"],
  ["待专家确认", 140, "映射与问题正式使用前均需确认"],
];
statsSheet.getRange("A15:C15").values = [["预期动作", "实际数量", "用途"]];
statsSheet.getRange("A16:A20").values = actions.map((action) => [action]);
statsSheet.getRange("B16:B20").formulas = actions.map((_, i) => [`=COUNTIF('第二批100条问题'!$J$2:$J$101,A${i + 16})`]);
statsSheet.getRange("C16:C20").values = [["证据充分时给组合"], ["说明条件成立时的替代组合"], ["信息不足时先问关键条件"], ["纠正产品角色或错误前提"], ["拒绝性能、迁移或敏感信息承诺"]];
for (const range of ["A4:D4", "F4:H4", "F9:H9", "A15:C15"]) statsSheet.getRange(range).format = { fill: "#4472C4", font: { bold: true, color: "#FFFFFF" } };
for (const range of ["A4:D13", "F4:H13", "A15:C20"]) statsSheet.getRange(range).format.borders = { preset: "all", style: "thin", color: "#D9E2F3" };
statsSheet.getRange("A1:H20").format.wrapText = true;
statsSheet.getRange("A:A").format.columnWidth = 36;
statsSheet.getRange("B:D").format.columnWidth = 15;
statsSheet.getRange("C:C").format.columnWidth = 40;
statsSheet.getRange("F:F").format.columnWidth = 24;
statsSheet.getRange("G:G").format.columnWidth = 15;
statsSheet.getRange("H:H").format.columnWidth = 42;
statsSheet.getRange("A4:H20").format.rowHeight = 31;
statsSheet.getRange("D5:D13").conditionalFormats.add("containsText", { text: "通过", format: { fill: "#E2F0D9", font: { color: "#375623" } } });
statsSheet.getRange("D5:D13").conditionalFormats.add("containsText", { text: "检查", format: { fill: "#F4CCCC", font: { color: "#990000" } } });
statsSheet.freezePanes.freezeRows(4);

guideSheet.mergeCells("A1:F2");
guideSheet.getRange("A1:F2").values = [["跨产品组合题库｜使用说明"]];
guideSheet.getRange("A1:F2").format = { fill: "#17365D", font: { bold: true, color: "#FFFFFF", size: 18 }, horizontalAlignment: "center", verticalAlignment: "center" };
guideSheet.mergeCells("A4:F4");
guideSheet.getRange("A4:F4").values = [["重要：默认回答只展示结论、推荐组合和产品分工；追问、风险和来源仅在必要时追加。"]];
guideSheet.getRange("A4:F4").format = { fill: "#FFF2CC", font: { bold: true, color: "#7F6000" } };
guideSheet.getRange("A6:B6").values = [["执行顺序", "说明"]];
guideSheet.getRange("A7:B13").values = [
  ["1. 拆分需求", "把一句复合问题拆成数据底座、工具治理、平台管理和智能编排。"],
  ["2. 选择组合", "依据时效、事务、集群和治理范围选择主推组合，不因单个关键词直接定产品。"],
  ["3. 说明分工", "回答中逐项说明 TDH/ArgoDB、TDS、TDC、Astro 分别负责什么。"],
  ["4. 限制追问", "信息不足时最多先问 2 个高价值问题，再给条件化推荐。"],
  ["5. 处理冲突", "Astro 智能体数量与名单存在版本冲突，必须标注目标版本并请专家确认。"],
  ["6. 专家复核", "逐条确认主推组合、可选组合、产品分工、来源和限制条件。"],
  ["7. 收集真题", "模拟题通过后，再单独收集真实销售原话并标记为真实问题。"],
];
guideSheet.mergeCells("D6:F6");
guideSheet.getRange("D6:F6").values = [["默认回答与按需补充"]];
guideSheet.getRange("D7:F13").values = [["1. 结论", "", ""], ["2. 推荐组合", "", ""], ["3. 产品分工", "", ""], ["4. 需要确认（按需）", "", ""], ["5. 风险说明（按需）", "", ""], ["6. 资料来源（按需）", "", ""], ["空字段不显示", "", ""]];
guideSheet.getRange("D7:F13").merge(true);
guideSheet.mergeCells("A15:F15");
guideSheet.getRange("A15:F15").values = [["上线前验收"]];
guideSheet.getRange("A16:F21").values = [
  ["40 条组合映射全部有来源、产品分工、适用和排除条件", "", "", "", "", ""],
  ["100 条问题的分类配额为 20/20/15/15/10/5/10/5", "", "", "", "", ""],
  ["难度配额为简单 30、中等 50、困难 20", "", "", "", "", ""],
  ["所有映射均至少被一条问题覆盖", "", "", "", "", ""],
  ["信息不足题必须先追问；版本冲突题不得给高置信度结论", "", "", "", "", ""],
  ["真实销售问题仍需单独收集，本文件不能替代 D1-08", "", "", "", "", ""],
];
guideSheet.getRange("A16:F21").merge(true);
guideSheet.getRange("A6:B6").format = { fill: "#4472C4", font: { bold: true, color: "#FFFFFF" } };
guideSheet.getRange("D6:F6").format = { fill: "#4472C4", font: { bold: true, color: "#FFFFFF" } };
guideSheet.getRange("A15:F15").format = { fill: "#D9EAF7", font: { bold: true, color: "#17365D" } };
guideSheet.getRange("A6:B13").format.borders = { preset: "all", style: "thin", color: "#D9E2F3" };
guideSheet.getRange("D6:F13").format.borders = { preset: "all", style: "thin", color: "#D9E2F3" };
guideSheet.getRange("A4:F21").format.wrapText = true;
guideSheet.getRange("A:A").format.columnWidth = 24;
guideSheet.getRange("B:B").format.columnWidth = 66;
guideSheet.getRange("C:C").format.columnWidth = 4;
guideSheet.getRange("D:F").format.columnWidth = 23;
guideSheet.getRange("A7:F21").format.rowHeight = 36;

const previews = [
  ["第二批100条问题", "A1:W16", "questions.png", 0.7],
  ["跨产品组合映射", "A1:O16", "mappings.png", 0.8],
  ["分类统计", "A1:H20", "stats.png", 1.1],
  ["使用说明", "A1:F21", "guide.png", 1.1],
];
for (const [sheetName, range, fileName, scale] of previews) {
  const rendered = await workbook.render({ sheetName, range, scale, format: "png" });
  await fs.writeFile(`${previewDir}/${fileName}`, new Uint8Array(await rendered.arrayBuffer()));
}

for (const [sheetName, range] of [["第二批100条问题", "A1:W8"], ["跨产品组合映射", "A1:O8"], ["分类统计", "A1:H20"], ["使用说明", "A1:F21"]]) {
  const inspection = await workbook.inspect({ kind: "table", range: `${sheetName}!${range}`, include: "values,formulas", tableMaxRows: 24, tableMaxCols: 24, maxChars: 12000 });
  console.log(inspection.ndjson);
}
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`mapping_csv=${mappingPath}`);
console.log(`question_csv=${questionPath}`);
console.log(`xlsx=${outputPath}`);
