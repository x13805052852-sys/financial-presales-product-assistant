import csv
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class RepositoryQualityTests(unittest.TestCase):
    def test_required_project_files_exist(self):
        required = [
            "README.md",
            "CONTRIBUTING.md",
            "CONTEXT.md",
            "docs/PROJECT_EXECUTION_PLAN.md",
            "docs/TASK_TRACKER.md",
            "docs/ACCEPTANCE_CRITERIA.md",
            "docs/DATA_PREPARATION_GUIDE.md",
            "docs/TDH_SOURCE_ASSESSMENT.md",
            "docs/TDH_SOURCE_INVENTORY.csv",
            "docs/knowledge/TDH_PRODUCT_ALIASES.csv",
            "docs/knowledge/TDH_CAPABILITY_PRODUCT_MAPPING.csv",
            "docs/superpowers/specs/2026-08-31-financial-presales-product-assistant-design.md",
            "docs/templates/source_manifest.csv",
            "docs/templates/capability_product_mapping.csv",
            "docs/templates/acceptance_questions.csv",
            ".githooks/pre-push",
            "scripts/setup_git_hooks.sh",
        ]
        missing = [path for path in required if not (ROOT / path).is_file()]
        self.assertEqual([], missing, f"Missing required files: {missing}")

    def test_csv_template_headers(self):
        expected_headers = {
            "docs/templates/source_manifest.csv": [
                "文件名称",
                "产品线",
                "资料类型",
                "产品版本",
                "发布日期",
                "保密级别",
                "审核状态",
                "审核人",
                "是否进入首版",
                "备注",
            ],
            "docs/templates/capability_product_mapping.csv": [
                "客户原始需求",
                "标准功能",
                "解决方案",
                "主推产品",
                "可选产品",
                "推荐理由",
                "适用条件",
                "排除条件",
                "资料来源",
                "确认人",
            ],
            "docs/templates/acceptance_questions.csv": [
                "编号",
                "问题类型",
                "销售真实问题",
                "预期主推产品",
                "预期可选产品",
                "预期理由要点",
                "必须询问的信息",
                "资料来源",
                "产品专家",
                "测试结果",
                "问题记录",
            ],
        }
        for relative_path, expected in expected_headers.items():
            with self.subTest(path=relative_path):
                with (ROOT / relative_path).open(encoding="utf-8-sig", newline="") as handle:
                    rows = [
                        row
                        for row in csv.reader(handle)
                        if any(cell.strip() for cell in row)
                    ]
                self.assertTrue(rows, f"{relative_path} is empty")
                self.assertEqual(expected, rows[0])
                for number, row in enumerate(rows[1:], start=2):
                    self.assertEqual(
                        len(expected),
                        len(row),
                        f"{relative_path}:{number} has {len(row)} columns; expected {len(expected)}",
                    )

    def test_execution_plan_contains_53_unique_tasks(self):
        plan = (ROOT / "docs/PROJECT_EXECUTION_PLAN.md").read_text(encoding="utf-8")
        task_ids = re.findall(r"^\| (D[1-5]-\d{2}) \|", plan, flags=re.MULTILINE)
        self.assertEqual(53, len(task_ids))
        self.assertEqual(53, len(set(task_ids)))

    def test_tdh_source_inventory_is_complete_and_classified(self):
        inventory = ROOT / "docs/TDH_SOURCE_INVENTORY.csv"
        with inventory.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        self.assertEqual(145, len(rows))
        self.assertEqual(145, len({row["relative_path"] for row in rows}))
        self.assertEqual(
            115,
            sum(row["extension"] != "[no-extension]" for row in rows),
        )

        expected_counts = {
            "A-首版核心入库": 6,
            "B-首版条件入库": 6,
            "C-独立证据库": 51,
            "C-测试资料库": 1,
            "D-二期技术库": 17,
            "E-排除首版": 64,
        }
        actual_counts = {
            category: sum(row["classification"] == category for row in rows)
            for category in expected_counts
        }
        self.assertEqual(expected_counts, actual_counts)
        for row in rows:
            self.assertRegex(row["sha256"], r"^[0-9a-f]{64}$")
            self.assertEqual("ok", row["extraction_status"])

    def test_tdh_product_aliases_are_unique_and_auditable(self):
        path = ROOT / "docs/knowledge/TDH_PRODUCT_ALIASES.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        self.assertEqual(32, len(rows))
        canonical_names = [row["标准名称"].strip() for row in rows]
        self.assertEqual(32, len(set(canonical_names)))
        for number, row in enumerate(rows, start=2):
            self.assertTrue(row["实体类型"].strip(), f"Missing entity type at row {number}")
            self.assertIn("#", row["资料来源"], f"Missing source locator at row {number}")
            self.assertEqual("待产品专家确认", row["确认状态"])

    def test_tdh_capability_mapping_has_complete_evidence(self):
        path = ROOT / "docs/knowledge/TDH_CAPABILITY_PRODUCT_MAPPING.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        self.assertEqual(34, len(rows))
        required_fields = [
            "客户原始需求",
            "标准功能",
            "解决方案",
            "主推产品",
            "推荐理由",
            "适用条件",
            "排除条件",
            "资料来源",
        ]
        for number, row in enumerate(rows, start=2):
            for field in required_fields:
                self.assertTrue(row[field].strip(), f"Missing {field} at row {number}")
            self.assertIn("#", row["资料来源"], f"Missing source locator at row {number}")
            self.assertEqual("待产品专家确认", row["确认人"])

    def test_task_tracker_covers_every_plan_task(self):
        plan = (ROOT / "docs/PROJECT_EXECUTION_PLAN.md").read_text(encoding="utf-8")
        tracker = (ROOT / "docs/TASK_TRACKER.md").read_text(encoding="utf-8")
        plan_ids = set(
            re.findall(r"^\| (D[1-5]-\d{2}) \|", plan, flags=re.MULTILINE)
        )
        tracker_ids = re.findall(r"- \[[ x]\] (D[1-5]-\d{2}) ", tracker)
        self.assertEqual(53, len(tracker_ids))
        self.assertEqual(plan_ids, set(tracker_ids))

    def test_repository_does_not_contain_common_live_secrets(self):
        excluded_parts = {".git", "work", "outputs", "__pycache__"}
        patterns = {
            "GitHub token": re.compile(r"gh[opsu]_[A-Za-z0-9]{20,}"),
            "WeCom webhook": re.compile(
                r"https://qyapi\.weixin\.qq\.com/cgi-bin/webhook/send\?key=[0-9A-Za-z-]{12,}"
            ),
            "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        }
        findings = []
        for path in ROOT.rglob("*"):
            if not path.is_file() or any(part in excluded_parts for part in path.parts):
                continue
            try:
                content = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            for label, pattern in patterns.items():
                if pattern.search(content):
                    findings.append(f"{label}: {path.relative_to(ROOT)}")
        self.assertEqual([], findings, f"Potential live secrets found: {findings}")


if __name__ == "__main__":
    unittest.main()
