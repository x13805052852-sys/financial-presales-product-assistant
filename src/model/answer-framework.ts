import { normalizeText } from "../knowledge/normalize.js";

export type AnswerFrameworkId =
  | "product_overview"
  | "solution_recommendation"
  | "risk_explanation";

export interface AnswerFrameworkDefinition {
  id: AnswerFrameworkId;
  label: string;
  requiredHeadings: readonly string[];
  optionalHeadings: readonly string[];
  forbiddenHeadings: readonly string[];
  specialInstructions: readonly string[];
}

export const defaultAnswerFramework: AnswerFrameworkId = "solution_recommendation";

export const answerFrameworks: Record<AnswerFrameworkId, AnswerFrameworkDefinition> = {
  product_overview: {
    id: "product_overview",
    label: "产品功能介绍",
    requiredHeadings: ["结论", "主要功能"],
    optionalHeadings: ["口径说明", "需要确认", "资料来源"],
    forbiddenHeadings: ["推荐组合", "产品分工", "风险说明", "冲突点", "实际影响", "销售口径"],
    specialInstructions: [
      "概括当前知识证据明确描述的主要功能，不强行推荐产品组合。",
      "如果证据没有新旧版本对比，不得把当前功能称为新增功能，只能称为当前资料中的主要功能。",
      "资料版本、功能数量或名称存在冲突时，用一次口径说明概括。",
    ],
  },
  solution_recommendation: {
    id: "solution_recommendation",
    label: "产品选型与能力边界",
    requiredHeadings: ["结论", "推荐组合", "产品分工"],
    optionalHeadings: ["需要确认", "风险说明", "资料来源"],
    forbiddenHeadings: ["主要功能", "口径说明", "冲突点", "实际影响", "销售口径"],
    specialInstructions: [
      "直接回答能否实现以及推荐方向，并说明各产品职责。",
      "只有条件会改变产品选择时才追加需要确认，最多两个问题。",
      "存在资料冲突、未确认能力或越界承诺时，只追加一次风险说明。",
    ],
  },
  risk_explanation: {
    id: "risk_explanation",
    label: "风险与资料冲突解释",
    requiredHeadings: ["冲突点", "实际影响", "销售口径"],
    optionalHeadings: ["需要确认", "资料来源"],
    forbiddenHeadings: ["结论", "主要功能", "推荐组合", "产品分工", "口径说明", "风险说明"],
    specialInstructions: [
      "具体说明资料之间哪里不一致、会影响哪些销售或交付表述。",
      "区分已明确的具体能力和待确认的数量、名称、版本或交付范围。",
      "不要因为清单冲突直接否定已有证据明确描述的具体能力，也不要重复产品选型组合。",
    ],
  },
};

const riskPhrases = [
  "风险说明",
  "资料冲突",
  "版本冲突",
  "为什么不一致",
  "哪里不一致",
  "冲突是什么",
  "口径不一致",
  "口径冲突",
  "风险",
  "冲突",
  "不一致",
  "销售口径",
];

const recommendationPhrases = [
  "搭配",
  "组合",
  "推荐",
  "选型",
  "哪个产品",
  "哪些产品",
  "怎么配",
  "如何配",
  "需要什么产品",
  "需要哪些产品",
  "用什么产品",
  "能否单独",
  "能不能单独",
  "是否能够单独",
  "如何实现",
  "怎么实现",
];

const overviewPhrases = [
  "主要功能",
  "功能有哪些",
  "有哪些功能",
  "产品介绍",
  "介绍一下",
  "当前能力",
  "目前能力",
  "主要能力",
  "更新功能",
  "更新了什么",
  "更新有哪些",
  "支持哪些功能",
  "功能是什么",
];

function includesAny(question: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => question.includes(normalizeText(phrase)));
}

export function classifyAnswerFramework(question: string): AnswerFrameworkId {
  const normalizedQuestion = normalizeText(question);

  if (includesAny(normalizedQuestion, riskPhrases)) {
    return "risk_explanation";
  }
  if (includesAny(normalizedQuestion, recommendationPhrases)) {
    return "solution_recommendation";
  }
  if (includesAny(normalizedQuestion, overviewPhrases)) {
    return "product_overview";
  }
  return defaultAnswerFramework;
}
