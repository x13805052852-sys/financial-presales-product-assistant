#!/usr/bin/env python3
"""Build the derived LLMOps source inventory from the local extraction index."""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "tmp" / "llmops-analysis" / "source_index.json"
OUTPUT = ROOT / "docs" / "LLMOPS_SOURCE_INVENTORY.csv"

CORE = {
    "04产品介绍/LLMOps3 上新：企业内部的Agent Engineering 是什么？LLMOps是如何做的？—260716（范豪钧）.pdf",
    "04产品介绍/LLMOps3：AgentGo 智能体平台.pptx",
    "04产品介绍/LLMOps3：TokenFactory词元工厂.pptx",
    "04产品介绍/LLMOps3：大模型时代下的AI中台.pptx",
    "04产品介绍/LLMOps3：平台介绍-AI转型 .pptx",
}

CONDITIONAL = {
    "04产品介绍/LLMOps3 上新：企业内部的Agent Engineering 是什么？LLMOps是如何做的？-视频-1-共享屏幕.mp4",
    "04产品介绍/LLMOps技术架构图.pptx",
    "04产品介绍/产品使用手册获取方式/Sophon_LLMOps_User_Manual-llm-1.4.3.pdf",
    "04产品介绍/产品使用手册获取方式/产品手册在线查看入口.png",
}


def version_for(path: str) -> str:
    name = Path(path).name
    if name.endswith(".WeDrive"):
        return "无"
    if "260716" in name or "视频-1" in name:
        return "LLMOps 3.0 / 2026-07-16"
    if name.startswith("LLMOps3"):
        return "LLMOps 3.0 / 2026"
    if name == "LLMOps技术架构图.pptx":
        return "V2.0、V1.4、V1.3 混合"
    if "1.4.3" in name:
        return "v1.4.3 / 2025-06"
    if "1.3.2" in name:
        return "v1.3.2"
    if "1.3.3" in name or "V1.3.3" in name:
        return "v1.3.3"
    if "V1.1" in name:
        return "v1.1"
    if "v141" in name or "v1.4" in name:
        return "v1.4 / 2025"
    if "v200" in name:
        return "v2.0 / 2025"
    if "LLMOps2" in name or "LLMops2" in name:
        return "LLMOps 2.x / 2025"
    if "202505" in name:
        return "2025-05"
    if "2025" in name:
        return "2025"
    return "未从文件名确认"


def classification_for(path: str) -> str:
    if path.endswith(".WeDrive"):
        return "E-排除首版"
    if path in CORE:
        return "A-首版核心入库"
    if path in CONDITIONAL:
        return "B-首版条件入库"
    if "测试报告" in path:
        return "C-测试证据库"
    if "漏洞扫描" in path:
        return "C-安全证据库"
    return "C-历史版本库"


