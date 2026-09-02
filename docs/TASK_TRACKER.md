# 任务追踪表

填写规则：任务完成后将 `[ ]` 改为 `[x]`，并在该行末尾补充 Pull Request、提交号、测试报告或验收记录。没有证据不得勾选。

当前进度（2026-09-02）：**33/53 项完成，完成率 62.3%**。详细状态与下一步见 `docs/PROGRESS_STATUS_2026-09-02.md`。

## 第 1 天

- [ ] D1-01 召开 30 分钟启动会｜证据：
- [x] D1-02 确定首批 5～8 组产品线｜证据：`README.md`、`docs/knowledge/CROSS_PRODUCT_COMBINATION_MAPPING.csv`（首版实际知识覆盖 TDH、ArgoDB、TDC、TDS、Astro）
- [ ] D1-03 收集产品方案总表原始 Excel｜证据：
- [x] D1-04 建立资料清单｜证据：`docs/TDH_SOURCE_INVENTORY.csv`
- [x] D1-05 标记重复、过期和冲突资料｜证据：`docs/TDH_SOURCE_ASSESSMENT.md`
- [x] D1-06 建立产品标准名及别名表｜证据：`CONTEXT.md`、`docs/knowledge/TDH_PRODUCT_ALIASES.csv`
- [x] D1-07 建立能力—产品映射初稿｜证据：`docs/knowledge/TDH_CAPABILITY_PRODUCT_MAPPING.csv`
- [x] D1-08 收集 30 条真实销售需求｜证据：PO 于 2026-09-02 决定首版用 200 条单轮模拟销售问题和 100 组双轮场景替代，按首版完成；这些不是实际客户数据，上线后继续收集真实错题
- [x] D1-09 创建 API 模式智能机器人｜证据：`src/cli/wecom-bot.ts`、提交 `12d96e0`
- [x] D1-10 创建内部测试群并加入机器人｜证据：2026-09-02 企业微信内部测试群已收到机器人回复；运行状态记录见 `docs/PROGRESS_STATUS_2026-09-02.md`
- [x] D1-11 验证长连接和凭证｜证据：2026-09-02 已验证认证、消息收发及自动重连；`src/cli/wecom-bot.ts`、提交 `12d96e0`
- [x] D1-12 范围冻结评审｜证据：`README.md`、`docs/superpowers/specs/2026-09-01-wecom-mvp-runtime-design.md`、用户确认实施记录

## 第 2 天

- [x] D2-01 将 Excel、PPT、PDF 转换为可处理文本｜证据：首版选定资料已结构化为 `docs/knowledge/*.csv`；`docs/TDH_SOURCE_INVENTORY.csv`、`docs/CROSS_PRODUCT_SOURCE_ASSESSMENT.md`
- [x] D2-02 删除重复、过期和禁止使用内容｜证据：`docs/TDH_SOURCE_ASSESSMENT.md`、`docs/CROSS_PRODUCT_SOURCE_ASSESSMENT.md`（冲突资料保留风险标记，不作为确定承诺）
- [x] D2-03 按产品、方案、场景、版本组织资料｜证据：`docs/knowledge/TDH_CAPABILITY_PRODUCT_MAPPING.csv`、`docs/knowledge/CROSS_PRODUCT_COMBINATION_MAPPING.csv`
- [x] D2-04 添加来源元数据｜证据：两份映射表的“资料来源”“审核状态”等字段
- [x] D2-05 配置文档切分和知识索引｜证据：首版采用结构化映射行作为检索单元；`src/knowledge/loader.ts`、提交 `8d27d86`
- [x] D2-06 配置检索与结果重排｜证据：`src/knowledge/retriever.ts`、`src/knowledge/knowledge.test.ts`、提交 `8d27d86`
- [x] D2-07 配置回答模板｜证据：`src/model/answer-framework.ts`、`src/model/prompt.ts`、提交 `e2fbff4`、`6acffc4`
- [x] D2-08 配置无答案与冲突处理规则｜证据：`src/model/answer-validator.ts`、`src/app/presales-assistant.ts`、提交 `504e957`
- [x] D2-09 使用 30 条需求完成离线检索测试｜证据：200 条单轮问题和 100 组双轮场景；核心产品检索 70/75（93.3%），上下文 100/100，误继承 0/50
- [x] D2-10 修正知识库并发布 V1｜证据：当前为可回滚的内部实验知识库 V1；提交 `8d27d86`、`cb109cd`（仍需产品专家确认后才能切生产口径）

