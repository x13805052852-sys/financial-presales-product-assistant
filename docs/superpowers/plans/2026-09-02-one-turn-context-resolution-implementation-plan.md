# 企业微信单轮上下文识别实施计划

- 日期：2026-09-02
- 对应设计：`../specs/2026-09-02-one-turn-context-resolution-design.md`
- 目标：使用确定性规则识别同群同人的紧邻追问，只保留一轮上下文，默认按新问题处理不确定输入。
- 验收门槛：上下文判断正确率不低于95%，错误继承率不高于2%，核心产品推荐正确率不低于90%。

## 实施原则

- 测试先行：每个模块先写失败测试，再实现最小功能使测试通过。
- 模型无关：上下文判定不能调用 GLM、DeepSeek 或其他大模型。
- 单一职责：会话存储、规则评分、问题补全、知识问答和企业微信接入分别实现。
- 安全回退：字段缺失、记录过期、规则异常或分数不足时均按新问题处理。
- 提交隔离：先把当前已完成的企业微信运行版形成基线提交，再按模块提交上下文功能。

## 任务 0：固定企业微信运行版基线

### 涉及文件

- `package.json`
- `package-lock.json`
- `src/cli/wecom-bot.ts`
- `src/wecom/message-handler.ts`
- `src/wecom/message-handler.test.ts`
- `src/wecom/safe-logger.ts`

### 步骤

1. 检查当前未提交的企业微信文件，确认没有真实 API Key、Bot ID、Bot Secret 或日志内容。
2. 运行 TypeScript 类型检查、32 项现有程序测试、Python 仓库测试和构建。
3. 将上述企业微信运行版文件单独提交为基线，不混入上下文实现。

### 验收

- 基线提交只包含企业微信 SDK、启动入口、消息处理及其依赖。
- 机器人仍可通过本机环境变量启动。
- 当前企业微信测试进程不因 Git 提交而中断。

## 任务 1：会话标识与单轮上下文仓库

### 新增文件

- `src/context/types.ts`
- `src/context/session-key.ts`
- `src/context/session-key.test.ts`
- `src/context/one-turn-context-store.ts`
- `src/context/one-turn-context-store.test.ts`

### 测试先行

1. 同群同人生成相同会话键。
2. 同群不同人、同人不同群和单聊分别生成不同会话键。
3. 会话键是固定长度摘要，不包含原始群 ID 或用户 ID。
4. 每个会话只保存一条快照，新记录覆盖旧记录。
5. 30分钟后的记录读取结果为空。
6. 超过 1,000 个会话时淘汰最早记录。
7. 提供可注入时钟，测试不依赖真实等待。

### 实现

- 定义 `ConversationIdentity`、`ContextSnapshot`、`ContextDecision` 和规则命中类型。
- 使用 Node.js `crypto` 生成 SHA-256 会话键摘要。
- 实现有界内存 Map、TTL、覆盖和惰性清理。
- 不提供文件或数据库持久化接口。

### 验收

- 用户隔离、TTL、容量和覆盖测试全部通过。
- 仓库模块不记录或输出真实身份字段。

## 任务 2：确定性上下文评分器

### 新增文件

- `src/context/context-resolver.ts`
- `src/context/context-resolver.test.ts`

### 测试先行

覆盖以下场景并断言分数、命中规则和最终决定：

- “所以正常能到多少？”继承上一轮实时治理问题。
- “那银行能用吗？”继承上一轮产品组合。
- “再试一下”重试上一条可重试错误。
- 引用内容与上一问或上一答匹配时继承。
- 引用其他消息时不因引用本身继承。
- “Astro目前更新了哪些功能？”在上一轮讨论实时治理后按新问题处理。
- 当前问题完整且指定不同产品时按新问题处理。
- 同一产品的完整独立问题分数不足时按新问题处理。
- 缺少上一轮、过期、身份不符或字段异常时按新问题处理。
- 总分恰好为4时继承，低于4时按新问题处理。

### 实现

- 固化设计中的正向、负向信号和阈值。
- 复用产品别名归一化能力识别产品重合。
- 使用有限的售前能力词表识别实时、治理、事务、湖仓、数据服务和智能治理等主题。
- 完整问题检测只使用语法和实体特征，不调用大模型。
- 返回结构化 `ContextDecision`，包含 `followUp`、`score`、`matchedRules` 和安全原因码。

### 验收

- 所有边界测试结果稳定且可解释。
- 对相同输入重复运行得到完全相同的决定。

## 任务 3：问题补全与追问提示

### 新增文件

- `src/context/question-resolver.ts`
- `src/context/question-resolver.test.ts`

### 测试先行

1. 追问只合并上一轮结构化需求、产品组合、能力和当前问题。
2. 不把上一轮完整模型回答或资料来源全文拼入补全问题。
3. 新问题保持原文，不附加上一轮内容。
4. 追问提示以“承接上一问：”开头并控制在20个中文字符以内。
5. 提示摘要过滤邮箱、手机号、API Key、已配置的敏感客户名称和合同价格表达。
6. 空摘要时不生成追问提示，但不影响问答。

### 实现

- 实现结构化补全模板和最小化摘要。
- 实现程序生成的 `contextBanner`，与模型回答正文分离。
- 复用现有脱敏思想，补充上下文提示专用过滤规则。

### 验收

- 示例追问被补全为针对上一轮组合的明确问题。
- 模型输入不包含无关的上一轮长回答。

## 任务 4：为上下文快照提供可审计的问答元数据

### 修改文件

- `src/app/presales-assistant.ts`
- `src/app/presales-assistant.test.ts`
- `src/app/audit-logger.ts`
- 相关测试文件

### 测试先行

