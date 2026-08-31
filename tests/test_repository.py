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
            "docs/PROJECT_EXECUTION_PLAN.md",
            "docs/TASK_TRACKER.md",
            "docs/ACCEPTANCE_CRITERIA.md",
            "docs/DATA_PREPARATION_GUIDE.md",
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
