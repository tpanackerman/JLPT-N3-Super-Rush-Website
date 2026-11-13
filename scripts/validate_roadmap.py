#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
STAGE 1 — Validator for extracted roadmap JSON files against the original Markdown.
Produces src/data/validation_report.json and prints a summary.
"""
import json
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = APP_ROOT.parent / "Lộ trình ôn JLPT N3 cấp tốc 25 ngày (10_11 - 04_12).md"
DATA_DIR = APP_ROOT / "src" / "data"


def main():
    raw_lines = SOURCE_PATH.read_text(encoding="utf-8").splitlines()
    roadmap = json.loads((DATA_DIR / "roadmap.json").read_text(encoding="utf-8"))
    vocab = json.loads((DATA_DIR / "vocabulary.json").read_text(encoding="utf-8"))
    grammar = json.loads((DATA_DIR / "grammar.json").read_text(encoding="utf-8"))
    kanji = json.loads((DATA_DIR / "kanji.json").read_text(encoding="utf-8"))
    reading = json.loads((DATA_DIR / "reading_tasks.json").read_text(encoding="utf-8"))
    listening = json.loads((DATA_DIR / "listening_tasks.json").read_text(encoding="utf-8"))
    mocks = json.loads((DATA_DIR / "mock_tests.json").read_text(encoding="utf-8"))
    issues = json.loads((DATA_DIR / "extraction_issues.json").read_text(encoding="utf-8"))

    checks = []

    def check(name, passed, detail):
        checks.append({"name": name, "passed": bool(passed), "detail": detail})

    # 1. 25 days represented
    days = roadmap["days"]
    check("25_days_present", len(days) == 25 and [d["dayNumber"] for d in days] == list(range(1, 26)),
          f"{len(days)} days (1..25)")

    # 2. 3 phases
    phases = roadmap["phases"]
    check("3_phases_present",
          len(phases) == 3 and [(p["phase"], p["startDay"], p["endDay"]) for p in phases] == [(1, 1, 8), (2, 9, 18), (3, 19, 25)],
          f"Phases: {[(p['phase'], p['startDate'], p['endDate']) for p in phases]}")

    # 3. Every content line in Section II is covered by day header/note or at least 1 task
    sec2_start = next(i + 1 for i, l in enumerate(raw_lines) if l.startswith("## II."))
    covered = set()
    for p in phases:
        covered.add(p["headerLine"])
        covered.add(p["objectiveLine"])
    for d in days:
        covered.add(d["headerLine"])
        covered.update(d.get("noteLines", []))
        for t in d["tasks"]:
            covered.update(t["sourceLines"])
    uncovered = []
    for ln in range(sec2_start + 1, len(raw_lines) + 1):
        txt = raw_lines[ln - 1].strip()
        if txt in ("", "---"):
            continue
        if ln not in covered:
            uncovered.append((ln, txt[:80]))
    check("section_ii_100pct_line_coverage", len(uncovered) == 0,
          f"Uncovered lines in Section II: {len(uncovered)}" + (f" -> {uncovered[:5]}" if uncovered else ""))

    # 4. Every task's originalText matches exact source lines
    mismatched_text = []
    for d in days:
        for t in d["tasks"]:
            expected = "\n".join(raw_lines[n - 1] for n in t["sourceLines"])
            if t["originalText"] != expected:
                mismatched_text.append(t["id"])
    check("verbatim_original_text_match", len(mismatched_text) == 0,
          f"Tasks verified verbatim against source lines: {sum(len(d['tasks']) for d in days)}, mismatches: {len(mismatched_text)}")

    # 5. Stable unique task IDs
    all_task_ids = [t["id"] for d in days for t in d["tasks"]]
    check("unique_task_ids", len(all_task_ids) == len(set(all_task_ids)),
          f"Total tasks: {len(all_task_ids)}, unique: {len(set(all_task_ids))}")

    # 6. Vocabulary range 1..880 continuous across 10 units
    va = sorted(vocab["dailyAssignments"], key=lambda x: x["start"])
    contiguous_v = all(va[i]["end"] + 1 == va[i + 1]["start"] for i in range(len(va) - 1)) and va[0]["start"] == 1 and va[-1]["end"] == 880
    check("vocabulary_range_1_to_880", contiguous_v and len(vocab["units"]) == 10,
          f"Units={len(vocab['units'])}, range={va[0]['start']}..{va[-1]['end']}, listed items={len(vocab['items'])}, synonyms={len(vocab['synonymPairs'])}, polysemous={len(vocab['polysemousVerbs'])}")

    # 7. Grammar range 1..112 continuous across 9 units
    gs = [s for u in grammar["units"] for s in u["sessions"]]
    gs.sort(key=lambda x: x["start"])
    contiguous_g = all(gs[i]["end"] + 1 == gs[i + 1]["start"] for i in range(len(gs) - 1)) and gs[0]["start"] == 1 and gs[-1]["end"] == 112
    check("grammar_range_1_to_112", contiguous_g and len(grammar["units"]) == 9,
          f"Units={len(grammar['units'])}, range={gs[0]['start']}..{gs[-1]['end']}, listed patterns={len(grammar['patterns'])}, confusingPairs={len(grammar['confusingPairs'])}")

    # 8. Kanji 6 weeks x 6 lessons = 36 lessons + 6 weekly tests
    lessons = [l for w in kanji["weeks"] for l in w["lessons"]]
    tests = [w["test"] for w in kanji["weeks"] if w["test"]]
    check("kanji_36_lessons_6_weeks", len(kanji["weeks"]) == 6 and len(lessons) == 36 and len(tests) == 6,
          f"Weeks={len(kanji['weeks'])}, lessons={len(lessons)}, weeklyTests={len(tests)}, words={len(kanji['words'])}, homophoneGroups={len(kanji['homophoneGroups'])}")

    # 9. Reading Speed Master exercises 1..45 + 2 mocks + Shinkanzen Parts 1 & 2
    sm_nums = sorted(c["number"] for c in reading["speedMasterCatalog"] if c["type"] != "warmup")
    check("reading_assignments_complete",
          sm_nums == list(range(1, 46)) and len(reading["strategies"]) >= 15,
          f"Assignments={len(reading['assignments'])}, SpeedMaster 1..45={sm_nums == list(range(1, 46))}, strategies={len(reading['strategies'])}")

    # 10. Listening assignments and 4 full mock exams on exact dates
    full_dates = [(m["number"], m["dayNumber"], m["date"]) for m in mocks["fullMocks"]]
    expected_mocks = [(1, 19, "2026-11-28"), (2, 21, "2026-11-30"), (3, 23, "2026-12-02"), (4, 24, "2026-12-03")]
    check("four_full_mocks_exact_dates", full_dates == expected_mocks, f"Full mocks: {full_dates}")

    report = {
        "schemaVersion": "1.0.0",
        "allPassed": all(c["passed"] for c in checks),
        "checks": checks,
        "counts": {
            "days": len(days),
            "tasks": len(all_task_ids),
            "vocabularyListed": len(vocab["items"]),
            "vocabularyTarget": vocab["totalItems"],
            "grammarListed": len(grammar["patterns"]),
            "grammarTarget": grammar["totalPatterns"],
            "kanjiLessons": len(lessons),
            "kanjiWordsListed": len(kanji["words"]),
            "kanjiTarget": kanji["totalKanji"],
            "readingAssignments": len(reading["assignments"]),
            "readingStrategies": len(reading["strategies"]),
            "listeningAssignments": len(listening["assignments"]),
            "fullMockExams": len(mocks["fullMocks"]),
            "flaggedIssues": issues["bySeverity"],
        },
    }
    (DATA_DIR / "validation_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for c in checks:
        print(f"[{'PASS' if c['passed'] else 'FAIL'}] {c['name']}: {c['detail']}")
    return 0 if report["allPassed"] else 1


if __name__ == "__main__":
    sys.exit(main())