1. `AnswerResult` 在回答成功时提供规范化问题、识别产品、能力摘要、知识编号和主题标签。
2. 元数据从检索结果和知识条目生成，不解析模型自由文本作为事实。
3. 无证据、拒答和模型错误时返回明确的上下文保存策略。
4. 审计事件可记录上下文决定、分数和规则名，但不记录用户 ID、群 ID 或完整上下文。
5. 现有动态回答框架、证据校验和错误行为保持不变。

### 实现

- 为内部结果增加 `groundingSummary`，包含上下文仓库需要的最小字段。
- 从 `RetrievalResult.recognizedProducts`、命中条目的能力和推荐组合派生摘要。
- 扩展审计类型，新增可选的 `contextDecision`、`contextScore` 和 `contextRules`。
- 保持 CLI 单轮问答接口兼容。

### 验收

- 快照所需事实全部来自检索证据。
- 日志密钥扫描和身份信息检查通过。

## 任务 5：会话协调层与企业微信接入

### 新增文件

- `src/context/conversation-coordinator.ts`
- `src/context/conversation-coordinator.test.ts`

### 修改文件

- `src/wecom/message-handler.ts`
- `src/wecom/message-handler.test.ts`
- `src/cli/wecom-bot.ts`

### 测试先行

1. 消息处理器向协调层传递 `chattype`、`chatid`、`from.userid` 和引用内容。
2. 同一用户追问时，助手收到补全后的问题。
3. 不同用户紧邻提问时，助手只收到各自原始问题。
4. 新话题覆盖旧快照，下一次只能继承最新一轮。
5. 追问回答前增加简短提示，新问题不增加提示。
6. 敏感或越界问题不进入上下文，也不覆盖有效上一轮。
7. 模型失败时保存可重试问题；“再试一下”执行失败的当前问题。
8. 协调层异常时回退为单轮问答，仍能返回企业微信回复。

### 实现

- `ConversationCoordinator` 组合上下文仓库、规则判定器、问题补全器和现有 `PresalesAssistant`。
- `WecomMessageHandler` 只负责提取消息元数据、去重、进度回复和最终发送。
- 在 `wecom-bot.ts` 中创建一个进程级上下文仓库和协调层实例。
- 在模型回答通过现有校验后再添加 `contextBanner`。

### 验收

- 企业微信消息接入不承担评分和业务知识逻辑。
- 群聊同群不同人不存在上下文串话。
- 原有单轮消息行为保持兼容。

## 任务 6：100 组双轮测试集与自动评测

### 新增文件

- `docs/knowledge/CONTEXT_TWO_TURN_TEST_QUESTIONS_100.csv`
- `src/context/context-regression.test.ts`

### 修改文件

- `tests/test_repository.py`
- `docs/ACCEPTANCE_CRITERIA.md`
- `README.md`

### 数据字段

```text
编号,类别,群聊ID,上一轮用户ID,当前用户ID,上一问,上一轮主题,上一轮产品,当前问,是否引用,期望是否继承,期望补全关键词,期望核心产品,风险标签,审核状态
```

### 数据分布

- 40 组正常追问。
- 30 组同一销售换话题。
- 15 组群内不同销售交叉提问。
- 15 组引用、省略、重试、超时和阈值边界问题。

### 自动评测

- Python 仓库测试校验总数、类别分布、唯一编号、必填字段和审核状态。
- TypeScript 回归测试逐行执行上下文判定，计算整体正确率和错误继承率。
- 对继承样例断言补全关键词；对产品样例断言检索前三名包含期望核心产品。
- 测试失败时打印编号、分数和命中规则，便于修正规则而不是盲目调模型。

### 验收

- 上下文判断正确率不低于95%。
- 错误继承率不高于2%。
- 测试集不作为产品事实知识参与生产检索。

## 任务 7：全量验证与企业微信真实测试

### 自动验证

依次运行：

```bash
npm run typecheck
npm test
npm run build
python3 -m unittest discover -s tests -v
```

另外执行：

- 200 条原有单轮检索回归。
- 100 组双轮上下文回归。
- 仓库密钥扫描和 `git diff --check`。
- 检查日志中不存在原始用户 ID、群 ID 和凭证。

### 企业微信实测

在内部测试群使用同一销售、不同销售各完成至少以下场景：

1. 实时治理选型后追问“所以正常能到多少？”。
2. 追问后立即改问 Astro 功能，确认自动开始新话题。
3. 另一名销售紧接着问“那银行能用吗？”，确认不继承他人上下文。
4. 引用机器人上一条回答继续追问。
5. 问题触发资料不足、敏感拦截和模型失败时检查上下文行为。

### 验收

- 真实消息中的追问提示与内部决定一致。
- 不出现跨用户串话。
- 产品回答仍满足动态框架和知识证据要求。

## 任务 8：模型切换准备与版本提交

### DeepSeek 准备

- 上下文判定器保持模型无关，不为 DeepSeek 增加分支。
- 模型切换仅通过现有 `LLM_BASE_URL`、`LLM_MODEL` 和 `LLM_API_KEY` 完成。
- 切换后重新运行格式、超时、重试、200 条单轮和 100 组双轮测试。

### 提交建议

1. `feat: connect wecom long-running bot`：当前企业微信基线。
2. `feat: add one-turn context store and resolver`：会话键、仓库和规则评分。
3. `feat: connect context resolution to wecom`：协调层、消息接入和审计。
4. `test: add two-turn conversation regression set`：100 组数据及验收测试。
5. `docs: document one-turn context behavior`：README 和验收说明。

### 最终交付

- 推送全部提交到 GitHub。
- 保留可回滚到企业微信单轮问答基线的独立提交。
- 不提交 `.env`、日志、真实用户信息或任何 API 凭证。
