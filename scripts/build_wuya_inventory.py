#!/usr/bin/env python3
"""Build the derived WUYA source inventory from the local extraction index."""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "work" / "wuya_inventory" / "inventory.json"
OFFICE_INDEX = ROOT / "work" / "wuya_inventory" / "office_content_index.json"
XLSX_INDEX = ROOT / "work" / "wuya_inventory" / "xlsx_content_index.json"
OUTPUT = ROOT / "docs" / "WUYA_SOURCE_INVENTORY.csv"

CORE = {
    "产品手册与白皮书/白皮书/问数白皮书V2.0_20250718.pdf",
    "产品手册与白皮书/白皮书/问知白皮书V2.0_20250718.pdf",
    "产品手册与白皮书/白皮书/THK白皮书V3.0(简版).pdf",
    "问数材料(1)/问数产品材料/功能清单/无涯问数事项跟踪2026_功能清单及数据库支持清单_更新至2.X.0.xlsx",
    "无涯全产品介绍（问知+问数）.pptx",
    "无涯问知功能清单与描述（引导参数）.xlsx",
    "无涯问知深度研究助手产品介绍.pptx",
    "无涯问知AI工作站产品介绍202601.pptx",
    "co-worker/Co-Worker.pptx",
}

CONDITIONAL = {
    "部署相关材料/无涯问知部署手册（infinity-2.6.0之后适用）/00用户手册-WUYA-138250339-160126-1836-1814.pdf",
    "部署相关材料/无涯问知部署手册（infinity-2.6.0之后适用）/部署服务端口使用情况V2.0.doc",
    "部署相关材料/无涯问知部署手册（infinity-2.6.0之后适用）/配置说明-WUYA-138250341-160126-1836-1816.pdf",
    "部署相关材料/无涯问知部署手册（infinity-2.6.0之后适用）/Extra deploy手册-WUYA-138252118-160126-1836-1810.pdf",
    "部署相关材料/无涯问知部署手册（infinity-2.6.0之后适用）/ModelManager部署手册-WUYA-138257806-160126-1836-1812.pdf",
    "部署相关材料/无涯问知部署手册（infinity-2.6.0之后适用）/WUYA-前端OEM配置指南-20251124.pdf",
    "部署相关材料/deepseek模型+问知部署要求.xlsx",
    "产品手册与白皮书/白皮书/TKH白皮书V2.0_20250718.pdf",
    "产品手册与白皮书/TKH User Manual V2.4.1.docx",
    "产品手册与白皮书/TKH平台产品使用手册V2.4.1.docx",
    "无涯openclaw方案/XClaw星环科技.pptx",
    "co-worker/Co-Worker-EN.pptx",
    "co-worker/Co-Worker白皮书（未转曲预览）7.13.pdf",
    "co-worker/xclaw客户端介绍0623.pptx",
}


def version_for(path: str) -> str:
    name = Path(path).name
    if "2.6.0之后适用" in path or "infinity-2.6.0" in path:
        return "Infinity 2.6.0+"
    if "260后不适用" in path:
        return "2025-06-25 / Infinity 2.6.0 后不适用"
    if "V3.0" in name:
        return "TKH V3.0"
    if "V2.7.0" in name or "2.7.0" in name:
        return "Logits 2.7.0"
    if "V2.6.0" in name or "v2.6.0" in name:
        return "无涯问知 2.6.0"
    if "V2.5" in name or "2.5.0" in name:
        return "2.5.x"
    if "V2.4.1" in name:
        return "TKH 2.4.1"
    if "V2.0" in name or "V2.0" in path:
        return "V2.0 / 2025-07-18"
    if "202601" in name:
        return "2026-01"
    if "20260630" in name:
        return "2026-06-30"
    if "0623" in name:
        return "2026-06-23"
    if "7.13" in name:
        return "2026-07-13"
    if name == "Co-Worker.pptx":
        return "2026-08-11"
    if "241223" in name:
        return "2024-12-23"
    if "2.X.0" in name:
        return "Logits 2.x（具体版本待确认）"
    return "未从文件名确认"


def category_for(path: str, is_duplicate: bool) -> str:
    if is_duplicate:
        return "D-完全重复副本"
    suffix = Path(path).suffix.lower()
    if Path(path).name in {".WeDrive", ".DS_Store"}:
        return "E-排除首版"
    if suffix == ".zip":
        return "E-敏感演示包"
    if path in CORE:
        return "A-首版核心入库"
    if path in CONDITIONAL or suffix in {".mp4", ".mov"}:
        return "B-首版条件入库"
    if "测试报告" in path:
        return "C-测试证据库"
    if "专利" in path or "认证" in path:
        return "C-认证证据库"
    return "C-历史或补充资料"


