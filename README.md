# 金融售前产品匹配助手

本仓库用于管理“金融售前产品匹配助手”的内部设计、五天交付计划、资料准备和上线验收。

## 项目目标

销售在企业微信群内输入：

> @金融售前助手 客户希望建设实时湖仓，并保留现有数据平台，应该推荐什么产品？

机器人按统一结构回答：

1. 推荐产品或产品组合
2. 推荐理由
3. 适用条件
4. 可选方案
5. 资料来源

## 首版范围

- 面向企业内部销售和售前人员。
- 通过企业微信 API 模式智能机器人接入内部群聊。
- 根据客户需求、功能和场景推荐公司产品。
- 首批覆盖 5～8 组高频产品线。
- 仅使用经过确认的产品资料，不连接 CRM、合同系统或业务数据库。
- 资料不足或存在冲突时明确提示，不猜测产品结论。

## 文档导航

- [产品设计](docs/superpowers/specs/2026-08-31-financial-presales-product-assistant-design.md)
- [TDH 100 条模拟销售问题测试集设计](docs/superpowers/specs/2026-08-31-tdh-synthetic-sales-questions-design.md)
- [跨产品组合映射与第二批 100 条模拟问题设计](docs/superpowers/specs/2026-09-01-cross-product-combination-question-set-design.md)
- [五天内部执行计划](docs/PROJECT_EXECUTION_PLAN.md)
- [上线验收标准](docs/ACCEPTANCE_CRITERIA.md)
- [资料准备说明](docs/DATA_PREPARATION_GUIDE.md)
- [任务追踪表](docs/TASK_TRACKER.md)
- [TDH 资料筛选报告](docs/TDH_SOURCE_ASSESSMENT.md)
- [跨产品组合资料筛选报告](docs/CROSS_PRODUCT_SOURCE_ASSESSMENT.md)
- [TDH 逐文件资料清单](docs/TDH_SOURCE_INVENTORY.csv)
- [领域词汇表](CONTEXT.md)
- [TDH 产品标准名与别名](docs/knowledge/TDH_PRODUCT_ALIASES.csv)
- [TDH 能力—产品映射初稿](docs/knowledge/TDH_CAPABILITY_PRODUCT_MAPPING.csv)
- [TDH 100 条模拟销售问题](docs/knowledge/TDH_SYNTHETIC_TEST_QUESTIONS_100.csv)
- [跨产品组合映射](docs/knowledge/CROSS_PRODUCT_COMBINATION_MAPPING.csv)
- [第二批 100 条跨产品模拟销售问题](docs/knowledge/CROSS_PRODUCT_SYNTHETIC_TEST_QUESTIONS_100.csv)
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
