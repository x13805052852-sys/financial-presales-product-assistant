import csv
import re
import unittest
import zipfile
from xml.etree import ElementTree
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
            "docs/LLMOPS_SOURCE_ASSESSMENT.md",
            "docs/LLMOPS_KNOWLEDGE_TODO.md",
            "docs/LLMOPS_WECOM_UAT_20.md",
            "outputs/01a055c9-e0ea-79e0-948f-e234d5a08655/LLMOps_售前问题测试集.xlsx",
            "docs/PROGRESS_STATUS_2026-09-03.md",
            "docs/CROSS_PRODUCT_SOURCE_ASSESSMENT.md",
            "docs/TDH_SOURCE_INVENTORY.csv",
            "docs/LLMOPS_SOURCE_INVENTORY.csv",
            "docs/knowledge/TDH_PRODUCT_ALIASES.csv",
            "docs/knowledge/TDH_CAPABILITY_PRODUCT_MAPPING.csv",
            "docs/knowledge/TDH_SYNTHETIC_TEST_QUESTIONS_100.csv",
            "docs/knowledge/LLMOPS_PRODUCT_ALIASES.csv",
            "docs/knowledge/LLMOPS_CAPABILITY_PRODUCT_MAPPING.csv",
            "docs/knowledge/LLMOPS_COMBINATION_MAPPING.csv",
            "docs/knowledge/LLMOPS_SYNTHETIC_TEST_QUESTIONS_100.csv",
            "docs/knowledge/LLMOPS_CONTEXT_TWO_TURN_TEST_QUESTIONS_100.csv",
            "docs/knowledge/CROSS_PRODUCT_COMBINATION_MAPPING.csv",
            "docs/knowledge/CROSS_PRODUCT_SYNTHETIC_TEST_QUESTIONS_100.csv",
            "docs/knowledge/CONTEXT_TWO_TURN_TEST_QUESTIONS_100.csv",
            "docs/superpowers/specs/2026-08-31-financial-presales-product-assistant-design.md",
            "docs/superpowers/specs/2026-08-31-tdh-synthetic-sales-questions-design.md",
            "docs/superpowers/specs/2026-09-01-cross-product-combination-question-set-design.md",
            "docs/superpowers/specs/2026-09-01-concise-answer-framework-design.md",
            "docs/superpowers/specs/2026-09-03-llmops-knowledge-preparation-design.md",
            "docs/superpowers/plans/2026-09-03-llmops-knowledge-preparation-implementation-plan.md",
            "docs/templates/source_manifest.csv",
            "docs/templates/capability_product_mapping.csv",
            "docs/templates/acceptance_questions.csv",
            ".githooks/pre-push",
            "scripts/setup_git_hooks.sh",
            "scripts/build_cross_product_question_set.mjs",
            "scripts/build_llmops_inventory.py",
            "scripts/build_llmops_knowledge.py",
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

    def test_llmops_wecom_uat_has_20_unique_rounds(self):
        uat = (ROOT / "docs/LLMOPS_WECOM_UAT_20.md").read_text(encoding="utf-8")
        rounds = re.findall(r"^\| (\d{1,2}) \|", uat, flags=re.MULTILINE)
        self.assertEqual([str(number) for number in range(1, 21)], rounds)
        self.assertIn("不低于 90%", uat)
        self.assertIn("同群、同用户、间隔小于 30 分钟", uat)
        self.assertIn("安全拒绝", uat)

    def test_llmops_question_workbook_has_expected_sheets_and_ranges(self):
        path = ROOT / "outputs/01a055c9-e0ea-79e0-948f-e234d5a08655/LLMOps_售前问题测试集.xlsx"
        namespace = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        with zipfile.ZipFile(path) as workbook:
            root = ElementTree.fromstring(workbook.read("xl/workbook.xml"))
            sheets = root.find("x:sheets", namespace)
            names = [sheet.attrib["name"] for sheet in sheets]
            self.assertEqual(
                [
                    "100条单轮问题",
                    "100组双轮上下文",
                    "20轮企微验收",
                    "LLMOps功能映射",
                    "LLMOps组合映射",
                    "产品及组件别名",
                    "分类统计",
                    "使用说明",
                ],
                names,
            )
            expected_shapes = [
                (101, "X"),
                (101, "X"),
                (21, "R"),
                (35, "J"),
                (16, "O"),
                (25, "I"),
                (30, "H"),
                (20, "B"),
            ]
            actual_shapes = []
            for number, (_, last_column) in enumerate(expected_shapes, start=1):
                sheet_xml = workbook.read(f"xl/worksheets/sheet{number}.xml")
                sheet_root = ElementTree.fromstring(sheet_xml)
                rows = sheet_root.findall("x:sheetData/x:row", namespace)
                cells = sheet_root.findall("x:sheetData/x:row/x:c", namespace)
                self.assertIn(f"{last_column}1", {cell.attrib["r"] for cell in cells})
                actual_shapes.append((max(int(row.attrib["r"]) for row in rows), last_column))
            self.assertEqual(expected_shapes, actual_shapes)
            self.assertIn(b"dataValidations", workbook.read("xl/worksheets/sheet3.xml"))

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

    def test_llmops_source_inventory_is_complete_and_classified(self):
        inventory = ROOT / "docs/LLMOPS_SOURCE_INVENTORY.csv"
        with inventory.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        self.assertEqual(36, len(rows))
        self.assertEqual(36, len({row["relative_path"] for row in rows}))
        self.assertEqual(
            28,
            sum(row["extension"] != "[no-extension]" for row in rows),
        )
        expected_counts = {
            "A-首版核心入库": 5,
            "B-首版条件入库": 4,
            "C-历史版本库": 16,
            "C-测试证据库": 2,
            "C-安全证据库": 1,
            "E-排除首版": 8,
        }
        actual_counts = {
            category: sum(row["classification"] == category for row in rows)
            for category in expected_counts
        }
        self.assertEqual(expected_counts, actual_counts)
        for number, row in enumerate(rows, start=2):
            self.assertRegex(row["sha256"], r"^[0-9a-f]{64}$")
            self.assertTrue(row["version_or_period"], f"Missing version at row {number}")
            self.assertTrue(row["recommended_use"], f"Missing use at row {number}")
            self.assertTrue(row["risk_or_action"], f"Missing risk at row {number}")
            self.assertTrue(row["extraction_status"], f"Missing status at row {number}")

    def test_llmops_product_aliases_are_unique_and_auditable(self):
        path = ROOT / "docs/knowledge/LLMOPS_PRODUCT_ALIASES.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        self.assertEqual(24, len(rows))
        canonical_names = [row["标准名称"].strip() for row in rows]
        self.assertEqual(24, len(set(canonical_names)))
        for number, row in enumerate(rows, start=2):
            self.assertTrue(row["实体类型"].strip(), f"Missing entity type at row {number}")
            self.assertTrue(row["首版使用规则"].strip(), f"Missing rule at row {number}")
            self.assertIn("#", row["资料来源"], f"Missing source locator at row {number}")
            self.assertEqual("待产品专家确认", row["确认状态"])

    def test_llmops_capability_mapping_has_complete_evidence(self):
        path = ROOT / "docs/knowledge/LLMOPS_CAPABILITY_PRODUCT_MAPPING.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        self.assertEqual(34, len(rows))
        self.assertEqual(34, len({row["标准功能"] for row in rows}))
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

    def test_llmops_combination_mapping_is_complete_and_auditable(self):
        path = ROOT / "docs/knowledge/LLMOPS_COMBINATION_MAPPING.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        self.assertEqual(15, len(rows))
        self.assertEqual(
            [f"LLM-M{number:03d}" for number in range(1, 16)],
            [row["映射编号"] for row in rows],
        )
        required_fields = [
            "销售复合需求",
            "能力拆分",
            "主推组合",
            "产品分工",
            "可选组合",
            "适用条件",
            "必须追问",
            "排除条件",
            "资料来源",
            "资料冲突",
            "推荐置信度",
            "审核状态",
        ]
        for number, row in enumerate(rows, start=2):
            for field in required_fields:
                self.assertTrue(row[field].strip(), f"Missing {field} at row {number}")
            self.assertIn("#", row["资料来源"], f"Missing source locator at row {number}")
            self.assertIn("：", row["产品分工"])
            self.assertIn(row["资料冲突"], {"有", "无"})
            self.assertIn(row["推荐置信度"], {"高", "中", "低"})
            self.assertEqual("待产品专家确认", row["审核状态"])
            if row["资料冲突"] == "有":
                self.assertNotEqual("高", row["推荐置信度"])

    def test_llmops_synthetic_question_set_covers_every_mapping(self):
        questions_path = ROOT / "docs/knowledge/LLMOPS_SYNTHETIC_TEST_QUESTIONS_100.csv"
        with questions_path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        self.assertEqual(100, len(rows))
        self.assertEqual(
            [f"LLM-Q{number:03d}" for number in range(1, 101)],
            [row["编号"] for row in rows],
        )
        self.assertEqual(100, len({row["模拟销售提问"] for row in rows}))
        with (
            ROOT / "docs/knowledge/LLMOPS_CAPABILITY_PRODUCT_MAPPING.csv"
        ).open(encoding="utf-8-sig", newline="") as handle:
            known_mappings = {row["标准功能"] for row in csv.DictReader(handle)}
        covered_mappings = {
            row["对应映射"]
            for row in rows
            if row["对应映射"] != "安全边界（无产品映射）"
        }
        self.assertEqual(known_mappings, covered_mappings)
        allowed_actions = {
            "直接推荐",
            "推荐并说明边界",
            "先追问再推荐",
            "拒绝确定性承诺",
        }
        for number, row in enumerate(rows, start=2):
            self.assertEqual("模拟问题", row["数据性质"])
            self.assertIn(row["预期动作"], allowed_actions)
            self.assertIn("#", row["资料来源"], f"Missing source locator at row {number}")
            self.assertEqual("待产品专家确认", row["审核状态"])
            if row["预期动作"] == "先追问再推荐":
                self.assertEqual("待补充信息", row["预期主推产品"])
                self.assertNotEqual("无", row["缺失信息"])
                self.assertNotEqual("无", row["必须追问"])

    def test_llmops_context_question_set_is_balanced(self):
        path = ROOT / "docs/knowledge/LLMOPS_CONTEXT_TWO_TURN_TEST_QUESTIONS_100.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        self.assertEqual(100, len(rows))
        self.assertEqual(
            [f"LLM-CTX-Q{number:03d}" for number in range(1, 101)],
            [row["编号"] for row in rows],
        )
        self.assertEqual(
            {"正常追问": 40, "同人换题": 30, "跨用户": 15, "边界与引用": 15},
            {
                category: sum(row["类别"] == category for row in rows)
                for category in ["正常追问", "同人换题", "跨用户", "边界与引用"]
            },
        )
        self.assertEqual(50, sum(row["期望是否继承"] == "是" for row in rows))
        self.assertEqual(50, sum(row["期望是否继承"] == "否" for row in rows))
        for row in rows:
            self.assertIn(row["是否引用"], {"是", "否"})
            self.assertIn(row["期望是否继承"], {"是", "否"})
            self.assertEqual("待产品专家确认", row["审核状态"])

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

    def test_tdh_synthetic_question_set_is_balanced_and_auditable(self):
        path = ROOT / "docs/knowledge/TDH_SYNTHETIC_TEST_QUESTIONS_100.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        self.assertEqual(100, len(rows))
        self.assertEqual(
            [f"TDH-Q{number:03d}" for number in range(1, 101)],
            [row["编号"] for row in rows],
        )
        self.assertEqual(100, len({row["模拟销售提问"] for row in rows}))

        expected_categories = {
            "产品版本与场景选型": 22,
            "实时性、性能与时效": 14,
            "国产化迁移与替代": 14,
            "TDH、ArgoDB、TDC 产品边界": 12,
            "组件及多模型能力": 16,
            "老客户升级、EOS 与混部": 8,
            "信息不足、需要追问": 8,
            "错误前提、越界及安全问题": 6,
        }
        actual_categories = {
            category: sum(row["一级分类"] == category for row in rows)
            for category in expected_categories
        }
        self.assertEqual(expected_categories, actual_categories)

        expected_difficulties = {"简单": 40, "中等": 40, "困难": 20}
        actual_difficulties = {
            difficulty: sum(row["难度"] == difficulty for row in rows)
            for difficulty in expected_difficulties
        }
        self.assertEqual(expected_difficulties, actual_difficulties)

        with (
            ROOT / "docs/knowledge/TDH_CAPABILITY_PRODUCT_MAPPING.csv"
        ).open(encoding="utf-8-sig", newline="") as handle:
            known_mappings = {
                row["标准功能"] for row in csv.DictReader(handle)
            }
        covered_mappings = set()
        for row in rows:
            row_mappings = {
                value.strip()
                for value in row["对应映射"].split("；")
                if value.strip() != "安全边界（无产品映射）"
            }
            self.assertFalse(
                row_mappings - known_mappings,
                f"Unknown mappings at {row['编号']}: {row_mappings - known_mappings}",
            )
            covered_mappings.update(row_mappings)
        self.assertEqual(known_mappings, covered_mappings)

        allowed_actions = {
            "直接推荐",
            "推荐并给可选方案",
            "先追问再推荐",
            "纠正错误前提",
            "拒绝确定性承诺",
        }
        required_fields = [
            "编号",
            "数据性质",
            "一级分类",
            "二级场景",
            "难度",
            "问题类型",
            "模拟销售提问",
            "已知条件",
            "缺失信息",
            "预期动作",
            "预期主推产品",
            "预期可选产品",
            "预期答案要点",
            "必须追问",
            "资料来源",
            "对应映射",
            "审核状态",
        ]
        for number, row in enumerate(rows, start=2):
            for field in required_fields:
                self.assertTrue(row[field].strip(), f"Missing {field} at row {number}")
            self.assertEqual("模拟问题", row["数据性质"])
            self.assertEqual("待产品专家确认", row["审核状态"])
            self.assertIn(row["预期动作"], allowed_actions)
            self.assertIn("#", row["资料来源"], f"Missing source locator at row {number}")
            if row["预期动作"] == "先追问再推荐":
                self.assertEqual("待补充信息", row["预期主推产品"])
                self.assertNotEqual("无", row["缺失信息"])
                self.assertNotEqual("无", row["必须追问"])

    def test_cross_product_mapping_is_complete_and_auditable(self):
        path = ROOT / "docs/knowledge/CROSS_PRODUCT_COMBINATION_MAPPING.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        self.assertEqual(40, len(rows))
        self.assertEqual(
            [f"CP-M{number:03d}" for number in range(1, 41)],
            [row["映射编号"] for row in rows],
        )
        self.assertEqual(40, len({row["销售复合需求"] for row in rows}))

        required_fields = [
            "映射编号",
            "销售复合需求",
            "能力拆分",
            "主推组合",
            "产品分工",
            "可选组合",
            "适用条件",
            "必须追问",
            "排除条件",
            "资料来源",
            "资料冲突",
            "推荐置信度",
            "产品专家",
            "审核状态",
        ]
        for number, row in enumerate(rows, start=2):
            for field in required_fields:
                self.assertTrue(row[field].strip(), f"Missing {field} at row {number}")
            self.assertIn("#", row["资料来源"], f"Missing source locator at row {number}")
            self.assertIn(row["资料冲突"], {"有", "无"})
            self.assertIn(row["推荐置信度"], {"高", "中", "低"})
            self.assertIn("：", row["产品分工"])
            self.assertEqual("待产品专家确认", row["审核状态"])
            if row["资料冲突"] == "有":
                self.assertNotEqual("高", row["推荐置信度"])

    def test_context_two_turn_question_set_is_balanced(self):
        path = ROOT / "docs/knowledge/CONTEXT_TWO_TURN_TEST_QUESTIONS_100.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        self.assertEqual(100, len(rows))
        self.assertEqual(
            [f"CTX-Q{number:03d}" for number in range(1, 101)],
            [row["编号"] for row in rows],
        )
        self.assertEqual(
            {
                "正常追问": 40,
                "同人换题": 30,
                "跨用户": 15,
                "边界与引用": 15,
            },
            {
                category: sum(row["类别"] == category for row in rows)
                for category in ["正常追问", "同人换题", "跨用户", "边界与引用"]
            },
        )
        self.assertEqual(50, sum(row["期望是否继承"] == "是" for row in rows))
        self.assertEqual(50, sum(row["期望是否继承"] == "否" for row in rows))
        required_fields = [
            "编号",
            "类别",
            "群聊ID",
            "上一轮用户ID",
            "当前用户ID",
            "上一问",
            "上一轮主题",
            "上一轮产品",
            "当前问",
            "是否引用",
            "期望是否继承",
            "期望补全关键词",
            "期望核心产品",
            "风险标签",
            "审核状态",
        ]
        for number, row in enumerate(rows, start=2):
            for field in required_fields:
                self.assertTrue(row[field].strip(), f"Missing {field} at row {number}")
            self.assertIn(row["是否引用"], {"是", "否"})
            self.assertIn(row["期望是否继承"], {"是", "否"})
            self.assertEqual("待产品专家确认", row["审核状态"])

    def test_cross_product_question_set_is_balanced_and_covers_every_mapping(self):
        path = ROOT / "docs/knowledge/CROSS_PRODUCT_SYNTHETIC_TEST_QUESTIONS_100.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        self.assertEqual(100, len(rows))
        self.assertEqual(
            [f"CP-Q{number:03d}" for number in range(1, 101)],
            [row["编号"] for row in rows],
        )
        self.assertEqual(100, len({row["模拟销售提问"] for row in rows}))

        expected_categories = {
            "数据接入、开发与治理组合": 20,
            "实时湖仓/数据库与治理组合": 20,
            "五类产品边界": 15,
            "治理专业场景": 15,
            "国产替代、迁移与治理改造": 10,
            "多集群、云原生管理与治理": 5,
            "信息不足、必须追问": 10,
            "错误组合、越界及安全问题": 5,
        }
        self.assertEqual(
            expected_categories,
            {
                category: sum(row["一级分类"] == category for row in rows)
                for category in expected_categories
            },
        )
        expected_difficulties = {"简单": 30, "中等": 50, "困难": 20}
        self.assertEqual(
            expected_difficulties,
            {
                difficulty: sum(row["难度"] == difficulty for row in rows)
                for difficulty in expected_difficulties
            },
        )

        with (ROOT / "docs/knowledge/CROSS_PRODUCT_COMBINATION_MAPPING.csv").open(
            encoding="utf-8-sig", newline=""
        ) as handle:
            known_mappings = {row["映射编号"] for row in csv.DictReader(handle)}

        covered_mappings = set()
        allowed_actions = {
            "直接推荐",
            "推荐并给可选方案",
            "先追问再推荐",
            "纠正错误前提",
            "拒绝确定性承诺",
        }
        required_fields = [
            "编号",
            "数据性质",
            "一级分类",
            "难度",
            "模拟销售提问",
            "已知条件",
            "缺失信息",
            "预期动作",
            "预期主推组合",
            "产品分工",
            "预期答案要点",
            "必须追问",
            "资料来源",
            "命中组合映射",
            "分工完整性",
            "版本冲突",
            "推荐置信度",
            "产品专家",
            "审核状态",
        ]
        for number, row in enumerate(rows, start=2):
            for field in required_fields:
                self.assertTrue(row[field].strip(), f"Missing {field} at row {number}")
            self.assertEqual("模拟问题", row["数据性质"])
            self.assertEqual("待产品专家确认", row["审核状态"])
            self.assertIn(row["预期动作"], allowed_actions)
            self.assertIn("#", row["资料来源"], f"Missing source locator at row {number}")
            row_mappings = {
                value.strip()
                for value in row["命中组合映射"].split("；")
                if value.strip()
            }
            self.assertFalse(
                row_mappings - known_mappings,
                f"Unknown mappings at {row['编号']}: {row_mappings - known_mappings}",
            )
            covered_mappings.update(row_mappings)
            if row["预期动作"] == "先追问再推荐":
                self.assertEqual("待补充信息", row["预期主推组合"])
                self.assertNotEqual("无", row["缺失信息"])
                self.assertNotEqual("无", row["必须追问"])
                self.assertIn("\n需要确认：", row["预期答案要点"])
            else:
                self.assertNotIn("\n需要确认：", row["预期答案要点"])
            if row["版本冲突"] == "有":
                self.assertNotEqual("高", row["推荐置信度"])
                self.assertIn("\n风险说明：", row["预期答案要点"])

            answer = row["预期答案要点"]
            self.assertTrue(answer.startswith("结论："))
            self.assertEqual(1, answer.count("结论："))
            self.assertEqual(1, answer.count("\n推荐组合："))
            self.assertEqual(1, answer.count("\n产品分工："))
            self.assertNotIn("\n资料来源：", answer)
            self.assertNotIn("\n适用条件：", answer)

        self.assertEqual(known_mappings, covered_mappings)

        astro_realtime = next(
            row for row in rows
            if row["模拟销售提问"] == "Astro 是否能够进行实时的数据治理？"
        )
        self.assertIn("Astro 可以参与实时数据治理", astro_realtime["预期答案要点"])
        self.assertIn(
            "ArgoDB AP + TDS-SUITE-R + TDS-SUITE-D + Astro",
            astro_realtime["预期答案要点"],
        )
        self.assertIn(
            "TDH 湖仓集一体版 + TDS-SUITE-D + Astro",
            astro_realtime["预期答案要点"],
        )

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
