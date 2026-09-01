import assert from "node:assert/strict";
import test from "node:test";

import { classifyAnswerFramework } from "./answer-framework.js";

test("classifies product feature and update questions as product overview", () => {
  assert.equal(
    classifyAnswerFramework("告诉我 Astro 目前的更新主要功能有哪些"),
    "product_overview",
  );
  assert.equal(classifyAnswerFramework("介绍一下TDH的主要能力"), "product_overview");
});

test("classifies product matching and boundary questions as recommendations", () => {
  assert.equal(
    classifyAnswerFramework("实时流入数据库并且带有数据治理，应当怎么搭配？"),
    "solution_recommendation",
  );
  assert.equal(classifyAnswerFramework("Astro 能否单独完成治理？"), "solution_recommendation");
});

test("gives risk explanation the highest priority", () => {
  assert.equal(
    classifyAnswerFramework("这个推荐组合的资料为什么不一致，请详细说明风险"),
    "risk_explanation",
  );
});

test("falls back to solution recommendation for unknown wording", () => {
  assert.equal(classifyAnswerFramework("客户有一个新的实时场景"), "solution_recommendation");
});
