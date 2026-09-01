import { normalizeText } from "../knowledge/normalize.js";

export type ScopeDecision = "allowed" | "empty" | "out_of_scope" | "sensitive";

const sensitiveTerms = [
  "最低成交价",
  "价格",
  "报价",
  "折扣",
  "合同",
  "客户名单",
  "联系人",
  "api key",
  "apikey",
  "secret",
  "密钥",
  "忽略知识库",
  "忽略公司规则",
  "忽略规则",
];

const supportedTerms = [
  "tdh",
  "argodb",
  "tds",
  "astro",
  "tdc",
  "llmops",
  "tkh",
  "scope",
  "数据湖",
  "湖仓",
  "数据库",
  "数仓",
  "数据治理",
  "实时",
  "数据同步",
  "数据服务",
  "数据开发",
  "集群",
  "算力",
  "大模型",
  "智能体",
  "agent",
  "oracle",
  "hana",
  "elasticsearch",
  "信创",
];

export function classifyQuestionScope(question: string): ScopeDecision {
  const normalized = normalizeText(question);
  if (!normalized) {
    return "empty";
  }
  if (sensitiveTerms.some((term) => normalized.includes(normalizeText(term)))) {
    return "sensitive";
  }
  if (supportedTerms.some((term) => normalized.includes(normalizeText(term)))) {
    return "allowed";
  }
  return "out_of_scope";
}

export function scopeMessage(decision: Exclude<ScopeDecision, "allowed">): string {
  switch (decision) {
    case "empty":
      return "请描述客户需要的功能、当前系统或目标场景。";
    case "sensitive":
      return "该问题涉及价格、合同、客户信息或安全边界，我不能直接回答，请联系对应负责人确认。";
    case "out_of_scope":
      return "我目前只回答公司产品功能、适用场景和产品组合问题。";
  }
}
