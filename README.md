# 金融售前产品匹配助手

本仓库用于管理“金融售前产品匹配助手”的内部设计、五天交付计划、资料准备和上线验收。

## 项目目标

销售在企业微信群内输入：

> @金融售前助手 客户希望建设实时湖仓，并保留现有数据平台，应该推荐什么产品？

机器人会根据问题类型自动选择回答结构：

- 产品功能介绍：结论、主要功能，按需补充口径说明。
- 产品选型：结论、推荐组合、产品分工。
- 风险与资料冲突：冲突点、实际影响、销售口径。

信息不足、资料冲突或用户主动要求详细说明时，再按需补充追问、风险说明和资料来源。

机器人会在同一群聊中按提问人隔离上下文，并自动识别紧邻上一轮的自然追问。系统只保留一轮、30分钟有效的内存上下文；判断不清时按新问题处理。识别为追问时，回答开头会显示简短的“承接上一问”提示。

## 首版范围

- 面向企业内部销售和售前人员。
- 通过企业微信 API 模式智能机器人接入内部群聊。
- 根据客户需求、功能和场景推荐公司产品。
- 首批覆盖 5～8 组高频产品线。
- 仅使用经过确认的产品资料，不连接 CRM、合同系统或业务数据库。
- 资料不足或存在冲突时明确提示，不猜测产品结论。

## 文档导航

- [当前项目进度（2026-09-03）](docs/PROGRESS_STATUS_2026-09-03.md)
- [产品设计](docs/superpowers/specs/2026-08-31-financial-presales-product-assistant-design.md)
- [TDH 100 条模拟销售问题测试集设计](docs/superpowers/specs/2026-08-31-tdh-synthetic-sales-questions-design.md)
- [跨产品组合映射与第二批 100 条模拟问题设计](docs/superpowers/specs/2026-09-01-cross-product-combination-question-set-design.md)
- [企业微信售前助手简洁回答框架](docs/superpowers/specs/2026-09-01-concise-answer-framework-design.md)
- [企业微信售前助手动态回答框架](docs/superpowers/specs/2026-09-01-dynamic-answer-framework-design.md)
- [企业微信运行版 V0.1 设计](docs/superpowers/specs/2026-09-01-wecom-mvp-runtime-design.md)
- [企业微信单轮上下文识别设计](docs/superpowers/specs/2026-09-02-one-turn-context-resolution-design.md)
- [企业微信单轮上下文实施计划](docs/superpowers/plans/2026-09-02-one-turn-context-resolution-implementation-plan.md)
- [LLMOps 知识准备设计](docs/superpowers/specs/2026-09-03-llmops-knowledge-preparation-design.md)
- [LLMOps 知识准备实施计划](docs/superpowers/plans/2026-09-03-llmops-knowledge-preparation-implementation-plan.md)
- [五天内部执行计划](docs/PROJECT_EXECUTION_PLAN.md)
- [上线验收标准](docs/ACCEPTANCE_CRITERIA.md)
- [资料准备说明](docs/DATA_PREPARATION_GUIDE.md)
- [任务追踪表](docs/TASK_TRACKER.md)
- [TDH 资料筛选报告](docs/TDH_SOURCE_ASSESSMENT.md)
- [LLMOps 资料筛选报告](docs/LLMOPS_SOURCE_ASSESSMENT.md)
- [跨产品组合资料筛选报告](docs/CROSS_PRODUCT_SOURCE_ASSESSMENT.md)
- [TDH 逐文件资料清单](docs/TDH_SOURCE_INVENTORY.csv)
- [LLMOps 逐文件资料清单](docs/LLMOPS_SOURCE_INVENTORY.csv)
- [LLMOps 知识准备 TODO](docs/LLMOPS_KNOWLEDGE_TODO.md)
- [领域词汇表](CONTEXT.md)
- [TDH 产品标准名与别名](docs/knowledge/TDH_PRODUCT_ALIASES.csv)
- [TDH 能力—产品映射初稿](docs/knowledge/TDH_CAPABILITY_PRODUCT_MAPPING.csv)
- [TDH 100 条模拟销售问题](docs/knowledge/TDH_SYNTHETIC_TEST_QUESTIONS_100.csv)
- [LLMOps 产品及组件别名](docs/knowledge/LLMOPS_PRODUCT_ALIASES.csv)
- [LLMOps 功能—产品映射](docs/knowledge/LLMOPS_CAPABILITY_PRODUCT_MAPPING.csv)
- [LLMOps 场景—组合映射](docs/knowledge/LLMOPS_COMBINATION_MAPPING.csv)
- [LLMOps 100 条单轮模拟销售问题](docs/knowledge/LLMOPS_SYNTHETIC_TEST_QUESTIONS_100.csv)
- [LLMOps 100 组双轮上下文测试](docs/knowledge/LLMOPS_CONTEXT_TWO_TURN_TEST_QUESTIONS_100.csv)
- [跨产品组合映射](docs/knowledge/CROSS_PRODUCT_COMBINATION_MAPPING.csv)
- [第二批 100 条跨产品模拟销售问题](docs/knowledge/CROSS_PRODUCT_SYNTHETIC_TEST_QUESTIONS_100.csv)
- [100 组双轮上下文测试](docs/knowledge/CONTEXT_TWO_TURN_TEST_QUESTIONS_100.csv)
- [协作与任务完成规则](CONTRIBUTING.md)
- [资料清单模板](docs/templates/source_manifest.csv)
- [需求与产品映射模板](docs/templates/capability_product_mapping.csv)
- [验收问题模板](docs/templates/acceptance_questions.csv)

## 首批建议产品线

1. TDH
2. ArgoDB
3. TDC
4. TDS / Astro
5. LLMOps
6. TKH
7. 无涯·问数 / 无涯·问知
8. Scope

最终范围以第 1 天完成的产品资料盘点和产品专家确认结果为准；若某产品没有有效资料，则不进入首版。

当前 TDH 映射仍处于“待产品专家确认”状态，只能用于内部实验和测试，不能直接作为对客承诺。

跨产品组合映射覆盖 TDH、ArgoDB、TDC、TDS 和 Astro，同样处于“待产品专家确认”状态。Astro 资料中的智能体数量和个别名称存在版本口径差异，机器人必须按目标版本提示确认，不能硬性回答。

LLMOps 首版已覆盖 Corpus Studio、Model Foundry、Knowledge Lodge、Agent Go、AI Infra 五个产品域及主要组件。当前映射仍处于内部实验状态；旧版本、规划能力、测试数字和竞品材料不会作为默认对客口径。

## 自动测试

本地执行：

```bash
bash scripts/test.sh
```

首次克隆仓库后启用提交门禁：

```bash
bash scripts/setup_git_hooks.sh
```

此后每次 `git push` 前会自动执行本地测试；推送或创建 Pull Request 后，GitHub Actions 会再次执行相同检查。只有本地测试、远端测试和任务验收全部通过，任务才允许标记为完成。