## 第 3 天

- [x] D3-01 实现需求要素提取｜证据：`src/knowledge/normalize.ts`、`src/knowledge/retriever.ts`、`src/context/question-resolver.ts`
- [x] D3-02 实现知识检索与产品候选排序｜证据：`src/knowledge/retriever.ts`、`src/knowledge/knowledge.test.ts`
- [x] D3-03 实现结构化答案生成｜证据：`src/model/answer-framework.ts`、`src/model/prompt.ts`、`src/app/presales-assistant.ts`
- [x] D3-04 实现企业微信消息接收｜证据：`src/cli/wecom-bot.ts`、`src/wecom/message-handler.ts`、提交 `12d96e0`
- [x] D3-05 实现流式回复或处理中状态｜证据：`src/wecom/message-handler.ts`（先回复“正在查询”，再发送最终答案）
- [x] D3-06 实现短上下文追问｜证据：同群同用户、仅保留上一轮、30 分钟有效；提交 `3f52cb6`、`c8c2c57`、`5f9eb07`
- [x] D3-07 实现超时、重试和错误提示｜证据：`src/model/openai-compatible-client.ts`、`src/wecom/message-handler.ts`
- [x] D3-08 配置凭证安全和脱敏日志｜证据：`.env.example`、`src/wecom/safe-logger.ts`、`src/app/audit-logger.ts`、仓库密钥扫描测试
- [ ] D3-09 完成 20 轮群内问答｜证据：
- [ ] D3-10 完成内部演示和问题登记｜证据：

## 第 4 天

- [x] D4-01 将测试集扩充至 50 道｜证据：两批共 200 条单轮模拟问题，以及 `docs/knowledge/CONTEXT_TWO_TURN_TEST_QUESTIONS_100.csv` 的 100 组双轮场景（待产品专家确认）
- [x] D4-02 执行功能验收测试｜证据：内部自动化功能验收已通过；60 个 TypeScript 测试、12 个 Python 仓库测试、200 条单轮检索回归、100 组双轮上下文回归
- [ ] D4-03 产品专家逐题复核｜证据：
- [ ] D4-04 修正错误知识和映射关系｜证据：
- [x] D4-05 修正检索、提示词和回答格式｜证据：动态三类回答框架及单轮上下文已完成；提交 `e2fbff4`、`3f52cb6`、`c8c2c57`
- [x] D4-06 测试资料外、模糊和错误前提问题｜证据：两批单轮测试集中的越界/错误前提场景，以及 `src/app/presales-assistant.test.ts`
- [x] D4-07 测试越权、敏感信息和提示词攻击｜证据：`src/app/presales-assistant.test.ts`、`src/model/model.test.ts`、`tests/test_repository.py`（自动化安全基线）
- [ ] D4-08 执行完整回归测试｜证据：
- [ ] D4-09 准备上线、监控和回滚步骤｜证据：
- [ ] D4-10 编写一页式用户说明｜证据：
- [ ] D4-11 发布候选版本 V1.0｜证据：

## 第 5 天

- [ ] D5-01 上线前检查｜证据：
- [ ] D5-02 备份发布版本｜证据：
- [ ] D5-03 开放 10～20 人灰度群｜证据：
- [ ] D5-04 监控问题与指标｜证据：
- [ ] D5-05 首轮问题修复｜证据：
- [ ] D5-06 第二轮灰度验证｜证据：
- [ ] D5-07 Go/No-Go 评审｜证据：
- [ ] D5-08 正式开放｜证据：
- [ ] D5-09 发布使用说明｜证据：
- [ ] D5-10 完成交接｜证据：