def use_and_risk(path: str, classification: str) -> tuple[str, str]:
    name = Path(path).name
    if classification == "E-排除首版":
        return "系统或网盘元数据，不含产品知识", "禁止入库"
    if path in CORE:
        if "260716" in name:
            return (
                "LLMOps 3.0 五大产品域、Agent Engineering、售卖场景和组合边界",
                "内部资料；竞品表述和性能口径不得直接对客输出",
            )
        if "AgentGo" in name:
            return (
                "Agent Go、AgentBox、Vibe Coding 与 Harness Engineering 能力",
                "外部统计、代码率和唯一性等宣传数字不作为通用承诺",
            )
        if "TokenFactory" in name:
            return (
                "TokenFactory 模型服务、路由、计量、效能和算力运营能力",
                "性能提升数字依赖测试环境，回答时必须带条件或不展示",
            )
        if "大模型时代" in name:
            return (
                "LLMOps 3.0 产品结构、模型、知识、Agent 和企业级能力总览",
                "与专项资料冲突时以更具体且更新的当前版资料为准",
            )
        return (
            "AI 工作单元、资产治理、发布门禁、运营闭环和 90 天落地路径",
            "部分内容属于方法论或目标架构，具体已交付功能需按版本确认",
        )
    if name.endswith(".mp4"):
        return (
            "发布会录屏，用于人工复核当前版讲解",
            "约 69.3 分钟；未形成经复核转写前不能单独支撑结论",
        )
    if name == "LLMOps技术架构图.pptx":
        return (
            "客户明确询问对应版本架构时条件检索",
            "同一文件混有 V2.0、V1.4、V1.3 和历史备份，必须先确认版本",
        )
    if "1.4.3" in name:
        return (
            "旧版详细功能或操作追问的技术参考",
            "仅证明 v1.4.3 能力，不能据此承诺 LLMOps 3.0 当前能力",
        )
    if name.endswith(".png"):
        return (
            "定位在线帮助文档入口",
            "截图不含产品功能事实，也未提供可直接引用的网址",
        )
    if classification == "C-测试证据库":
        return (
            "对应旧版本的测试范围、用例和缺陷追溯",
            "含内部测试与环境信息；不参与普通售前推荐，不上传原文件",
        )
    if classification == "C-安全证据库":
        return (
            "旧版本漏洞扫描举证",
            "只在安全审计问题中按版本使用，不能代表当前版本安全状态",
        )
    if "大模型工具平台对比" in name:
        return (
            "历史竞品研究线索",
            "时效性和营销偏差风险高；必须单独受控，不进入默认回答",
        )
    if "场景案例" in name or "总体方案" in name:
        return (
            "历史场景和案例线索，用于设计测试问题",
            "不能单独证明当前版本能力或客户效果",
        )
    return (
        "历史版本追溯和术语对照",
        "旧名称、旧版本或规划项不得覆盖 LLMOps 3.0 当前口径",
    )


def adjusted_status(path: str, source_status: str) -> str:
    if path.endswith("LLMOPS-1.3.2测试报告.xlsx"):
        return "verified_with_raw_ooxml"
    if path.endswith("LLMOPS-1.3.2漏洞扫描结果.xlsx") or path.endswith(
        "LLMops-1.3.3测试报告.xlsx"
    ):
        return "verified_with_artifact_tool"
    if path.endswith(".png"):
        return "visual_checked"
    if path.endswith(".mp4"):
        return "metadata_and_thumbnail_checked"
    if path.endswith(".WeDrive"):
        return "metadata_only"
    return source_status


def units_for(path: str, item: dict) -> str:
    if path.endswith(".mp4"):
        return "69.3 minutes"
    if path.endswith(".png"):
        return "1 image"
    if path.endswith("LLMOPS-1.3.2测试报告.xlsx"):
        return "5 sheets"
    if path.endswith("LLMOPS-1.3.2漏洞扫描结果.xlsx"):
        return "2 sheets"
    if path.endswith("LLMops-1.3.3测试报告.xlsx"):
        return "5 sheets"
    units = item.get("units")
    label = item.get("unit_label")
    return f"{units} {label}" if units and label else ""


def main() -> None:
    items = json.loads(INDEX.read_text(encoding="utf-8"))
    fieldnames = [
        "relative_path",
        "extension",
        "size_mb",
        "pages_or_slides",
        "version_or_period",
        "modified_at",
        "classification",
        "recommended_use",
        "risk_or_action",
        "extraction_status",
        "extracted_chars",
        "sha256",
    ]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        for item in items:
            path = item["relative_path"]
            classification = classification_for(path)
            recommended_use, risk = use_and_risk(path, classification)
            writer.writerow(
                {
                    "relative_path": path,
                    "extension": item.get("extension") or "[no-extension]",
                    "size_mb": f"{item['size_bytes'] / 1024 / 1024:.2f}",
                    "pages_or_slides": units_for(path, item),
                    "version_or_period": version_for(path),
                    "modified_at": item["modified_at"],
                    "classification": classification,
                    "recommended_use": recommended_use,
                    "risk_or_action": risk,
                    "extraction_status": adjusted_status(path, item["status"]),
                    "extracted_chars": item.get("text_chars", ""),
                    "sha256": item["sha256"],
                }
            )


if __name__ == "__main__":
    main()