def use_and_risk(path: str, category: str) -> tuple[str, str]:
    name = Path(path).name
    if category == "D-完全重复副本":
        return "保留来源追溯，不重复入库", "与另一文件 SHA-256 完全一致"
    if category == "E-排除首版":
        return "系统或网盘元数据", "不含可用于销售问答的业务知识"
    if category == "E-敏感演示包":
        return "仅供人工演示或研发参考", "压缩包含代码、配置、提示词或示例凭证；禁止默认入库和执行"
    if category == "A-首版核心入库":
        if name == "Co-Worker.pptx":
            return "Co-Worker 当前定位、端云架构、数字员工、Skill、安全和组合边界", "内部培训材料；性能、客户效果及竞品结论不得直接承诺"
        if "THK白皮书V3.0" in name:
            return "TKH 平台、问知、问数和知识门户的当前总览", "文件名 THK 疑似 TKH 拼写错误，需产品专家确认"
        if "问知白皮书" in name:
            return "问知产品定位、知识问答、写作、助手、权限和部署形态", "公有云预置数据与私有化能力必须区分"
        if "问数白皮书" in name:
            return "问数定位、NL2SQL、分析、治理、权限和场景", "与 TDS 的组合和数据库支持需按版本确认"
        if "功能清单" in name and "问数" in name:
            return "问数 2.x 功能、版本和数据库支持的细粒度证据", "文件名版本为 2.X.0，具体可售版本需确认"
        if "功能清单" in name and "问知" in name:
            return "问知 2.6.0 当前功能、端侧支持与历史版本差异", "历史工作表只用于版本追溯，不覆盖 2.6.0 当前口径"
        if "深度研究" in name:
            return "深度研究助手的数据源、工具、权限、编排和研究场景", "效率数字和绝对化宣传不作为默认对客承诺"
        if "AI工作站" in name:
            return "AI 工作站形态、适用团队和本地化能力", "配置、并发和性能数字须以正式方案为准"
        return "无涯问知与问数总体架构、能力和场景", "发布日期不清；专项能力以更具体且更新资料为准"
    if category == "C-测试证据库":
        return "对应版本的测试范围、环境和缺陷追溯", "含内部环境信息；不参与普通售前推荐"
    if category == "C-认证证据库":
        return "对应兼容性、认证或专利问题的专项举证", "只证明文件所载范围，不能扩大为全部版本承诺"
    if "不适用" in path:
        return "历史部署方案追溯", "文件已明确标注 Infinity 2.6.0 后不适用"
    if category == "B-首版条件入库":
        if Path(path).suffix.lower() in {".mp4", ".mov"}:
            return "人工核验演示场景和操作流程", "未形成经复核转写前不能单独支撑产品承诺"
        if "XClaw" in name or "xclaw" in name or "白皮书" in name and "Co-Worker" in name:
            return "客户明确询问 XClaw/OpenClaw/Co-Worker 时用于名称和能力追溯", "XClaw 与 Co-Worker 的正式关系及当前售卖名称待确认"
        if "部署" in path or "配置" in name or "端口" in name or "OEM" in name:
            return "部署、资源、端口或 OEM 专项问题", "可能含内部架构与配置，不进入普通功能推荐"
        if "DeepSeek" in name or "deepseek" in name:
            return "DeepSeek 模型与问知组合的资源估算", "硬件要求依赖模型精度、并发和版本，需交付确认"
        if "2.4.1" in name:
            return "TKH 2.4.1 旧版菜单和操作追溯", "不能据此承诺 2.6.0 或当前版本能力"
        return "条件检索的产品补充说明", "需先确认产品、版本、部署形态和客户场景"
    if "简版" in name:
        return "快速浏览和人工培训", "与完整版内容重叠，不重复作为首版主证据"
    if "241223" in name:
        return "旧版问知能力和场景追溯", "2024 旧材料不能覆盖 2025/2026 资料"
    return "历史版本或补充背景", "不参与普通问题的默认检索"


def main() -> None:
    inventory = json.loads(INDEX.read_text(encoding="utf-8"))["rows"]
    office = {
        item["sha256"]: item
        for item in json.loads(OFFICE_INDEX.read_text(encoding="utf-8"))
    }
    xlsx = {
        item["sha256"]: item
        for item in json.loads(XLSX_INDEX.read_text(encoding="utf-8"))
    }

    canonical_by_hash: dict[str, str] = {}
    for row in inventory:
        sha = row["sha256"]
        path = row["relative_path"]
        if sha not in canonical_by_hash or path in CORE:
            canonical_by_hash[sha] = path

    fields = [
        "relative_path", "extension", "size_mb", "version_or_period", "modified_at",
        "classification", "recommended_use", "risk_or_action", "extraction_status",
        "pages_slides_or_sheets", "duplicate_of", "sha256",
    ]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for row in inventory:
            path = row["relative_path"]
            duplicate_of = canonical_by_hash[row["sha256"]]
            is_duplicate = duplicate_of != path
            category = category_for(path, is_duplicate)
            use, risk = use_and_risk(path, category)
            extracted = office.get(row["sha256"]) or xlsx.get(row["sha256"])
            status = extracted.get("status", "metadata_only") if extracted else "metadata_only"
            if row["extension"] in {"mp4", "mov"}:
                status = "metadata_checked"
            if row["extension"] == "zip":
                status = "archive_manifest_checked_not_executed"
            if extracted and "units" in extracted:
                units = f'{extracted["units"]} {"pages/slides"}'
            elif extracted and "sheets" in extracted:
                units = f'{len(extracted["sheets"])} sheets'
            else:
                units = ""
            writer.writerow({
                "relative_path": path,
                "extension": row["extension"],
                "size_mb": f'{row["size_bytes"] / 1024 / 1024:.2f}',
                "version_or_period": version_for(path).strip(),
                "modified_at": row["modified_time"],
                "classification": category,
                "recommended_use": use,
                "risk_or_action": risk,
                "extraction_status": status,
                "pages_slides_or_sheets": units,
                "duplicate_of": duplicate_of if is_duplicate else "",
                "sha256": row["sha256"],
            })


if __name__ == "__main__":
    main()
