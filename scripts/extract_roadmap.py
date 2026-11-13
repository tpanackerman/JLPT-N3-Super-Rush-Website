#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
STAGE 1 — Roadmap extractor for the personal JLPT N3 25-day platform.

Reads the ORIGINAL roadmap Markdown (single source of truth) and produces the
structured data files consumed by the web app:

    src/data/roadmap.json
    src/data/vocabulary.json
    src/data/grammar.json
    src/data/kanji.json
    src/data/reading_tasks.json
    src/data/listening_tasks.json
    src/data/mock_tests.json
    src/data/extraction_issues.json

Principles (see master prompt, Part 2):
  * All descriptive text is copied verbatim from the source (`originalText`).
  * Metadata (page ranges, item ranges, pattern ranges, time guidance, targets)
    is extracted by regex from the task's OWN source lines — never typed in by
    hand — so it cannot be fabricated. validate_roadmap.py re-checks this.
  * Fields the source does not provide are left null and reported.
  * Ambiguities / inconsistencies are recorded in extraction_issues.json and are
    NOT silently corrected.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent.parent
SOURCE_NAME = "Lộ trình ôn JLPT N3 cấp tốc 25 ngày (10_11 - 04_12).md"
SOURCE_PATH = APP_ROOT.parent / SOURCE_NAME
OUT_DIR = APP_ROOT / "src" / "data"

SCHEMA_VERSION = "1.0.0"
YEAR = 2026
EXAM_DATE = date(2026, 12, 5)

WEEKDAY_VI = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]
WEEKDAY_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

TEXTBOOKS = {
    "mimi_goi": {"id": "mimi_goi", "titleJa": "耳から覚える日本語能力試験 N3 語彙トレーニング",
                 "titleRomaji": "Mimi kara Oboeru N3 Goi", "skill": "vocabulary"},
    "mimi_bunpou": {"id": "mimi_bunpou", "titleJa": "耳から覚える日本語能力試験 N3 文法トレーニング",
                    "titleRomaji": "Mimi kara Oboeru N3 Bunpou", "skill": "grammar"},
    "soumatome_kanji": {"id": "soumatome_kanji", "titleJa": "日本語総まとめ N3 漢字",
                        "titleRomaji": "Nihongo Soumatome N3 Kanji", "skill": "kanji"},
    "shinkanzen_dokkai": {"id": "shinkanzen_dokkai", "titleJa": "新完全マスター N3 読解",
                          "titleRomaji": "Shinkanzen Master N3 Dokkai", "skill": "reading"},
    "speed_dokkai": {"id": "speed_dokkai", "titleJa": "スピードマスター N3 読解",
                     "titleRomaji": "Speed Master N3 Dokkai", "skill": "reading"},
    "mimi_choukai": {"id": "mimi_choukai", "titleJa": "耳から覚える N3 聴解",
                     "titleRomaji": "Mimi kara Oboeru N3 Choukai", "skill": "listening"},
    # The source never gives a Japanese title for this book -> left null on purpose.
    "speed_choukai": {"id": "speed_choukai", "titleJa": None,
                      "titleRomaji": "Speed Master N3 Choukai", "skill": "listening"},
    "jlpt_past_papers": {"id": "jlpt_past_papers", "titleJa": None,
                         "titleRomaji": "Đề thi thật JLPT N3 (user-provided)", "skill": "mixed"},
}

BOOK_PATTERNS = [
    (r"Mimi kara Oboeru N3 Goi|Mimi kara Goi", "mimi_goi"),
    (r"Mimi kara Oboeru N3 Bunpou|Mimi kara Bunpou|Mimi kara N3\b", "mimi_bunpou"),
    (r"Mimi kara Oboeru N3 Choukai|Mimi kara Choukai", "mimi_choukai"),
    (r"Soumatome", "soumatome_kanji"),
    (r"Shinkanzen", "shinkanzen_dokkai"),
    (r"Speed Master N3 Dokkai|Speed Master Dokkai", "speed_dokkai"),
    (r"Speed Master N3 Choukai", "speed_choukai"),
    (r"Đề thi thật JLPT", "jlpt_past_papers"),
]
BOOK_PREFIXES = ["Mimi kara Oboeru N3 Goi", "Mimi kara Oboeru N3 Bunpou", "Mimi kara Oboeru N3 Choukai",
                 "Soumatome N3 Kanji", "Shinkanzen Master N3 Dokkai", "Speed Master N3 Dokkai",
                 "Speed Master N3 Choukai"]

PHASE_RE = re.compile(r"^### GIAI ĐOẠN (\d+): (.+?) \((\d{2})/(\d{2}) – (\d{2})/(\d{2}) \| NGÀY (\d+) – NGÀY (\d+)\)\s*$")
DAY_RE = re.compile(r"^#### 📅 NGÀY (\d+) — ([^,]+), (\d{2})/(\d{2}): (.+?)\s*$")
BULLET_RE = re.compile(r"^(\s*)(?:-|\d+\.)\s+(.*)$")
SECTION_RE = re.compile(r"^\*\*(\d+)\.\s+(.*)\*\*:\s*$")
LABEL_RE = re.compile(r"^\*\*(.+?)\*\*:\s*(.*)$")
KANA_RE = re.compile(r"^[\u3040-\u309f\u30a0-\u30ff～〜・ー\s]+$")
HANGUL_RE = re.compile(r"[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]")
CJK_RE = re.compile(r"[\u4e00-\u9fff]")
KANJI_LESSON_RE = re.compile(r"^\*\*Bài (\d+)(?: & (\d+))? \((.+) - trang (\d+)–(\d+)\)\*\*:\s*(.*)$")
KANJI_TEST_RE = re.compile(r"^\*Làm bài Test Tuần (\d+) \(trang (\d+)–(\d+)\)\*\.?\s*$")
GRAMMAR_EX_RE = re.compile(r"^\*Làm bài tập tổng hợp Unit (\d+) \(trang (\d+)–(\d+)\)\*\.?\s*$")
TIME_RE = re.compile(r"(?:tối đa\s+)?\d+(?:\.\d+)?(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*(?:phút|giây)(?:/(?:bài|đề))?")
TARGET_RE = re.compile(r"(?:Làm|Luyện|luyện)\s+(?:trọn vẹn\s+)?(\d+)\s+(câu|bài)")

LINES: list[str] = []
ISSUES: list[dict] = []


# --------------------------------------------------------------------------- helpers
def L(n: int) -> str:
    return LINES[n - 1]


def find_line(marker: str, start: int = 1) -> int:
    for i in range(start - 1, len(LINES)):
        if marker in LINES[i]:
            return i + 1
    raise KeyError(f"marker not found in source: {marker!r}")


def clean(s: str, keep_indent: bool = False) -> str:
    s = re.sub(r"\$\\rightarrow\$", "→", s)
    s = re.sub(r"\$\\ge\s*([^$]*)\$", r"≥ \1", s)
    s = s.replace("**", "").replace("*", "")
    return s.rstrip() if keep_indent else s.strip()


def issue(code, severity, category, message, *, lines=None, day=None, task_ids=None,
          suggestion=None, evidence=None):
    lines = sorted(set(lines or []))
    ISSUES.append({
        "id": f"ISSUE-{len(ISSUES) + 1:03d}",
        "code": code,
        "severity": severity,          # error | warning | info
        "category": category,
        "message": message,
        "dayNumber": day,
        "sourceLines": lines,
        "evidence": evidence if evidence is not None else [L(n).strip()[:400] for n in lines[:4]],
        "taskIds": task_ids or [],
        "suggestion": suggestion,
        "resolution": "pending_user_confirmation",
    })


def split_top(s: str, sep: str = ",") -> list[str]:
    """Split on `sep` only at parenthesis depth 0 and outside backticks."""
    parts, buf, depth, in_bt = [], [], 0, False
    for ch in s:
        if ch == "`":
            in_bt = not in_bt
        elif not in_bt and ch in "(（":
            depth += 1
        elif not in_bt and ch in ")）":
            depth -= 1
        if ch == sep and depth == 0 and not in_bt:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    parts.append("".join(buf))
    return [p.strip() for p in parts if p.strip()]


def parse_word(item: str) -> dict:
    item = item.strip().rstrip(".").strip()
    m = re.match(r"^(.+?)\s*\((.*)\)$", item)
    if not m:
        return {"word": item, "reading": None, "meaningVi": None}
    word, inner = m.group(1).strip(), m.group(2).strip()
    parts = re.split(r"\s+-\s*", inner, maxsplit=1)
    if len(parts) == 2 and KANA_RE.match(parts[0].strip()):
        return {"word": word, "reading": parts[0].strip(), "meaningVi": parts[1].strip()}
    if KANA_RE.match(inner):
        return {"word": word, "reading": inner, "meaningVi": None}
    return {"word": word, "reading": None, "meaningVi": inner}


def build_tree(entries):
    root = {"indent": -1, "children": []}
    stack = [root]
    for ln, ind, txt in entries:
        node = {"line": ln, "indent": ind, "text": txt, "children": []}
        while stack[-1]["indent"] >= ind:
            stack.pop()
        stack[-1]["children"].append(node)
        stack.append(node)
    return root["children"]


def subtree_lines(node) -> list[int]:
    out = [node["line"]]
    for c in node["children"]:
        out.extend(subtree_lines(c))
    return out


def descendants(node):
    for c in node["children"]:
        yield c
        yield from descendants(c)


def split_header(h: str):
    m = re.match(r"^([^(—]+?)\s*\((.*)\)$", h)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    if " — " in h:
        a, b = h.split(" — ", 1)
        return a.strip(), b.strip()
    return h.strip(), ""


def strip_book(inner: str) -> str:
    for b in BOOK_PREFIXES:
        if inner.startswith(b + " — "):
            return inner[len(b) + 3:]
    return inner


def detect_books(text: str, skill: str) -> list[str]:
    hits = []
    for pat, bid in BOOK_PATTERNS:
        m = re.search(pat, text)
        if m:
            hits.append((m.start(), bid))
    m = re.search(r"Speed Master(?! N3 Dokkai| Dokkai| N3 Choukai)", text)
    if m:
        bid = {"listening": "speed_choukai", "reading": "speed_dokkai"}.get(skill)
        if bid:
            hits.append((m.start(), bid))
    out = []
    for _, bid in sorted(hits):
        if bid not in out:
            out.append(bid)
    return out


def page_ranges(text: str) -> list[str]:
    out = []
    for m in re.finditer(r"trang (\d+)(?:\s*[–-]\s*(\d+))?", text):
        r = f"{m.group(1)}–{m.group(2)}" if m.group(2) else m.group(1)
        if r not in out:
            out.append(r)
    return out


def uniq(seq):
    out = []
    for x in seq:
        if x not in out:
            out.append(x)
    return out


def mondai_list(text: str) -> list[int]:
    nums = set()
    for m in re.finditer(r"Mondai ((?:\d(?:\s*,\s*|\s*&\s*))*\d)", text):
        nums |= {int(x) for x in re.findall(r"\d", m.group(1))}
    return sorted(nums)


def backticks(text: str) -> list[str]:
    return re.findall(r"`([^`]+)`", text)


# --------------------------------------------------------------------------- source parsing
def parse_front_matter():
    sec1_start = find_line("## I. TỔNG QUAN")
    sec2_start = find_line("## II. LỘ TRÌNH CHI TIẾT")
    schedule = []
    for n in range(sec1_start, sec2_start):
        line = L(n)
        if line.startswith("| **"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            schedule.append({"label": clean(cells[0]), "minutesText": cells[1],
                             "minutes": int(re.match(r"(\d+)", cells[1]).group(1)),
                             "content": clean(cells[2]), "sourceLine": n})
    skills_by_idx = [["vocabulary", "kanji"], ["grammar"], ["reading"], ["listening"], ["mixed"]]
    for i, row in enumerate(schedule):
        row["skills"] = skills_by_idx[i] if i < len(skills_by_idx) else []
    rec_line = find_line("Khuyến nghị: 2.5 – 3.5 giờ/ngày")
    textbooks_lines = list(range(find_line("### 1. Bộ giáo trình"), find_line("### 2. Phân bổ thời gian")))
    return {
        "title": clean(L(1).lstrip("# ")),
        "subtitle": clean(L(2)),
        "strategyText": "\n".join(L(n) for n in range(sec1_start, sec2_start)).strip(),
        "strategySourceLines": [sec1_start, sec2_start - 1],
        "textbookStrategyLines": [textbooks_lines[0], textbooks_lines[-1]],
        "recommendedDailyHours": {"min": 2.5, "max": 3.5, "sourceLine": rec_line,
                                  "text": clean(L(rec_line).lstrip("# "))},
        "dailySchedule": schedule,
        "examDate": EXAM_DATE.isoformat(),
    }


def parse_phases():
    phases = []
    for n, line in enumerate(LINES, start=1):
        m = PHASE_RE.match(line)
        if m:
            obj_line = next(k for k in range(n + 1, n + 4) if L(k).startswith("*Mục tiêu"))
            phases.append({
                "phase": int(m.group(1)),
                "titleVi": m.group(2).strip(),
                "startDate": date(YEAR, int(m.group(4)), int(m.group(3))).isoformat(),
                "endDate": date(YEAR, int(m.group(6)), int(m.group(5))).isoformat(),
                "startDay": int(m.group(7)),
                "endDay": int(m.group(8)),
                "objective": clean(L(obj_line)).removeprefix("Mục tiêu:").strip(),
                "headerLine": n,
                "objectiveLine": obj_line,
            })
    return phases


def parse_days():
    days = []
    i, n = 0, len(LINES)
    while i < n:
        m = DAY_RE.match(LINES[i])
        if not m:
            i += 1
            continue
        hdr = i + 1
        j = i + 1
        entries, notes = [], []
        while j < n and not re.match(r"^#{2,4} ", LINES[j]):
            line = LINES[j].rstrip()
            if line.strip() not in ("", "---"):
                bm = BULLET_RE.match(line)
                if bm:
                    entries.append((j + 1, len(bm.group(1)), bm.group(2)))
                else:
                    notes.append({"line": j + 1, "text": clean(line)})
            j += 1
        days.append({"number": int(m.group(1)), "weekdayVi": m.group(2).strip(),
                     "dd": int(m.group(3)), "mm": int(m.group(4)), "title": m.group(5).strip(),
                     "headerLine": hdr, "tree": build_tree(entries), "notes": notes})
        i = j
    return days


# --------------------------------------------------------------------------- task construction
SPLIT_SPECS = {
    (20, 1): [
        dict(prefix="vocab", skill="vocabulary", type="revision",
             title="Từ vựng — Ôn tập vòng 2: bài tập trắc nghiệm cuối Unit 4–10 (Mimi kara Goi)"),
        dict(prefix="vocab", skill="vocabulary", type="error_review",
             title="Từ vựng — Học thuộc lòng danh sách từ đánh dấu đỏ ở Ngày 18 và Ngày 19"),
    ],
    (22, 4): [
        dict(prefix="reading", skill="reading", type="error_review",
             title="Đọc hiểu — Làm lại các bài đã từng làm sai (Shinkanzen Master & Speed Master)"),
        dict(prefix="listening", skill="listening", type="revision",
             title="Nghe hiểu — 20 câu Mondai 4 & 5 chuyên về Kính ngữ và Cho nhận"),
    ],
    (25, 1): [
        dict(prefix="grammar", skill="grammar", type="revision",
             title="Buổi sáng — Quét nhanh 112 mẫu ngữ pháp qua Mục lục (目次) Mimi kara Bunpou"),
        dict(prefix="vocab", skill="vocabulary", type="revision",
             title="Buổi sáng — Đọc lướt Unit 7 (Phó từ) & Unit 10 (Từ láy オノマトペ) Mimi kara Goi"),
    ],
    (25, 2): [
        dict(prefix="kanji", skill="kanji", type="revision",
             title="Buổi chiều — Lật nhanh 36 bài Soumatome N3 Kanji (chỉ nhìn từ ghép in đậm)"),
        dict(prefix="listening", skill="listening", type="revision",
             title="Buổi chiều — Nghe nhẹ nhàng 15 phút Mondai 4 & Mondai 5"),
    ],
    (25, 3): [
        dict(prefix="prep", skill="general", type="exam_preparation",
             title="Buổi tối — Kiểm tra hành trang phòng thi (受験票, giấy tờ, bút chì, đồng hồ kim)"),
        dict(prefix="prep", skill="general", type="exam_preparation",
             title="Buổi tối — Nhắc lại Chiến thuật Vàng trong phòng thi ngày 05/12"),
        dict(prefix="prep", skill="general", type="exam_preparation",
             title="Buổi tối — Đi ngủ trước 22h30"),
    ],
}

SKILL_LABEL = {"vocabulary": "Từ vựng", "kanji": "Kanji", "grammar": "Ngữ pháp", "reading": "Đọc hiểu",
               "listening": "Nghe hiểu", "mixed": "Tổng hợp", "general": "Chung"}


class DayBuilder:
    def __init__(self, day, phase, schedule):
        self.day = day
        self.num = day["number"]
        self.phase = phase
        self.schedule = schedule
        self.tasks: list[dict] = []
        self.counters: dict[str, int] = {}
        self.regular = True

    def new_id(self, prefix):
        c = self.counters.get(prefix, 0) + 1
        self.counters[prefix] = c
        return f"d{self.num:02d}-{prefix}-{c:02d}"

    def make(self, *, prefix, skill, task_type, title, lines, section_no, origin="roadmap_day",
             books_override=None, books_basis=None):
        lines = sorted(set(lines))
        raw = "\n".join(L(n) for n in lines)
        books = books_override if books_override is not None else detect_books(raw, skill)
        pr = page_ranges(raw)
        im = re.search(r"Từ số (\d+) – (\d+)", raw)
        pm = re.search(r"Mẫu (\d+) – (\d+)", raw)
        targets = uniq(f"{m.group(1)} {m.group(2)}" for m in TARGET_RE.finditer(raw))
        task = {
            "id": self.new_id(prefix),
            "dayNumber": self.num,
            "order": len(self.tasks) + 1,
            "skill": skill,
            "taskType": task_type,
            "title": title,
            "description": "\n".join(clean(L(n), keep_indent=True) for n in lines),
            "originalText": raw,
            "sourceLines": lines,
            "sourceSection": section_no,
            "origin": origin,
            "immutable": True,
            "textbook": " · ".join(TEXTBOOKS[b]["titleRomaji"] for b in books) or None,
            "textbookIds": books,
            "textbookBasis": books_basis or ("task_text" if books else None),
            "unit": None,
            "pageRange": pr[0] if pr else None,
            "pageRanges": pr,
            "pageNotes": ["trang cuối"] if "trang cuối" in raw else [],
            "itemRange": f"{im.group(1)}–{im.group(2)}" if im else None,
            "patternRange": f"{pm.group(1)}–{pm.group(2)}" if pm else None,
            "lessonRefs": [],
            "exerciseRefs": [],
            "mondai": [],
            "target": ", ".join(targets) if targets else None,
            "timeGuidance": uniq(m.group(0).strip() for m in TIME_RE.finditer(raw)),
            "timeLimitMinutes": None,
            "estimatedMinutes": None,
            "estimatedMinutesSource": None,
            "sessionRef": None,
            "playbackSpeeds": uniq(m.group(0) for m in re.finditer(r"\d\.\d+x", raw)),
            "priority": "medium",
            "priorityBasis": None,
            "checklist": [],
            "contentRefs": {},
            "flags": [],
            "status": "not_started",
            "completedAt": None,
            "notes": "",
        }
        self.tasks.append(task)
        return task


def checklist_from(nodes) -> list[str]:
    out = []
    for nd in nodes:
        for d in [nd, *descendants(nd)]:
            out.append(clean(d["text"]))
    return out


def set_session_ref(task, schedule, regular):
    if not regular:
        return
    sk = task["skill"]
    row = None
    if sk in ("vocabulary", "kanji"):
        row = schedule[0]
    elif sk == "grammar":
        row = schedule[1]
    elif sk == "reading":
        row = schedule[2]
    elif sk == "listening":
        row = schedule[3]
    if not row:
        return
    share = None
    if sk == "vocabulary":
        m = re.search(r"Từ vựng Mimi kara \((\d+) phút", row["content"])
        share = int(m.group(1)) if m else None
    elif sk == "kanji":
        m = re.search(r"Kanji Soumatome \((\d+) phút", row["content"])
        share = int(m.group(1)) if m else None
    task["sessionRef"] = {"session": row["label"], "sessionMinutes": row["minutes"],
                          "skillShareMinutes": share, "sourceLine": row["sourceLine"],
                          "note": "Khung giờ chung từ bảng 'Phân bổ thời gian học mỗi ngày' (không phải thời lượng riêng của task)."}


def assign_priority(task, unit_num=None):
    s, tt, raw = task["skill"], task["taskType"], task["originalText"]
    if tt == "mock_exam" and task["id"].split("-")[1] == "mock":
        return "high", 'Giai đoạn 3 — Mục tiêu: "Giải 4 bộ đề thi thật JLPT N3".'
    if s == "vocabulary" and unit_num:
        if unit_num == 7:
            return "high", 'Nguồn: "Học trọn Unit 7 — CỰC KỲ QUAN TRỌNG" + Mục I.1 "Ưu tiên tuyệt đối Unit 1, 2, 3, 4, 5, 7".'
        if unit_num in (1, 2, 3, 4, 5):
            return "high", 'Mục I.1: "Ưu tiên tuyệt đối Unit 1, 2, 3, 4, 5, 7".'
        return "medium", 'Mục I.1: "sau đó quét nhanh Unit 6, 8, 9, 10".'
    if s == "listening" and task["mondai"] and set(task["mondai"]) <= {4, 5}:
        return "high", 'Mục I.5: "Mondai 4 & 5 (ăn điểm phản xạ nhanh, dễ lấy điểm nhất)".'
    if "Chiến thuật ăn trọn 100% điểm" in raw:
        return "high", 'Ngày 17: "Chiến thuật ăn trọn 100% điểm bài này (làm ĐẦU TIÊN ...)".'
    if "Luôn chiếm 4–5 câu trong đề" in raw:
        return "high", 'Ngày 22: "Luôn chiếm 4–5 câu trong đề".'
    if "điểm rất lớn" in raw:
        return "high", 'Ngày 15: "mỗi câu 4 điểm — điểm rất lớn!".'
    if "Phiếu dự thi" in raw:
        return "high", "Ngày 25: vật dụng bắt buộc mang vào phòng thi."
    return "medium", "Nguồn không ghi mức ưu tiên riêng cho task này — mặc định."


# --------------------------------------------------------------------------- content catalogs (filled while building)
VOCAB_ITEMS: list[dict] = []
VOCAB_ASSIGN: list[dict] = []
SYNONYMS: list[dict] = []
POLYSEMOUS: list[dict] = []
KANJI_WORDS: list[dict] = []
KANJI_LESSONS: list[dict] = []
KANJI_TESTS: list[dict] = []
HOMOPHONES: list[dict] = []
GRAMMAR_PATTERNS: list[dict] = []
GRAMMAR_SESSIONS: list[dict] = []
GRAMMAR_EXERCISES: list[dict] = []
GRAMMAR_TOPICS: list[dict] = []
GRAMMAR_NOTES: list[dict] = []
READING: list[dict] = []
LISTENING: list[dict] = []


def vocab_from_section(sec, db, task, unit, unit_name, item_range):
    seq = 0

    def walk(node, cat):
        nonlocal seq
        m = LABEL_RE.match(node["text"])
        if m:
            cat, rest = clean(m.group(1)), m.group(2)
        else:
            rest = node["text"]
        rest = rest.strip()
        if rest:
            for part in split_top(rest.rstrip(".").strip()):
                seq += 1
                w = parse_word(part)
                VOCAB_ITEMS.append({
                    "id": f"rm-v-d{db.num:02d}-{seq:03d}",
                    **w,
                    "partOfSpeech": None,
                    "category": cat,
                    "unit": unit,
                    "unitName": unit_name,
                    "dayNumber": db.num,
                    "assignedItemRange": item_range,
                    "itemNumber": None,
                    "itemNumberStatus": "unknown_not_in_source",
                    "exampleSentence": None,
                    "exampleTranslation": None,
                    "relatedExpressions": [],
                    "audio": None,
                    "source": "roadmap_highlight",
                    "textbookId": "mimi_goi",
                    "taskId": task["id"],
                    "sourceLine": node["line"],
                    "rawText": part,
                    "flags": [],
                })
        for c in node["children"]:
            walk(c, cat)

    for c in sec["children"]:
        walk(c, None)
    return [v["id"] for v in VOCAB_ITEMS if v["taskId"] == task["id"]]


def parse_kanji_items(text, base_id, meta):
    out = []
    seq = 0
    for gi, part in enumerate(split_top(text.rstrip(".").strip()), start=1):
        members = [p.strip() for p in part.split(" vs ")]
        group = f"{base_id}-cg{gi:02d}" if len(members) > 1 else None
        for mem in members:
            seq += 1
            w = parse_word(mem)
            out.append({"id": f"{base_id}-{seq:02d}", **w, **meta, "contrastGroup": group,
                        "source": "roadmap_highlight", "rawText": mem, "flags": []})
    return out


def parse_pattern(node, group, db, task, unit, order):
    t = node["text"]
    m = re.match(r"^`([^`]+)`(.*)$", t)
    structure, rest = m.group(1), m.group(2).lstrip(":").strip()
    examples = []
    for seg in re.findall(r"\*([^*]+)\*", rest):
        examples.extend(x.strip() for x in seg.split(" / ") if x.strip())
    for bt in backticks(rest):
        if not bt.startswith("～") and CJK_RE.search(bt) or (bt and not bt.startswith("～") and re.search(r"[\u3040-\u30ff]", bt)):
            for x in bt.split(" / "):
                if x.strip() and x.strip() not in examples:
                    examples.append(x.strip())
    meaning = re.sub(r":\s*\*[^*]+\*\.?\s*$", "", rest)
    meaning = re.sub(r"\s*\(\*[^*]+\*\)", "", meaning)
    meaning = meaning.replace("*", "").strip().rstrip(".").strip()
    return {
        "id": f"rm-g-d{db.num:02d}-{order:02d}",
        "structure": structure,
        "meaningVi": meaning,
        "examples": examples,
        "exampleTranslations": [],
        "formation": None,
        "usage": None,
        "similarPatterns": [],
        "commonMistakes": [],
        "jlptRelevance": None,
        "unit": unit,
        "group": group,
        "dayNumber": db.num,
        "orderInSession": order,
        "patternNumber": None,
        "patternNumberStatus": None,
        "taskId": task["id"],
        "source": "roadmap_highlight",
        "textbookId": "mimi_bunpou",
        "sourceLine": node["line"],
        "rawText": t,
        "flags": [],
    }


def build_day(day, phase, schedule):
    db = DayBuilder(day, phase, schedule)
    sections = []
    for node in day["tree"]:
        sm = SECTION_RE.match(node["text"])
        if not sm:
            issue("UNPARSED_TOP_LEVEL", "error", "parsing", "Top-level line is not a numbered section.",
                  lines=[node["line"]], day=db.num)
            continue
        sections.append({"no": int(sm.group(1)), "header": clean(sm.group(2)), "node": node})

    kinds = []
    for s in sections:
        h = s["header"]
        k = ("vocabulary" if h.startswith("Từ vựng") else
             "kanji" if h.startswith("Kanji") else
             "grammar" if h.startswith("Ngữ pháp") else
             "reading_listening" if h.startswith("Đọc hiểu & Nghe hiểu") else
             "reading" if h.startswith("Đọc hiểu") else
             "listening" if h.startswith("Nghe hiểu") else
             "mock" if h.startswith("Thi thử") else
             "mock_review" if h.startswith("Chữa đề") else
             "notebook_review" if h.startswith("Tổng ôn") else
             "session" if h.startswith("Buổi") else "unknown")
        s["kind"] = k
        kinds.append(k)
        if k == "unknown":
            issue("UNKNOWN_SECTION", "error", "parsing", f"Cannot classify section: {h}", lines=[s["node"]["line"]], day=db.num)
    db.regular = not any(k in ("mock", "mock_review", "notebook_review", "session") for k in kinds)

    for s in sections:
        node, hdr, no, kind = s["node"], s["header"], s["no"], s["kind"]
        label, inner = split_header(hdr)
        default_title = f"{label} — {strip_book(inner)}" if inner else label
        key = (db.num, no)

        # ---------- explicit splits (one task per first-level child)
        if key in SPLIT_SPECS:
            specs = SPLIT_SPECS[key]
            if len(specs) != len(node["children"]):
                issue("SPLIT_MISMATCH", "error", "parsing", "Split spec does not match children count.",
                      lines=[node["line"]], day=db.num)
            for spec, child in zip(specs, node["children"]):
                t = db.make(prefix=spec["prefix"], skill=spec["skill"], task_type=spec["type"],
                            title=spec["title"], lines=[node["line"], *subtree_lines(child)], section_no=no)
                t["checklist"] = checklist_from([child]) if child["children"] else []
                if spec["skill"] == "listening":
                    t["mondai"] = mondai_list(t["originalText"])
                um = re.search(r"Unit \d+(?:, \d+)*(?: đến Unit \d+)?", clean(child["text"]))
                if spec["skill"] == "vocabulary" and key == (20, 1):
                    t["unit"] = re.search(r"Unit 4 đến Unit 10", hdr).group(0)
                elif um and spec["skill"] in ("vocabulary", "grammar"):
                    t["unit"] = um.group(0)
                hm = re.search(r"\((\d+) phút\)", hdr)
                if db.num == 25:
                    t["sessionRef"] = {"session": label.split(" (")[0], "sessionMinutes": int(hm.group(1)) if hm else None,
                                       "skillShareMinutes": None, "sourceLine": node["line"],
                                       "note": "Thời lượng ghi cho cả buổi trong nguồn."}
                    em = re.search(r"Nghe nhẹ nhàng (\d+) phút", t["originalText"])
                    if em:
                        t["estimatedMinutes"], t["estimatedMinutesSource"] = int(em.group(1)), "day_text"
                else:
                    set_session_ref(t, schedule, db.regular)
                if spec["skill"] == "reading":
                    READING.append(reading_record(t, db, child_text=clean(child["text"])))
                if spec["skill"] == "listening":
                    LISTENING.append(listening_record(t, db))
                if spec["skill"] == "grammar" or (spec["skill"] == "vocabulary" and key != (25, 1)) or spec["skill"] == "kanji":
                    pass
            continue

        # ---------- vocabulary
        if kind == "vocabulary":
            m = re.search(r"Unit (\d+): (.+?), Từ số (\d+) – (\d+)", hdr)
            if m:
                unit, uname, a, b = int(m.group(1)), m.group(2).strip(), int(m.group(3)), int(m.group(4))
                t = db.make(prefix="vocab", skill="vocabulary", task_type="memorization", title=default_title,
                            lines=subtree_lines(node), section_no=no)
                t["unit"] = f"Unit {unit}"
                ids = vocab_from_section(node, db, t, unit, uname, t["itemRange"])
                t["contentRefs"]["vocabIds"] = ids
                VOCAB_ASSIGN.append({"dayNumber": db.num, "taskId": t["id"], "unit": unit, "unitName": uname,
                                     "itemRange": t["itemRange"], "start": a, "end": b,
                                     "rangeSize": b - a + 1, "listedCount": len(ids), "sourceLine": node["line"]})
                t["priority"], t["priorityBasis"] = assign_priority(t, unit)
            else:
                t = db.make(prefix="vocab", skill="vocabulary", task_type="revision", title=default_title,
                            lines=subtree_lines(node), section_no=no)
                um = re.search(r"Unit \d+(?:, \d+)*(?: đến Unit \d+)?", hdr)
                t["unit"] = um.group(0) if um else None
                t["checklist"] = [clean(c["text"]) for c in node["children"]]
                # synonyms (Day 17) and polysemous verbs (Day 22)
                for d in descendants(node):
                    sm = re.match(r"^(.+?)\s*＝\s*(.+?)\s*\(([^()]*)\)\.?$", d["text"])
                    if sm:
                        SYNONYMS.append({"id": f"rm-syn-{len(SYNONYMS) + 1:02d}", "word": sm.group(1).strip(),
                                         "equivalent": sm.group(2).strip(), "meaningVi": sm.group(3).strip(),
                                         "dayNumber": db.num, "taskId": t["id"], "sourceLine": d["line"],
                                         "rawText": d["text"], "source": "roadmap_highlight"})
                    pm = re.match(r"^`([^`]+)`:\s*(\(1\).*)$", d["text"])
                    if pm and db.num == 22:
                        senses = []
                        for sense in re.split(r";\s*(?=\(\d+\))", pm.group(2).rstrip(".")):
                            nm = re.match(r"\((\d+)\)\s*(.*)$", sense.strip())
                            senses.append({"n": int(nm.group(1)), "text": nm.group(2).strip(),
                                           "examples": backticks(nm.group(2))})
                        POLYSEMOUS.append({"id": f"rm-poly-{len(POLYSEMOUS) + 1:02d}", "verb": pm.group(1),
                                           "senses": senses, "dayNumber": db.num, "taskId": t["id"],
                                           "sourceLine": d["line"], "rawText": d["text"], "source": "roadmap_highlight"})
                t["contentRefs"]["synonymIds"] = [x["id"] for x in SYNONYMS if x["taskId"] == t["id"]]
                t["contentRefs"]["polysemousIds"] = [x["id"] for x in POLYSEMOUS if x["taskId"] == t["id"]]
                t["priority"], t["priorityBasis"] = assign_priority(t)
            set_session_ref(t, schedule, db.regular)
            continue

        # ---------- kanji
        if kind == "kanji":
            wm = re.search(r"Tuần (\d+)", hdr)
            lesson_children = [c for c in node["children"] if KANJI_LESSON_RE.match(c["text"])]
            if lesson_children:
                week = int(wm.group(1))
                for c in node["children"]:
                    lm = KANJI_LESSON_RE.match(c["text"])
                    tm = KANJI_TEST_RE.match(c["text"])
                    if lm:
                        l1 = int(lm.group(1))
                        lessons = [l1] + ([int(lm.group(2))] if lm.group(2) else [])
                        topic, p1, p2 = lm.group(3), lm.group(4), lm.group(5)
                        lesson_label = " & ".join(str(x) for x in lessons)
                        t = db.make(prefix="kanji", skill="kanji", task_type="memorization",
                                    title=f"Kanji — Tuần {week}, Bài {lesson_label}: {topic} (trang {p1}–{p2})",
                                    lines=[node["line"], *subtree_lines(c)], section_no=no)
                        t["unit"] = f"Tuần {week} – Bài {lesson_label}"
                        t["pageRange"] = f"{p1}–{p2}"
                        t["pageRanges"] = [f"{p1}–{p2}"]
                        t["lessonRefs"] = [f"W{week}-L{x}" for x in lessons]
                        base = f"rm-kw-w{week}l{l1}"
                        meta = {"week": week, "lessons": lessons, "lessonGlobal": [(week - 1) * 6 + x for x in lessons],
                                "lessonTopic": topic, "pageRange": f"{p1}–{p2}", "dayNumber": db.num,
                                "taskId": t["id"], "sourceLine": c["line"], "textbookId": "soumatome_kanji"}
                        words = parse_kanji_items(lm.group(6), base, meta)
                        KANJI_WORDS.extend(words)
                        t["contentRefs"]["kanjiWordIds"] = [w["id"] for w in words]
                        for x in lessons:
                            KANJI_LESSONS.append({"id": f"W{week}-L{x}", "week": week, "lesson": x,
                                                  "lessonGlobal": (week - 1) * 6 + x, "topicVi": topic,
                                                  "pageRange": f"{p1}–{p2}", "dayNumber": db.num, "taskId": t["id"],
                                                  "sourceLine": c["line"], "mergedWith": [f"W{week}-L{y}" for y in lessons if y != x],
                                                  "listedWordIds": [w["id"] for w in words]})
                    elif tm:
                        t = db.make(prefix="kanji", skill="kanji", task_type="quiz",
                                    title=f"Kanji — Làm bài Test Tuần {tm.group(1)} (trang {tm.group(2)}–{tm.group(3)})",
                                    lines=[node["line"], c["line"]], section_no=no)
                        t["unit"] = f"Tuần {tm.group(1)} – Bài Test"
                        t["pageRange"] = f"{tm.group(2)}–{tm.group(3)}"
                        t["pageRanges"] = [t["pageRange"]]
                        KANJI_TESTS.append({"id": f"W{tm.group(1)}-TEST", "week": int(tm.group(1)),
                                            "pageRange": t["pageRange"], "dayNumber": db.num, "taskId": t["id"],
                                            "sourceLine": c["line"]})
                    else:
                        issue("KANJI_CHILD_UNPARSED", "error", "parsing", "Kanji child line not recognised.",
                              lines=[c["line"]], day=db.num)
                        continue
                    t["priority"], t["priorityBasis"] = assign_priority(t)
                    set_session_ref(t, schedule, db.regular)
            else:
                t = db.make(prefix="kanji", skill="kanji", task_type="revision", title=default_title,
                            lines=subtree_lines(node), section_no=no)
                um = re.search(r"Tuần [\d, ]+\d", hdr)
                t["unit"] = um.group(0) if um else None
                t["checklist"] = [clean(c["text"]) for c in node["children"]]
                if db.num == 22:
                    for c in node["children"]:
                        hm = re.match(r"^`([^`]+)`:\s*(.*)$", c["text"])
                        if hm:
                            gid = f"rm-hom-{len(HOMOPHONES) + 1:02d}"
                            members = []
                            for k, mem in enumerate(hm.group(2).rstrip(".").split(" vs "), start=1):
                                w = parse_word(mem)
                                members.append({"id": f"{gid}-{k}", **w, "rawText": mem.strip()})
                            HOMOPHONES.append({"id": gid, "reading": hm.group(1), "members": members,
                                               "dayNumber": db.num, "taskId": t["id"], "sourceLine": c["line"],
                                               "rawText": c["text"], "source": "roadmap_highlight", "flags": []})
                    t["contentRefs"]["homophoneGroupIds"] = [h["id"] for h in HOMOPHONES]
                t["priority"], t["priorityBasis"] = assign_priority(t)
                set_session_ref(t, schedule, db.regular)
            continue

        # ---------- grammar
        if kind == "grammar":
            m = re.search(r"Unit (\d+), ([^:]+): Mẫu (\d+) – (\d+)", hdr)
            if m:
                unit, half, a, b = int(m.group(1)), m.group(2).strip(), int(m.group(3)), int(m.group(4))
                ex_children = [c for c in node["children"] if GRAMMAR_EX_RE.match(c["text"])]
                learn_children = [c for c in node["children"] if c not in ex_children]
                t = db.make(prefix="grammar", skill="grammar", task_type="learning", title=default_title,
                            lines=[node["line"], *[l for c in learn_children for l in subtree_lines(c)]],
                            section_no=no)
                t["unit"] = f"Unit {unit}"
                patterns, order = [], 0

                def walk(nd, group):
                    nonlocal order
                    gm = re.match(r"^\*\*(.+?)\*\*:\s*$", nd["text"])
                    if gm:
                        for c2 in nd["children"]:
                            walk(c2, clean(gm.group(1)))
                        return
                    if nd["text"].startswith("`"):
                        order += 1
                        patterns.append(parse_pattern(nd, group, db, t, unit, order))
                    else:
                        GRAMMAR_NOTES.append({"id": f"rm-gn-d{db.num:02d}-{len(GRAMMAR_NOTES) + 1:02d}",
                                              "kind": "review_note", "text": clean(nd["text"]),
                                              "forms": backticks(nd["text"]), "unit": unit, "dayNumber": db.num,
                                              "taskId": t["id"], "sourceLine": nd["line"], "rawText": nd["text"]})
                    for c2 in nd["children"]:
                        walk(c2, group)

                for c in learn_children:
                    walk(c, None)
                expected = b - a + 1
                for p in patterns:
                    p["assignedPatternRange"] = f"{a}–{b}"
                    p["unitPart"] = half
                    if len(patterns) == expected:
                        p["patternNumber"] = a + p["orderInSession"] - 1
                        p["patternNumberStatus"] = "inferred_from_listing_order"
                    else:
                        p["patternNumberStatus"] = "not_determinable_listing_count_mismatch"
                GRAMMAR_PATTERNS.extend(patterns)
                t["contentRefs"]["grammarIds"] = [p["id"] for p in patterns]
                t["contentRefs"]["grammarNoteIds"] = [n_["id"] for n_ in GRAMMAR_NOTES if n_["taskId"] == t["id"]]
                GRAMMAR_SESSIONS.append({"dayNumber": db.num, "taskId": t["id"], "unit": unit, "unitPart": half,
                                         "patternRange": f"{a}–{b}", "start": a, "end": b, "expectedCount": expected,
                                         "listedCount": len(patterns), "sourceLine": node["line"]})
                t["priority"], t["priorityBasis"] = assign_priority(t)
                set_session_ref(t, schedule, db.regular)
                for c in ex_children:
                    em = GRAMMAR_EX_RE.match(c["text"])
                    te = db.make(prefix="grammar", skill="grammar", task_type="quiz",
                                 title=f"Ngữ pháp — Làm bài tập tổng hợp Unit {em.group(1)} (trang {em.group(2)}–{em.group(3)})",
                                 lines=[node["line"], c["line"]], section_no=no)
                    te["unit"] = f"Unit {em.group(1)}"
                    te["pageRange"] = f"{em.group(2)}–{em.group(3)}"
                    te["pageRanges"] = [te["pageRange"]]
                    te["patternRange"] = None
                    te["priority"], te["priorityBasis"] = assign_priority(te)
                    set_session_ref(te, schedule, db.regular)
                    GRAMMAR_EXERCISES.append({"unit": int(em.group(1)), "pageRange": te["pageRange"],
                                              "dayNumber": db.num, "taskId": te["id"], "sourceLine": c["line"]})
            else:
                t = db.make(prefix="grammar", skill="grammar", task_type="revision", title=default_title,
                            lines=subtree_lines(node), section_no=no)
                um = re.search(r"Unit \d+(?:, \d+)*(?: đến Unit \d+)?", hdr)
                t["unit"] = um.group(0) if um else None
                t["checklist"] = checklist_from(node["children"])
                topic = {"id": f"gt-d{db.num:02d}", "taskId": t["id"], "dayNumber": db.num, "title": hdr,
                         "items": checklist_from(node["children"]), "sourceLines": subtree_lines(node)}
                GRAMMAR_TOPICS.append(topic)
                t["contentRefs"]["grammarTopicIds"] = [topic["id"]]
                t["priority"], t["priorityBasis"] = assign_priority(t)
                set_session_ref(t, schedule, db.regular)
            continue

        # ---------- reading
        if kind == "reading":
            if "Đề thi thử" in hdr:
                ttype = "mock_exam"
            elif "Speed Master" in hdr:
                ttype = "timed_practice"
            else:
                ttype = "learning"
            t = db.make(prefix="reading", skill="reading", task_type=ttype, title=default_title,
                        lines=subtree_lines(node), section_no=no)
            t["unit"] = re.sub(r"(:| -) trang [\d–]+$", "", strip_book(inner)) if inner else None
            t["checklist"] = checklist_from(node["children"])
            mm = re.search(r"(\d+) phút/đề", t["originalText"])
            if mm:
                t["timeLimitMinutes"] = int(mm.group(1))
                t["estimatedMinutes"], t["estimatedMinutesSource"] = int(mm.group(1)), "day_text"
            t["priority"], t["priorityBasis"] = assign_priority(t)
            set_session_ref(t, schedule, db.regular)
            READING.append(reading_record(t, db, header=hdr))
            continue

        # ---------- listening
        if kind == "listening":
            raw = "\n".join(L(n) for n in subtree_lines(node))
            if "Chữa" in hdr:
                ttype = "error_review"
            elif "Đề thi thử" in hdr:
                ttype = "mock_exam"
            elif "Shadowing" in raw:
                ttype = "shadowing"
            elif "Ôn tập" in hdr or "Nghe lại" in raw:
                ttype = "revision"
            else:
                ttype = "learning"
            t = db.make(prefix="listening", skill="listening", task_type=ttype, title=default_title,
                        lines=subtree_lines(node), section_no=no)
            t["mondai"] = mondai_list(t["originalText"])
            t["unit"] = ", ".join(f"Mondai {x}" for x in t["mondai"]) or None
            t["checklist"] = checklist_from(node["children"])
            mm = re.search(r"Bấm giờ (\d+) phút", t["originalText"])
            if mm:
                t["timeLimitMinutes"] = int(mm.group(1))
                t["estimatedMinutes"], t["estimatedMinutesSource"] = int(mm.group(1)), "day_text"
            t["priority"], t["priorityBasis"] = assign_priority(t)
            set_session_ref(t, schedule, db.regular)
            LISTENING.append(listening_record(t, db))
            continue

        # ---------- full mock exam / reviews
        if kind in ("mock", "mock_review", "notebook_review"):
            hm = re.search(r"\((\d+) phút\)", hdr)
            if kind == "mock":
                books = detect_books("\n".join(L(n) for n in subtree_lines(node)), "mixed")
                basis = "task_text" if books else "phase_objective"
                if not books:
                    books = ["jlpt_past_papers"]
                num = re.search(r"Đề số (\d)", day["title"]).group(1)
                t = db.make(prefix="mock", skill="mixed", task_type="mock_exam",
                            title=f"Thi thử Đề số {num} — Full 3 kỹ năng (140 phút)",
                            lines=subtree_lines(node), section_no=no, books_override=books, books_basis=basis)
                t["timeLimitMinutes"] = int(hm.group(1)) if hm else None
                t["contentRefs"]["mockIds"] = [f"mock-full-{num}"]
            else:
                t = db.make(prefix="review", skill="mixed", task_type="error_review", title=default_title,
                            lines=subtree_lines(node), section_no=no)
            if hm:
                t["estimatedMinutes"], t["estimatedMinutesSource"] = int(hm.group(1)), "day_text"
            t["checklist"] = checklist_from(node["children"])
            t["priority"], t["priorityBasis"] = assign_priority(t)
            continue

        issue("SECTION_NOT_HANDLED", "error", "parsing", f"Section not handled: {hdr}", lines=[node["line"]], day=db.num)

    # ---------- recurring end-of-day review from the daily schedule table
    if db.regular:
        row = schedule[4]
        t = db.make(prefix="review", skill="mixed", task_type="revision",
                    title=f"{row['label']} — {row['content'].rstrip('.')}",
                    lines=[row["sourceLine"]], section_no=None, origin="daily_schedule_table")
        t["estimatedMinutes"], t["estimatedMinutesSource"] = row["minutes"], "daily_schedule_table"
        t["priority"], t["priorityBasis"] = "medium", "Bảng phân bổ thời gian: khung 'Ôn tập cuối buổi' áp dụng hằng ngày."
        t["sessionRef"] = {"session": row["label"], "sessionMinutes": row["minutes"], "skillShareMinutes": None,
                           "sourceLine": row["sourceLine"], "note": "Khung ôn tập cố định trong bảng phân bổ thời gian."}
        t["flags"].append("RECURRING_FROM_SCHEDULE_TABLE")
    return db, sections


def reading_record(t, db, header=None, child_text=None):
    text = header or child_text or ""
    sm_ranges = []
    types = {"Khởi động": ("warmup", "ウォーミングアップ"), "Đoạn ngắn": ("short", "短文"),
             "Trung văn": ("medium", "中文"), "Trường văn": ("long", "長文"),
             "Tìm kiếm thông tin": ("info_retrieval", "情報検索")}
    for m in re.finditer(r"(Khởi động|Đoạn ngắn|Trung văn|Trường văn|Tìm kiếm thông tin) Bài (\d+)\s*[–-]\s*(\d+)", text):
        typ, ja = types[m.group(1)]
        sm_ranges.append({"type": typ, "typeJa": ja, "labelVi": m.group(1), "from": int(m.group(2)), "to": int(m.group(3))})
    shin = None
    m1 = re.search(r"Phần (\d), Bài (\d+): trang (\d+)–(\d+)", text)
    m2 = re.search(r"Phần (\d): (.+?) - trang (\d+)–(\d+)", text)
    if "Shinkanzen" in text and m1:
        shin = {"part": int(m1.group(1)), "lesson": int(m1.group(2)), "topic": None, "pageRange": f"{m1.group(3)}–{m1.group(4)}"}
    elif "Shinkanzen" in text and m2:
        shin = {"part": int(m2.group(1)), "lesson": None, "topic": m2.group(2), "pageRange": f"{m2.group(3)}–{m2.group(4)}"}
    mocks = [int(x) for x in re.findall(r"模擬試験 (\d)", t["originalText"])]
    if sm_ranges:
        t["exerciseRefs"] = [f"SM-{r['type']}-{i}" if r["type"] == "warmup" else f"SM-{i}"
                             for r in sm_ranges for i in range(r["from"], r["to"] + 1)]
    if shin and shin["lesson"]:
        t["lessonRefs"] = [f"SKM-P{shin['part']}-L{shin['lesson']}"]
    elif shin:
        t["lessonRefs"] = [f"SKM-P{shin['part']}-{shin['pageRange']}"]
    rid = f"rd-d{db.num:02d}-{sum(1 for r in READING if r['dayNumber'] == db.num) + 1:02d}"
    t["contentRefs"]["readingAssignmentIds"] = [rid]
    return {
        "id": rid, "taskId": t["id"], "dayNumber": db.num, "taskType": t["taskType"],
        "title": t["title"], "textbookIds": t["textbookIds"],
        "shinkanzen": shin, "speedMasterRanges": sm_ranges, "speedMasterMockNumbers": mocks,
        "pageRanges": t["pageRanges"], "timeGuidance": t["timeGuidance"], "target": t["target"],
        "timeLimitMinutes": t["timeLimitMinutes"],
        "instructions": t["checklist"], "originalText": t["originalText"], "sourceLines": t["sourceLines"],
        "contentStatus": "passages_not_included",
        "contentNote": "Bài đọc/câu hỏi thuộc bản quyền giáo trình — người học tự nhập (import) nội dung.",
    }


def listening_record(t, db):
    lid = f"ls-d{db.num:02d}-{sum(1 for r in LISTENING if r['dayNumber'] == db.num) + 1:02d}"
    t["contentRefs"]["listeningAssignmentIds"] = [lid]
    focus = []
    for n in t["sourceLines"][1:]:
        focus.extend(backticks(L(n)))
    return {
        "id": lid, "taskId": t["id"], "dayNumber": db.num, "taskType": t["taskType"], "title": t["title"],
        "textbookIds": t["textbookIds"], "mondai": t["mondai"], "target": t["target"],
        "timeLimitMinutes": t["timeLimitMinutes"], "playbackSpeeds": t["playbackSpeeds"],
        "focusExpressions": uniq(focus), "instructions": t["checklist"],
        "originalText": t["originalText"], "sourceLines": t["sourceLines"],
        "audioStatus": "not_included", "transcriptStatus": "not_included",
        "contentNote": "Audio/script thuộc giáo trình — người học tự tải lên. Ứng dụng không tạo audio giả.",
    }


# --------------------------------------------------------------------------- consistency analysis -> issues
def analyse(days_out, phases, front):
    all_tasks = [t for d in days_out for t in d["tasks"]]
    by_day = {d["dayNumber"]: d for d in days_out}

    # Hangul / stray CJK anywhere in the source
    for n, line in enumerate(LINES, start=1):
        for m in HANGUL_RE.finditer(line):
            ctx = line[max(0, m.start() - 30): m.end() + 10]
            issue("CORRUPTED_TEXT_HANGUL", "error", "data_quality",
                  f"Ký tự tiếng Hàn '{m.group(0)}' xuất hiện trong nghĩa tiếng Việt: …{ctx}…",
                  lines=[n], day=_day_of_line(n, days_out),
                  suggestion="Có thể là lỗi gõ/AI. Với マナー nghĩa đúng có lẽ là 'phép lịch sự / quy tắc ứng xử' (như Ngày 7). Cần xác nhận — dữ liệu được giữ nguyên.")
    for item in VOCAB_ITEMS + KANJI_WORDS:
        mv = item.get("meaningVi") or ""
        if CJK_RE.search(re.sub(r"`[^`]*`", "", mv)):
            item["flags"].append("CJK_IN_VIETNAMESE_MEANING")
            issue("CORRUPTED_TEXT_CJK", "error", "data_quality",
                  f"Nghĩa tiếng Việt của {item['word']} chứa ký tự Hán lạ: '{mv}'.",
                  lines=[item["sourceLine"]], day=item["dayNumber"], task_ids=[item["taskId"]],
                  suggestion="採用 (さいよう) thường nghĩa là 'tuyển dụng'. Cần xác nhận — dữ liệu được giữ nguyên.")

    # Weekday / date checks
    start = date(YEAR, 11, 10)
    for d in days_out:
        exp = start + timedelta(days=d["dayNumber"] - 1)
        if d["date"] != exp.isoformat():
            issue("DATE_SEQUENCE", "error", "dates", f"Ngày {d['dayNumber']} có ngày {d['date']} ≠ {exp}.",
                  lines=[d["headerLine"]], day=d["dayNumber"])
        if d["weekdayVi"] != WEEKDAY_VI[date.fromisoformat(d["date"]).weekday()]:
            issue("WEEKDAY_MISMATCH", "error", "dates", f"Ngày {d['dayNumber']}: thứ trong nguồn không khớp lịch.",
                  lines=[d["headerLine"]], day=d["dayNumber"])

    # Exam date weekday
    ex_line = find_line("THI 05/12")
    issue("EXAM_DATE_WEEKDAY", "warning", "dates",
          f"Ngày thi 05/12/2026 là {WEEKDAY_VI[EXAM_DATE.weekday()]} ({WEEKDAY_EN[EXAM_DATE.weekday()]}). "
          "Kỳ thi JLPT tháng 12 thường tổ chức vào Chủ Nhật đầu tiên của tháng (06/12/2026).",
          lines=[ex_line], suggestion="Kiểm tra lại ngày giờ trên Phiếu dự thi (受験票). Ngày thi được lưu thành cấu hình có thể chỉnh trong ứng dụng.")

    # Vocabulary ranges continuity
    va = sorted(VOCAB_ASSIGN, key=lambda x: x["start"])
    expect = 1
    for a in va:
        if a["start"] != expect:
            issue("VOCAB_RANGE_GAP", "error", "ranges", f"Khoảng từ vựng không liên tục tại {a['itemRange']}.",
                  lines=[a["sourceLine"]], day=a["dayNumber"])
        expect = a["end"] + 1
    if expect - 1 != 880:
        issue("VOCAB_TOTAL", "error", "ranges", f"Tổng khoảng từ vựng = {expect - 1} ≠ 880.")
    # listing is partial
    listed = sum(a["listedCount"] for a in va)
    issue("VOCAB_PARTIAL_LISTING", "info", "completeness",
          f"Lộ trình chỉ liệt kê {listed} từ tiêu biểu cho dải 1–880 (mỗi ngày ~{round(listed / len(va))} từ / ~{round(880 / len(va))} từ được giao). "
          "Số thứ tự mục từ (item number), từ loại, câu ví dụ, audio KHÔNG có trong nguồn.",
          suggestion="Nhập danh sách 880 từ đầy đủ từ sách Mimi kara Oboeru N3 Goi qua CSV (mẫu sẽ được cung cấp). Không tự sinh dữ liệu.")

    # Duplicate vocab words across units
    seen = {}
    for v in VOCAB_ITEMS:
        seen.setdefault(v["word"], []).append(v)
    for w, lst in seen.items():
        if len(lst) > 1 and len({x["unit"] for x in lst}) > 1:
            for x in lst:
                x["flags"].append("DUPLICATE_ACROSS_UNITS")
            issue("VOCAB_DUPLICATE_ACROSS_UNITS", "warning", "data_quality",
                  f"Từ '{w}' xuất hiện ở nhiều Unit: " + ", ".join(f"Unit {x['unit']} (Ngày {x['dayNumber']})" for x in lst) + ".",
                  lines=[x["sourceLine"] for x in lst], task_ids=[x["taskId"] for x in lst],
                  suggestion="Kiểm tra trong sách Goi xem từ thực sự thuộc Unit nào. Ứng dụng giữ cả hai mục, liên kết chung một thẻ SRS.")

    # Duplicate kanji words
    seen = {}
    for k in KANJI_WORDS:
        seen.setdefault(k["word"], []).append(k)
    for w, lst in seen.items():
        if len(lst) > 1:
            issue("KANJI_DUPLICATE_WORD", "info", "data_quality",
                  f"Từ ghép '{w}' xuất hiện ở nhiều bài Kanji: " + ", ".join(f"Tuần {x['week']} Bài {x['lessons'][0]} ({x['meaningVi']})" for x in lst) + ".",
                  lines=[x["sourceLine"] for x in lst], task_ids=[x["taskId"] for x in lst])

    # Grammar range continuity and listed counts
    gs = sorted(GRAMMAR_SESSIONS, key=lambda x: x["start"])
    expect = 1
    for g in gs:
        if g["start"] != expect:
            issue("GRAMMAR_RANGE_GAP", "error", "ranges", f"Khoảng mẫu ngữ pháp không liên tục tại {g['patternRange']}.",
                  lines=[g["sourceLine"]], day=g["dayNumber"])
        expect = g["end"] + 1
        if g["listedCount"] != g["expectedCount"]:
            pats = [p["structure"] for p in GRAMMAR_PATTERNS if p["taskId"] == g["taskId"]]
            issue("GRAMMAR_COUNT_MISMATCH", "warning", "completeness",
                  f"Ngày {g['dayNumber']} — Unit {g['unit']} (Mẫu {g['patternRange']}): dải có {g['expectedCount']} mẫu nhưng nguồn chỉ liệt kê {g['listedCount']} mục: " + " | ".join(pats),
                  lines=[g["sourceLine"]], day=g["dayNumber"], task_ids=[g["taskId"]],
                  suggestion="Không gán số thứ tự mẫu cho các mục này. Đối chiếu Mục lục sách Mimi kara Bunpou và nhập bổ sung.")
    if expect - 1 != 112:
        issue("GRAMMAR_TOTAL", "error", "ranges", f"Tổng khoảng ngữ pháp = {expect - 1} ≠ 112.")
    total_listed = len(GRAMMAR_PATTERNS)
    issue("GRAMMAR_PARTIAL_LISTING", "info", "completeness",
          f"Nguồn liệt kê {total_listed} mục ngữ pháp cho dải 112 mẫu. Cấu trúc chia (formation), cách dùng, bản dịch câu ví dụ, lỗi thường gặp KHÔNG có trong nguồn.",
          suggestion="Nhập bổ sung từ sách Mimi kara Bunpou; các trường trống được hiển thị là 'chưa có dữ liệu', không tự sinh.")
    # duplicated といえば (Day 13)
    tl = [p for p in GRAMMAR_PATTERNS if "といえば" in p["structure"]]
    if len(tl) > 1:
        issue("GRAMMAR_OVERLAP", "warning", "data_quality",
              "Mẫu '～といえば' xuất hiện ở 2 mục liền nhau của Ngày 13: " + " | ".join(p["structure"] for p in tl) + ".",
              lines=[p["sourceLine"] for p in tl], day=13, task_ids=uniq(p["taskId"] for p in tl))
    for n_ in GRAMMAR_NOTES:
        issue("GRAMMAR_REVIEW_NOTE", "info", "interpretation",
              f"Dòng '{n_['text']}' (Ngày {n_['dayNumber']}) là ôn lại mẫu cơ bản — không được tính là mẫu N3 mới.",
              lines=[n_["sourceLine"]], day=n_["dayNumber"], task_ids=[n_["taskId"]])
    units_with_ex = {e["unit"] for e in GRAMMAR_EXERCISES}
    missing = [u for u in range(1, 10) if u not in units_with_ex]
    issue("GRAMMAR_EXERCISE_NOT_ASSIGNED", "info", "completeness",
          f"Không có task 'Làm bài tập tổng hợp' riêng cho Unit {', '.join(map(str, missing))} vào ngày học Unit đó "
          "(bảng phân bổ thời gian vẫn ghi chung 'làm bài tập cuối Unit'). Ứng dụng không tự thêm task.",
          lines=[front["dailySchedule"][1]["sourceLine"]])

    # Kanji coverage
    got = {(k["week"], k["lesson"]) for k in KANJI_LESSONS}
    miss = [(w, l) for w in range(1, 7) for l in range(1, 7) if (w, l) not in got]
    if miss or len(KANJI_LESSONS) != 36:
        issue("KANJI_LESSON_COVERAGE", "error", "ranges", f"Thiếu bài Kanji: {miss}")
    if sorted(t["week"] for t in KANJI_TESTS) != [1, 2, 3, 4, 5, 6]:
        issue("KANJI_TEST_COVERAGE", "error", "ranges", "Thiếu bài Test tuần Kanji.")
    issue("KANJI_CHARACTERS_NOT_LISTED", "info", "completeness",
          f"Nguồn không liệt kê 336 chữ Kanji riêng lẻ, chỉ có {len(KANJI_WORDS)} từ ghép tiêu biểu (kèm cách đọc/nghĩa). "
          "Âm On/Kun, chữ dễ nhầm theo từng chữ… KHÔNG có trong nguồn.",
          suggestion="Nhập danh sách 336 chữ từ sách Soumatome N3 Kanji qua CSV.")

    # Homophone sanity: compare with readings stated elsewhere in the roadmap
    known = {}
    for x in VOCAB_ITEMS + KANJI_WORDS:
        if x.get("reading"):
            known.setdefault(x["word"], set()).add(x["reading"])
    for g in HOMOPHONES:
        for mem in g["members"]:
            rs = known.get(mem["word"])
            if rs and g["reading"] not in rs:
                g["flags"].append("MEMBER_READING_DIFFERS")
                issue("HOMOPHONE_READING_CONFLICT", "warning", "data_quality",
                      f"Nhóm đồng âm `{g['reading']}` chứa {mem['word']}, nhưng chính lộ trình ghi {mem['word']} đọc là {', '.join(sorted(rs))}.",
                      lines=[g["sourceLine"]], day=22, task_ids=[g["taskId"]],
                      suggestion="Đây là cặp dễ nhầm (gần âm / cùng chữ Hán), không phải đồng âm. Ứng dụng sẽ hiển thị là 'cặp dễ nhầm'.")
    grp = next((g for g in HOMOPHONES if g["reading"] == "しょうひ"), None)
    if grp:
        grp["flags"].append("MEMBERS_NOT_HOMOPHONES")
        issue("HOMOPHONE_NOT_HOMOPHONE", "warning", "data_quality",
              "Nhóm `しょうひ`: 浪費 đọc là ろうひ và 経費 đọc là けいひ (theo từ điển) — không đồng âm với 消費; đây là nhóm cùng chữ 費.",
              lines=[grp["sourceLine"]], day=22, task_ids=[grp["taskId"]],
              suggestion="Giữ nguyên dữ liệu, hiển thị là 'nhóm chữ dễ nhầm' thay vì 'đồng âm'.")
    rl = find_line("`洗濯 - せんたく`")
    issue("RENDAKU_EXAMPLE_QUESTIONABLE", "info", "data_quality",
          "Ngày 18 dùng `洗濯 - せんたく` làm ví dụ trong nhóm biến âm, nhưng せんたく không có biến âm (濯 = たく). Có thể đây là ví dụ đối chiếu.",
          lines=[rl], day=18)

    # Speed Master coverage (from Section I declared ranges)
    declared = {"short": (1, 20), "medium": (21, 32), "long": (33, 38), "info_retrieval": (39, 45)}
    assigned = {}
    for r in READING:
        for rg in r["speedMasterRanges"]:
            for i in range(rg["from"], rg["to"] + 1):
                assigned.setdefault((rg["type"], i), []).append(r["dayNumber"])
    for typ, (a, b) in declared.items():
        for i in range(a, b + 1):
            if (typ, i) not in assigned:
                issue("SPEED_MASTER_GAP", "error", "ranges", f"Speed Master {typ} Bài {i} không được giao ngày nào.")
            elif len(assigned[(typ, i)]) > 1:
                issue("SPEED_MASTER_DUP", "warning", "ranges", f"Speed Master {typ} Bài {i} được giao nhiều lần.")

    # Reading-book phase boundary
    l_sec1 = find_line("**Ngày 1 – Ngày 8**: Dùng **Shinkanzen Master")
    l_sec2 = find_line("**Ngày 9 – Ngày 22**: Dùng **Speed Master")
    d8 = next(t for t in by_day[8]["tasks"] if t["skill"] == "reading")
    issue("READING_BOOK_BOUNDARY", "warning", "inconsistency",
          "Mục I ghi Shinkanzen cho Ngày 1–8 và Speed Master cho Ngày 9–22, nhưng lịch chi tiết chuyển sang Speed Master từ Ngày 8 "
          "(Shinkanzen chỉ dùng Ngày 1–7; Speed Master Ngày 8–18 & 20; Ngày 22 làm lại bài sai của cả hai sách).",
          lines=[l_sec1, l_sec2, d8["sourceLines"][0]], day=8, task_ids=[d8["id"]],
          suggestion="Ứng dụng theo lịch chi tiết từng ngày (Ngày 8 = Speed Master). Xác nhận nếu muốn khác.")
    d18 = next(t for t in by_day[18]["tasks"] if t["skill"] == "reading")
    issue("READING_MOCK_HEADER_MISMATCH", "warning", "inconsistency",
          "Ngày 18: tiêu đề ghi 'Đề thi thử Đọc hiểu số 1 & số 2' nhưng nội dung chỉ giao 模擬試験 1; 模擬試験 2 được giao ở Ngày 20.",
          lines=d18["sourceLines"][:3], day=18, task_ids=[d18["id"]],
          suggestion="Ứng dụng giao Đề 1 cho Ngày 18 và Đề 2 cho Ngày 20 (theo nội dung chi tiết).")
    d20 = next(t for t in by_day[20]["tasks"] if t["skill"] == "reading")
    issue("READING_SHINKANZEN_MOCK_UNASSIGNED", "warning", "inconsistency",
          "Ngày 20: tiêu đề nhắc '& Shinkanzen Master Đề tổng hợp' nhưng nội dung không có yêu cầu cụ thể nào cho đề này.",
          lines=d20["sourceLines"], day=20, task_ids=[d20["id"]],
          suggestion="Giữ nguyên trong mô tả task; không tạo task riêng. Xác nhận nếu muốn tạo task tùy chọn.")

    # Listening ambiguities
    d20l = next(t for t in by_day[20]["tasks"] if t["skill"] == "listening")
    issue("LISTENING_AMBIGUOUS_MOCK_REF", "warning", "ambiguity",
          "Ngày 20: 'Mondai 4 & Mondai 5 của Đề thi thử số 1' — không rõ là Đề thi thử Nghe số 1 của Mimi kara (Ngày 14), "
          "của Speed Master (Ngày 16) hay Đề thi thử Full số 1 (Ngày 19, hôm trước).",
          lines=d20l["sourceLines"], day=20, task_ids=[d20l["id"]],
          suggestion="Mặc định liên kết với Đề Full số 1 (Ngày 19) vì là đề gần nhất; người học chọn lại được.")
    sm_lines = [t["sourceLines"][0] for d in days_out for t in d["tasks"]
                if t["skill"] == "listening" and "speed_choukai" in t["textbookIds"] and re.search(r"Bài 3 & 4", t["originalText"])]
    issue("LISTENING_NUMBERING_ACROSS_BOOKS", "info", "ambiguity",
          "Speed Master Choukai được giao 'Bài 3 & 4' (Ngày 7, 8, 11) trong khi 'Bài 1 & 2' của cùng Mondai lại làm bằng sách Mimi kara (Ngày 3, 4, 5). "
          "Tương tự 'Đề luyện số 2' (Ngày 9) và 'số 3' (Ngày 13) không có 'Đề luyện số 1'.",
          lines=sm_lines + [find_line("Đề luyện số 2"), find_line("Đề luyện số 3")],
          suggestion="Giữ nguyên số bài như nguồn. Kiểm tra lại số bài thực tế trong sách Speed Master Choukai.")

    # Pacing statements vs detailed schedule
    issue("KANJI_PACING_STATEMENT", "info", "inconsistency",
          "Mục I ghi 'Gộp 2 bài/ngày trong 18 ngày đầu' nhưng lịch chi tiết hoàn tất 36 bài vào Ngày 17 (Tuần 6 học 3 bài/ngày ở Ngày 16 và 17).",
          lines=[find_line("Gộp **2 bài/ngày trong 18 ngày đầu**")])
    issue("GRAMMAR_PACING_STATEMENT", "info", "inconsistency",
          "Mục I ghi 'mỗi ngày 1 nửa Unit = 6–7 mẫu' trong 18 ngày, nhưng lịch chi tiết học trọn Unit 3, 5, 7, 8 trong 1 ngày (12–13 mẫu) và hoàn tất 112 mẫu vào Ngày 14.",
          lines=[find_line("mỗi ngày 1 nửa Unit = 6–7 mẫu")])
    p1 = next(p for p in phases if p["phase"] == 1)
    issue("PHASE1_OBJECTIVE_VS_SCHEDULE", "info", "inconsistency",
          "Mục tiêu Giai đoạn 1 ghi 'Unit 1–3 Từ vựng, Unit 1–4 Ngữ pháp, Tuần 1–3 Kanji', nhưng lịch Ngày 1–8 thực tế: Từ vựng tới từ số 448 (hết Unit 4 + nửa Unit 5), "
          "Ngữ pháp hết Unit 5 (Mẫu 62), Kanji tới Tuần 3 Bài 4 (Bài 5–6 + Test Tuần 3 ở Ngày 9).",
          lines=[p1["objectiveLine"]])
    star = find_line("Nắm 5 quy tắc giải nhanh bài Dấu sao")
    issue("STAR_RULES_COUNT", "warning", "inconsistency",
          "Ngày 16: ghi 'Nắm 5 quy tắc giải nhanh bài Dấu sao (★)' nhưng chỉ liệt kê 4 quy tắc.",
          lines=[star, star + 1, star + 2, star + 3, star + 4], day=16,
          suggestion="Hiển thị đúng 4 quy tắc có trong nguồn, ghi chú thiếu quy tắc thứ 5.")
    d23 = find_line("Từ vựng: Đạt $\\ge 38/60$")
    issue("SCORE_SECTION_MAPPING", "warning", "scoring",
          "Mục tiêu Ngày 23 chia điểm theo tiết thi (Từ vựng / Ngữ pháp & Đọc hiểu / Nghe), nhưng JLPT N3 chấm theo 3 phần: "
          "Kiến thức ngôn ngữ (Từ vựng + Ngữ pháp) 0–60, Đọc hiểu 0–60, Nghe hiểu 0–60. Hai cách chia không trùng nhau.",
          lines=[d23, d23 + 1, d23 + 2, d23 + 3], day=23,
          suggestion="Ứng dụng hiển thị CẢ HAI: mục tiêu theo tiết của lộ trình và điểm ước tính theo 3 phần chấm chính thức (gắn nhãn 'ước tính').")
    pts = find_line("mỗi câu 4 điểm")
    issue("UNOFFICIAL_POINT_VALUES", "info", "scoring",
          "Ngày 15 ghi 'mỗi câu 4 điểm' cho Trường văn. JLPT không công bố điểm từng câu (điểm quy đổi theo thang chuẩn hóa).",
          lines=[pts], day=15, suggestion="Mọi điểm tính trong ứng dụng đều gắn nhãn 'ước tính'.")
    d24 = by_day[24]
    issue("MOCK4_NO_REVIEW_SESSION", "info", "completeness",
          "Ngày 24 (Đề số 4) không có phần 'Chữa đề' riêng; 60 phút còn lại dành cho Tổng ôn Sổ tay Lỗi sai.",
          lines=[d24["headerLine"]], day=24)
    issue("DAILY_REVIEW_RECURRING", "info", "interpretation",
          "Khung 'Ôn tập cuối buổi — 15 phút' trong bảng phân bổ thời gian được thêm thành task hằng ngày (origin = daily_schedule_table) cho các ngày theo cấu trúc 5 ca "
          "(Ngày 1–18, 20, 22). Không thêm vào ngày thi thử (19, 21, 23, 24) và Ngày 25.",
          lines=[front["dailySchedule"][4]["sourceLine"]],
          suggestion="Xác nhận có muốn task này xuất hiện hằng ngày hay không.")
    issue("NO_PER_TASK_DURATION", "info", "completeness",
          "Phần lớn task không có thời lượng riêng. Ứng dụng chỉ hiển thị thời lượng khi nguồn ghi rõ (vd. 140 phút, 50 phút/đề, 40 phút); "
          "các task khác hiển thị khung giờ chung của ca học (vd. 'Ca 1 · 45 phút, phần Từ vựng 25 phút').",
          lines=[front["dailySchedule"][0]["sourceLine"]])
    issue("PAGES_NOT_VERIFIED", "info", "verification",
          "Số trang/số bài/số mục từ được trích nguyên văn từ lộ trình nhưng CHƯA được đối chiếu với sách giấy (không có sách trong workspace). "
          "Các phiên bản sách khác nhau có thể lệch trang.",
          suggestion="Người học đối chiếu nhanh trang của Ngày 1–3 trước; nếu lệch, có thể ghi đè bằng 'điều chỉnh cá nhân' (không sửa lộ trình gốc).")


def _day_of_line(n, days_out):
    cur = None
    for d in days_out:
        if d["headerLine"] <= n:
            cur = d["dayNumber"]
    return cur


# --------------------------------------------------------------------------- reading strategies & mock catalog
READING_STRATEGY_MARKERS = [
    ("rs-hidden-subject", "Tìm chủ ngữ bị ẩn", "Cách tìm Chủ ngữ (主語) bị lược bỏ", 0),
    ("rs-main-verb-noun-clause", "Tìm động từ chính & dịch mệnh đề bổ nghĩa danh từ dài", "Cách dịch câu có mệnh đề bổ nghĩa danh từ dài", 0),
    ("rs-demonstratives", "Xác định từ chỉ thị こ・そ・あ", "Cách xác định Từ chỉ thị", 0),
    ("rs-connectors", "Hiểu từ nối (接続詞)", "Hệ thống Từ nối (接続詞)", 3),
    ("rs-implicit-negation", "Ẩn ý, phủ định kép, câu hỏi tu từ", "Các cách diễn đạt ẩn ý, phủ định kép", 0),
    ("rs-email-notice", "Quét nhanh Email & Thông báo", "Học cách quét nhanh: Người gửi", 0),
    ("rs-topic-sentence", "Tìm câu chủ đề & đuôi câu nêu ý kiến", "Học cách tìm câu Chủ đề (Topic sentence)", 0),
    ("rs-question-first", "Đọc câu hỏi trước → tìm từ khóa → đối chiếu paraphrase", "Rèn kỹ năng: đọc câu hỏi trước", 0),
    ("rs-short-timing", "Thời gian Đoạn ngắn: 2.5–3 phút/bài", "mỗi câu Đoạn ngắn trong phòng thi chỉ được làm trong", 0),
    ("rs-medium-structure", "Đoạn trung: 3 câu hỏi ↔ 3 đoạn, 7–8 phút/bài", "Mỗi bài có 3 câu hỏi, tương ứng với 3 đoạn", 0),
    ("rs-underline", "Câu hỏi gạch chân 「……」とあるが", "とあるが、どういうことか", 0),
    ("rs-long-question-by-question", "Trường văn: đọc từng câu hỏi rồi đọc đoạn tương ứng", "Mẹo làm bài: Đọc câu hỏi 1", 0),
    ("rs-long-timing", "Thời gian Trường văn: 12–14 phút/bài", "12–14 phút/bài", 0),
    ("rs-info-retrieval", "Tìm kiếm thông tin: điều kiện → loại trừ → đọc chú thích ※/注", "Chiến thuật ăn trọn 100% điểm bài này", 3),
    ("rs-exam-order", "Thứ tự làm bài Đọc hiểu trong phòng thi", "Thứ tự làm bài Đọc hiểu chuẩn trong phòng thi", 4),
    ("rs-distractors", "Loại đáp án nhiễu: phạm vi (すべて/全員/いつも) & đảo quan hệ nhân quả", "Tại sao mình lại phân vân giữa 2 đáp án", 0),
    ("rs-exam-day-section2", "Chiến thuật Tiết 2 ngày thi (Ngữ pháp 18–20 phút → Mondai 7 trước)", "**Tiết 2 (Ngữ pháp & Đọc hiểu - 70 phút)**", 2),
]


def build_strategies(days_out):
    out = []
    for sid, title, marker, span in READING_STRATEGY_MARKERS:
        n = find_line(marker, start=find_line("## II."))
        lines = list(range(n, n + span + 1))
        out.append({"id": sid, "titleVi": title, "dayNumber": _day_of_line(n, days_out),
                    "sourceLines": lines, "text": "\n".join(clean(L(k)) for k in lines)})
    return out


# --------------------------------------------------------------------------- main
def main():
    global LINES
    raw = SOURCE_PATH.read_bytes()
    text = raw.decode("utf-8")
    sha = hashlib.sha256(raw).hexdigest()
    LINES = text.splitlines()

    front = parse_front_matter()
    phases = parse_phases()
    days = parse_days()
    if len(days) != 25:
        issue("DAY_COUNT", "error", "structure", f"Tìm thấy {len(days)} ngày, cần 25.")

    days_out = []
    for d in days:
        ph = next(p for p in phases if p["startDay"] <= d["number"] <= p["endDay"])
        db, sections = build_day(d, ph, front["dailySchedule"])
        dt = date(YEAR, d["mm"], d["dd"])
        if db.regular:
            est = {"minutes": sum(r["minutes"] for r in front["dailySchedule"]), "rangeMinutes": [150, 210],
                   "basis": "daily_schedule_table", "note": "45 + 45 + 45 + 30 + 15 phút; khuyến nghị 2.5 – 3.5 giờ/ngày."}
        else:
            explicit = [t["estimatedMinutes"] for t in db.tasks
                        if t["estimatedMinutesSource"] == "day_text" and t["sourceSection"] is not None
                        and t["skill"] in ("mixed",)]
            if d["number"] == 25:
                mins = [int(m) for m in re.findall(r"\((\d+) phút\)", "\n".join(L(s["node"]["line"]) for s in sections))]
                est = {"minutes": sum(mins), "rangeMinutes": None, "basis": "day_text",
                       "note": f"{' + '.join(map(str, mins))} phút (buổi sáng + buổi chiều); buổi tối không ghi thời lượng."}
            else:
                est = {"minutes": sum(explicit), "rangeMinutes": None, "basis": "day_text",
                       "note": " + ".join(map(str, explicit)) + " phút (thi thử + chữa/ôn)."}
        days_out.append({
            "dayNumber": d["number"],
            "date": dt.isoformat(),
            "weekday": WEEKDAY_EN[dt.weekday()],
            "weekdayVi": d["weekdayVi"],
            "phase": ph["phase"],
            "title": d["title"],
            "headerLine": d["headerLine"],
            "objectives": [s["header"] for s in sections],
            "notes": [n_["text"] for n_ in d["notes"]],
            "noteLines": [n_["line"] for n_ in d["notes"]],
            "structure": "five_session" if db.regular else ("final_day" if d["number"] == 25 else "mock_exam_day"),
            "estimatedStudyTime": est,
            "taskIds": [t["id"] for t in db.tasks],
            "tasks": db.tasks,
        })

    # grammar: confusing pairs (Day 15) + star rules (Day 16) + similarPatterns links
    def norm_forms(structure):
        forms = set()
        for alt in structure.split("・"):
            alt = alt.strip()
            forms.add(re.sub(r"（[^）]*）", "", alt))
            forms.add(alt.replace("（", "").replace("）", ""))
        return forms

    pairs = []
    for topic in GRAMMAR_TOPICS:
        if topic["dayNumber"] != 15:
            continue
        for n in topic["sourceLines"]:
            pm = re.match(r"^\s*-\s*(Cặp \d+):\s*(.*)$", L(n))
            if not pm:
                continue
            members = []
            for mm in re.finditer(r"`([^`]+)`\s*\(([^)]*)\)", pm.group(2)):
                pid = next((p["id"] for p in GRAMMAR_PATTERNS if mm.group(1) in norm_forms(p["structure"])), None)
                members.append({"structure": mm.group(1), "noteVi": mm.group(2), "patternId": pid})
            pairs.append({"id": f"gp-{len(pairs) + 1:02d}", "label": pm.group(1), "members": members,
                          "dayNumber": 15, "taskId": topic["taskId"], "sourceLine": n, "rawText": L(n).strip()})
    for pr in pairs:
        ids = [m["patternId"] for m in pr["members"] if m["patternId"]]
        for p in GRAMMAR_PATTERNS:
            if p["id"] in ids:
                p["similarPatterns"] = uniq(p["similarPatterns"] + [i for i in ids if i != p["id"]])
    unresolved = [m["structure"] for pr in pairs for m in pr["members"] if not m["patternId"]]
    if unresolved:
        issue("GRAMMAR_PAIR_UNLINKED", "info", "completeness",
              "Các mẫu trong 'cặp dễ nhầm' (Ngày 15) không có mục tương ứng trong danh sách mẫu đã liệt kê: " + ", ".join(unresolved),
              day=15, suggestion="Sẽ tự liên kết khi người học nhập đủ 112 mẫu.")
    star_line = find_line("Nắm 5 quy tắc giải nhanh bài Dấu sao")
    star_rules = []
    k = star_line + 1
    while re.match(r"^\s+\d+\.\s", L(k)):
        star_rules.append({"n": int(re.match(r"^\s+(\d+)\.", L(k)).group(1)),
                           "text": clean(re.sub(r"^\s+\d+\.\s*", "", L(k))), "sourceLine": k})
        k += 1

    analyse(days_out, phases, front)
    strategies = build_strategies(days_out)
    all_tasks = [t for d in days_out for t in d["tasks"]]

    # attach issue ids to tasks
    for iss in ISSUES:
        for tid in iss["taskIds"]:
            t = next((x for x in all_tasks if x["id"] == tid), None)
            if t and iss["id"] not in t["flags"]:
                t["flags"].append(iss["id"])
        if not iss["taskIds"]:
            for t in all_tasks:
                if set(iss["sourceLines"]) & set(t["sourceLines"]) and iss["id"] not in t["flags"] and iss["severity"] != "info":
                    t["flags"].append(iss["id"])

    source_meta = {"file": SOURCE_NAME, "sha256": sha, "lineCount": len(LINES)}
    common = {"schemaVersion": SCHEMA_VERSION, "source": source_meta}

    # ---------------- roadmap.json
    roadmap = {
        **common,
        "meta": {**front, "startDate": days_out[0]["date"], "endDate": days_out[-1]["date"],
                 "dayCount": len(days_out), "taskCount": len(all_tasks),
                 "immutable": True,
                 "note": "Lộ trình gốc là bất biến. Điều chỉnh cá nhân được lưu riêng (IndexedDB: adjustments) và không ghi đè file này."},
        "textbooks": list(TEXTBOOKS.values()),
        "phases": phases,
        "days": days_out,
        "extractionStatus": {"status": "complete", "detail": "25/25 ngày; mọi dòng nội dung của Mục II được gán cho ít nhất 1 task (xem validation_report.json)."},
    }

    # ---------------- vocabulary.json
    units = {}
    for a in VOCAB_ASSIGN:
        u = units.setdefault(a["unit"], {"unit": a["unit"], "nameVi": a["unitName"], "start": a["start"], "end": a["end"],
                                         "assignedDays": [], "taskIds": []})
        u["start"], u["end"] = min(u["start"], a["start"]), max(u["end"], a["end"])
        u["assignedDays"].append(a["dayNumber"])
        u["taskIds"].append(a["taskId"])
    for u in units.values():
        u["itemRange"] = f"{u['start']}–{u['end']}"
        u["itemCount"] = u["end"] - u["start"] + 1
        u["priority"] = "high" if u["unit"] in (1, 2, 3, 4, 5, 7) else "medium"
        u["listedCount"] = sum(1 for v in VOCAB_ITEMS if v["unit"] == u["unit"])
    vocab_rev = [t["id"] for t in all_tasks if t["skill"] == "vocabulary" and t["taskType"] != "memorization"]
    vocabulary = {
        **common,
        "textbook": TEXTBOOKS["mimi_goi"],
        "totalItems": 880, "unitCount": 10,
        "units": sorted(units.values(), key=lambda x: x["unit"]),
        "dailyAssignments": VOCAB_ASSIGN,
        "items": VOCAB_ITEMS,
        "synonymPairs": SYNONYMS,
        "polysemousVerbs": POLYSEMOUS,
        "revisionTaskIds": vocab_rev,
        "srsDefaults": {"initialIntervalsMinutes": [10, 1440, 4320, 10080, 20160],
                        "labels": ["10 phút", "1 ngày", "3 ngày", "7 ngày", "14 ngày"],
                        "ratings": ["again", "hard", "good", "easy"], "basis": "master prompt Part 7C"},
        "extractionStatus": {
            "status": "partial",
            "listedItems": len(VOCAB_ITEMS),
            "missing": ["880 mục từ đầy đủ", "số thứ tự mục từ", "từ loại", "câu ví dụ + bản dịch", "audio"],
            "explanation": "Lộ trình chỉ liệt kê từ tiêu biểu cho mỗi dải. Dải số mục từ theo ngày đã đầy đủ (1–880, liên tục).",
        },
        "importTemplate": {"format": "csv", "columns": ["id", "itemNumber", "unit", "word", "reading", "meaningVi",
                                                        "partOfSpeech", "exampleSentence", "exampleTranslation",
                                                        "relatedExpressions", "audioFile", "source"]},
    }

    # ---------------- grammar.json
    gunits = []
    for u in range(1, 10):
        ss = [s for s in GRAMMAR_SESSIONS if s["unit"] == u]
        ex = next((e for e in GRAMMAR_EXERCISES if e["unit"] == u), None)
        gunits.append({"unit": u, "start": min(s["start"] for s in ss), "end": max(s["end"] for s in ss),
                       "patternRange": f"{min(s['start'] for s in ss)}–{max(s['end'] for s in ss)}",
                       "patternCount": max(s["end"] for s in ss) - min(s["start"] for s in ss) + 1,
                       "sessions": ss, "exercise": ex})
    required_topics = [
        {"key": "confusing_pairs", "labelVi": "Các cặp ngữ pháp dễ nhầm", "taskIds": [t["id"] for t in all_tasks if t["dayNumber"] == 15 and t["skill"] == "grammar"]},
        {"key": "star_ordering", "labelVi": "Sắp xếp dấu sao ★ (Mondai 2)", "taskIds": [t["id"] for t in all_tasks if t["dayNumber"] == 16 and t["skill"] == "grammar"]},
        {"key": "bunshou_no_bunpou", "labelVi": "文章の文法 (Mondai 3)", "taskIds": [t["id"] for t in all_tasks if t["dayNumber"] == 17 and t["skill"] == "grammar"]},
        {"key": "keigo", "labelVi": "敬語 — Kính ngữ & Khiêm nhường ngữ", "taskIds": [t["id"] for t in all_tasks if (t["dayNumber"] == 22 and t["skill"] == "grammar") or (t["dayNumber"] == 6 and t["skill"] == "listening")]},
        {"key": "giving_receiving", "labelVi": "Cho nhận (てくれる・てもらう・ていただく…)", "taskIds": [t["id"] for t in all_tasks if (t["dayNumber"] == 22 and t["skill"] == "grammar") or (t["dayNumber"] == 1 and t["skill"] == "reading")]},
        {"key": "passive_causative", "labelVi": "Bị động / Sai khiến / Sai khiến bị động", "taskIds": [t["id"] for t in all_tasks if (t["dayNumber"] == 22 and t["skill"] == "grammar") or (t["dayNumber"] == 9 and t["skill"] == "listening")]},
    ]
    grammar = {
        **common,
        "textbook": TEXTBOOKS["mimi_bunpou"],
        "totalPatterns": 112, "unitCount": 9,
        "units": gunits,
        "patterns": GRAMMAR_PATTERNS,
        "reviewNotes": GRAMMAR_NOTES,
        "revisionTopics": GRAMMAR_TOPICS,
        "requiredRevisionTopics": required_topics,
        "confusingPairs": pairs,
        "starRules": {"declaredCount": 5, "listedCount": len(star_rules), "rules": star_rules, "sourceLine": star_line},
        "masteryLevels": ["not_learned", "learning", "understood", "needs_review", "mastered"],
        "extractionStatus": {
            "status": "partial",
            "listedPatterns": len(GRAMMAR_PATTERNS),
            "missing": ["các mẫu chưa được liệt kê (xem GRAMMAR_COUNT_MISMATCH)", "formation", "usage",
                        "bản dịch câu ví dụ", "lỗi thường gặp", "độ liên quan đề JLPT"],
            "explanation": "Dải Mẫu 1–112 theo ngày đầy đủ và liên tục; nội dung từng mẫu chỉ có cấu trúc + nghĩa + ví dụ ngắn như trong lộ trình.",
        },
        "importTemplate": {"format": "csv", "columns": ["id", "patternNumber", "unit", "structure", "meaningVi", "formation",
                                                        "usage", "examples", "exampleTranslations", "similarPatterns",
                                                        "commonMistakes", "source"]},
    }

    # ---------------- kanji.json
    weeks = []
    for w in range(1, 7):
        ls = sorted([x for x in KANJI_LESSONS if x["week"] == w], key=lambda x: x["lesson"])
        weeks.append({"week": w, "lessons": ls, "test": next((x for x in KANJI_TESTS if x["week"] == w), None)})
    round2 = []
    for t in all_tasks:
        if t["skill"] == "kanji" and t["dayNumber"] in (18, 20):
            for m in re.finditer(r"Tuần (\d) \(trang (\d+)\)", t["originalText"]):
                round2.append({"week": int(m.group(1)), "page": m.group(2), "dayNumber": t["dayNumber"], "taskId": t["id"]})
    final_task = next(t for t in all_tasks if t["skill"] == "kanji" and t["dayNumber"] == 20)
    fm = re.search(r"Tổng kiểm tra cuối sách Soumatome \(trang (\d+)–(\d+)\)", clean(final_task["originalText"]))
    lesson_task = lambda w, l: next(x["taskId"] for x in KANJI_LESSONS if x["week"] == w and x["lesson"] == l)
    kanji_topics = [
        {"key": "similar_looking", "labelVi": "Chữ Kanji dễ nhìn nhầm nét", "taskIds": [lesson_task(6, 1)]},
        {"key": "prefixes", "labelVi": "Tiền tố 不・無・未・非", "taskIds": [lesson_task(6, 2)]},
        {"key": "suffixes", "labelVi": "Hậu tố 的・性・化・感", "taskIds": [lesson_task(6, 3)]},
        {"key": "special_readings", "labelVi": "Chữ có nhiều cách đọc đặc biệt", "taskIds": [lesson_task(6, 4)]},
        {"key": "long_vowel_sokuon_rendaku", "labelVi": "Trường âm, âm ngắt っ, biến âm (rendaku)", "taskIds": [t["id"] for t in all_tasks if t["skill"] == "kanji" and t["dayNumber"] == 18]},
        {"key": "homophones", "labelVi": "Đồng âm khác nghĩa (Mondai 2 Từ vựng)", "taskIds": [t["id"] for t in all_tasks if t["skill"] == "kanji" and t["dayNumber"] == 22]},
    ]
    kanji = {
        **common,
        "textbook": TEXTBOOKS["soumatome_kanji"],
        "totalKanji": 336, "lessonCount": 36, "weekCount": 6,
        "learningFocus": "Nhận diện mặt chữ + đọc âm ghép Jukugo; không luyện viết tay (Mục I.3).",
        "learningFocusSourceLine": find_line("tuyệt đối không tập viết tay"),
        "weeks": weeks,
        "round2Tests": round2,
        "finalTest": {"pageRange": f"{fm.group(1)}–{fm.group(2)}" if fm else None, "dayNumber": 20, "taskId": final_task["id"]},
        "words": KANJI_WORDS,
        "homophoneGroups": HOMOPHONES,
        "revisionTopics": kanji_topics,
        "characters": [],
        "extractionStatus": {
            "status": "partial",
            "listedWords": len(KANJI_WORDS),
            "missing": ["336 chữ Kanji riêng lẻ", "âm On/Kun từng chữ", "chữ dễ nhầm theo từng chữ", "ví dụ câu"],
            "explanation": "36 bài × 6 tuần, trang và bài Test tuần đầy đủ; nội dung là từ ghép tiêu biểu như trong lộ trình.",
        },
        "importTemplate": {"format": "csv", "columns": ["id", "kanji", "week", "lesson", "meaningVi", "onyomi", "kunyomi",
                                                        "jukugo", "jukugoMeaningsVi", "similarKanji", "source"]},
    }

    # ---------------- reading_tasks.json
    sm_catalog = []
    for r in READING:
        for rg in r["speedMasterRanges"]:
            for i in range(rg["from"], rg["to"] + 1):
                sm_catalog.append({"id": f"SM-{rg['type']}-{i}" if rg["type"] == "warmup" else f"SM-{i}",
                                   "number": i, "type": rg["type"], "typeJa": rg["typeJa"], "labelVi": rg["labelVi"],
                                   "dayNumber": r["dayNumber"], "taskId": r["taskId"]})
    reading = {
        **common,
        "textbooks": [TEXTBOOKS["shinkanzen_dokkai"], TEXTBOOKS["speed_dokkai"]],
        "phasePlan": {
            "declaredInSectionI": [{"days": "1–8", "book": "shinkanzen_dokkai", "parts": "Phần 1 & 2", "sourceLine": find_line("**Ngày 1 – Ngày 8**")},
                                   {"days": "9–22", "book": "speed_dokkai", "parts": "Phần 2 & 3", "sourceLine": find_line("**Ngày 9 – Ngày 22**")}],
            "actualSchedule": [
                {"days": sorted({r["dayNumber"] for r in READING if r["shinkanzen"]}), "book": "shinkanzen_dokkai"},
                {"days": sorted({r["dayNumber"] for r in READING if r["speedMasterRanges"] or r["speedMasterMockNumbers"]}), "book": "speed_dokkai"},
            ],
        },
        "passageTypes": [{"type": "short", "typeJa": "短文", "labelVi": "Đoạn ngắn", "exercises": "1–20"},
                         {"type": "medium", "typeJa": "中文", "labelVi": "Đoạn trung", "exercises": "21–32"},
                         {"type": "long", "typeJa": "長文", "labelVi": "Đoạn dài", "exercises": "33–38"},
                         {"type": "info_retrieval", "typeJa": "情報検索", "labelVi": "Tìm kiếm thông tin", "exercises": "39–45"}],
        "passageTypesSourceLine": find_line("Đoạn ngắn (短文 - Bài 1–20)"),
        "assignments": READING,
        "speedMasterCatalog": sm_catalog,
        "strategies": strategies,
        "extractionStatus": {"status": "complete_for_schedule",
                             "missing": ["nội dung bài đọc", "câu hỏi", "đáp án", "giải thích"],
                             "explanation": "Lịch, số bài, trang, thời gian và chiến thuật đầy đủ. Bài đọc phải do người học nhập."},
        "importTemplate": {"format": "json", "fields": ["id", "source", "textbookId", "exerciseRef", "passageType", "passage",
                                                        "questions[{id,question,choices[4],answerIndex,explanation,questionType}]",
                                                        "timeLimitMinutes"]},
    }

    # ---------------- listening_tasks.json
    mondai_catalog = [
        {"mondai": 1, "nameVi": "Nghe hiểu tác vụ", "sourceLine": find_line("Mondai 1: Nghe hiểu tác vụ")},
        {"mondai": 2, "nameVi": "Nghe hiểu điểm chính", "sourceLine": find_line("Mondai 2: Nghe hiểu điểm chính")},
        {"mondai": 3, "nameVi": "Nghe ý chính / Nghe hiểu khái quát", "sourceLine": find_line("Mondai 3: Nghe ý chính")},
        {"mondai": 4, "nameVi": "Phát ngôn theo tranh", "sourceLine": find_line("Mondai 4: Phát ngôn theo tranh")},
        {"mondai": 5, "nameVi": "Phản xạ nhanh", "sourceLine": find_line("Mondai 5: Phản xạ nhanh")},
    ]
    by_day_l = {}
    for r in LISTENING:
        by_day_l.setdefault(r["dayNumber"], []).append(r["id"])
    focus_topics = [
        ("immediate_response", "Phản xạ tức thì (Mondai 5)", [2, 12]),
        ("requests_permissions", "Xin phép / Nhờ vả / Đề nghị", [1]),
        ("honorifics", "Kính ngữ & Khiêm nhường ngữ", [6, 22]),
        ("giving_receiving", "Cho nhận (ていただく・てもらう…)", [9, 22]),
        ("speaker_intention", "Ý chính / Ý kiến người nói", [5, 11]),
        ("decision_changes", "Từ đổi ý (やっぱり・じゃなくて・まず・後で)", [3]),
        ("reasons_actions", "Nghe bắt hành động & lý do (Mondai 1 & 2)", [3, 4]),
        ("exceptions_conditions", "Điều kiện ngoại lệ (ただし・～を除いて・～に限る)", [13]),
    ]
    listening = {
        **common,
        "textbooks": [TEXTBOOKS["mimi_choukai"], TEXTBOOKS["speed_choukai"], TEXTBOOKS["jlpt_past_papers"]],
        "priorityOrder": [{"step": 1, "mondai": [4, 5]}, {"step": 2, "mondai": [1, 2]}, {"step": 3, "mondai": [3]}],
        "priorityOrderSourceLine": find_line("Luyện cuốn chiếu 5 Mondai"),
        "mondaiCatalog": mondai_catalog,
        "assignments": LISTENING,
        "focusTopics": [{"key": k, "labelVi": lab, "dayNumbers": ds,
                         "assignmentIds": [i for d_ in ds for i in by_day_l.get(d_, [])],
                         "classification": "derived_from_source_focus_text"} for k, lab, ds in focus_topics],
        "speedTraining": {"allowedSpeeds": [1.0, 1.1, 1.25],
                          "assigned": [{"dayNumber": r["dayNumber"], "assignmentId": r["id"], "speeds": r["playbackSpeeds"]}
                                       for r in LISTENING if r["playbackSpeeds"]]},
        "extractionStatus": {"status": "complete_for_schedule",
                             "missing": ["file audio", "script", "câu hỏi/đáp án"],
                             "explanation": "Lịch, Mondai, mục tiêu số câu và biểu hiện trọng tâm đầy đủ. Audio phải do người học tải lên."},
        "importTemplate": {"format": "json", "fields": ["id", "source", "textbookId", "mondai", "audioFile", "transcript",
                                                        "question", "choices", "answerIndex", "explanation", "keyExpressions"]},
    }

    # ---------------- mock_tests.json
    d19_mock = next(t for t in all_tasks if t["dayNumber"] == 19 and t["taskType"] == "mock_exam")
    vocab_line = next(n for n in d19_mock["sourceLines"] if "Phần 1 — Từ vựng" in L(n))
    vocab_mondai = [{"mondai": int(m.group(1)), "nameVi": m.group(2).strip(), "questions": int(m.group(3))}
                    for m in re.finditer(r"Mondai (\d): ([^;)]+?) (\d+) câu", L(vocab_line))]
    gr_line = next(n for n in d19_mock["sourceLines"] if "Phần 2 — Ngữ pháp" in L(n))
    gm_ = re.search(r"(\d+) phút cho Ngữ pháp.*?(\d+) phút cho Đọc hiểu", clean(L(gr_line)))
    full = []
    for d in days_out:
        for t in d["tasks"]:
            if t["taskType"] == "mock_exam" and t["skill"] == "mixed":
                num = int(re.search(r"Đề số (\d)", d["title"]).group(1))
                rev = [x["id"] for x in d["tasks"] if x["id"] != t["id"]]
                full.append({"id": f"mock-full-{num}", "number": num, "dayNumber": d["dayNumber"], "date": d["date"],
                             "taskId": t["id"], "followUpTaskIds": rev, "durationMinutes": t["timeLimitMinutes"],
                             "material": t["textbook"], "materialBasis": t["textbookBasis"],
                             "instructions": t["checklist"], "sourceLines": t["sourceLines"]})
    section_mocks = []
    for t in all_tasks:
        if t["skill"] in ("reading", "listening") and t["taskType"] in ("mock_exam", "error_review") and t["dayNumber"] <= 18 + 2 and t["textbookIds"] and t["dayNumber"] not in (22,):
            section_mocks.append({"taskId": t["id"], "dayNumber": t["dayNumber"], "skill": t["skill"], "taskType": t["taskType"],
                                  "title": t["title"], "textbookIds": t["textbookIds"], "timeLimitMinutes": t["timeLimitMinutes"]})
    for t in all_tasks:
        if t["dayNumber"] == 20 and t["skill"] in ("grammar", "kanji"):
            section_mocks.append({"taskId": t["id"], "dayNumber": 20, "skill": t["skill"], "taskType": t["taskType"],
                                  "title": t["title"], "textbookIds": t["textbookIds"], "timeLimitMinutes": None})
    tgt_line = find_line("Từ vựng: Đạt $\\ge 38/60$")
    exam_strats = [
        {"id": "es-reading-order", "titleVi": "Thứ tự làm Đọc hiểu (Mondai 7 → 4 → 5 → 6)", "dayNumber": 18,
         "sourceLines": list(range(find_line("Thứ tự làm bài Đọc hiểu chuẩn"), find_line("Thứ tự làm bài Đọc hiểu chuẩn") + 5))},
        {"id": "es-45-seconds", "titleVi": "Quy tắc 45 giây cho câu Ngữ pháp", "dayNumber": 21,
         "sourceLines": [find_line("quá 45 giây")]},
        {"id": "es-review-method", "titleVi": "Cách chữa đề & lập Sổ tay Lỗi sai", "dayNumber": 19,
         "sourceLines": [find_line("Tra toàn bộ các từ vựng nằm trong 4 đáp án"), find_line("Ghi lại các mẫu ngữ pháp làm sai")]},
        {"id": "es-distractors", "titleVi": "Phân tích đáp án nhiễu Đọc hiểu", "dayNumber": 21,
         "sourceLines": [find_line("Tại sao mình lại phân vân giữa 2 đáp án")]},
        {"id": "es-golden", "titleVi": "Chiến thuật Vàng trong phòng thi ngày 05/12", "dayNumber": 25,
         "sourceLines": list(range(find_line("Nhắc lại Chiến thuật Vàng"), find_line("Đi ngủ trước 22h30")))},
        {"id": "es-checklist", "titleVi": "Hành trang phòng thi", "dayNumber": 25,
         "sourceLines": list(range(find_line("Kiểm tra đầy đủ:"), find_line("Nhắc lại Chiến thuật Vàng")))},
    ]
    for s in exam_strats:
        s["text"] = "\n".join(clean(L(n), keep_indent=True) for n in s["sourceLines"])
    mocks = {
        **common,
        "examDate": EXAM_DATE.isoformat(),
        "examStructure": {
            "totalMinutes": 140,
            "sections": [
                {"id": "vocabulary", "nameJa": "文字・語彙", "nameVi": "Từ vựng", "minutes": 30, "mondai": vocab_mondai,
                 "totalQuestions": sum(m["questions"] for m in vocab_mondai), "sourceLine": vocab_line},
                {"id": "grammar_reading", "nameJa": "文法・読解", "nameVi": "Ngữ pháp & Đọc hiểu", "minutes": 70,
                 "internalSplit": {"grammarMinutes": int(gm_.group(1)) if gm_ else None,
                                   "readingMinutes": int(gm_.group(2)) if gm_ else None,
                                   "alternativeGuidance": "Ngày 25: Ngữ pháp tối đa 18–20 phút, phút thứ 20 chuyển sang Mondai 7.",
                                   "configurable": True},
                 "sourceLine": gr_line},
                {"id": "listening", "nameJa": "聴解", "nameVi": "Nghe hiểu", "minutes": 40,
                 "sourceLine": next(n for n in d19_mock["sourceLines"] if "Phần 3 — Nghe hiểu" in L(n))},
            ],
        },
        "officialPassingReference": {
            "totalPass": 95, "totalMax": 180, "sectionMinimum": 19, "sectionMax": 60,
            "scoringSections": [{"id": "language_knowledge", "nameVi": "Kiến thức ngôn ngữ (Từ vựng + Ngữ pháp)", "max": 60, "min": 19},
                                {"id": "reading", "nameVi": "Đọc hiểu", "max": 60, "min": 19},
                                {"id": "listening", "nameVi": "Nghe hiểu", "max": 60, "min": 19}],
            "sourceLine": tgt_line + 3,
            "note": "Điểm JLPT là điểm quy đổi (scaled). Mọi điểm tính trong ứng dụng chỉ là ƯỚC TÍNH.",
        },
        "roadmapTargets": {
            "dayNumber": 23, "sourceLines": [tgt_line, tgt_line + 1, tgt_line + 2],
            "targets": [{"id": "vocabulary", "labelVi": "Từ vựng", "minScore": 38, "max": 60, "questionHint": "đúng khoảng 24–26/35 câu"},
                        {"id": "grammar_reading", "labelVi": "Ngữ pháp & Đọc hiểu", "minScore": 40, "max": 60},
                        {"id": "listening", "labelVi": "Nghe hiểu", "minScore": 40, "max": 60}],
            "note": "Mục tiêu theo TIẾT THI của lộ trình — khác cách chia 3 phần chấm điểm chính thức (xem SCORE_SECTION_MAPPING).",
        },
        "fullMocks": full,
        "sectionMocksAndReviews": section_mocks,
        "examStrategies": exam_strats,
        "extractionStatus": {"status": "complete_for_schedule", "missing": ["câu hỏi đề thi"],
                             "explanation": "Lịch 4 đề Full, cấu trúc đề, mục tiêu điểm và chiến thuật đầy đủ. Đề thi phải do người học nhập."},
    }

    issues_doc = {**common, "issueCount": len(ISSUES),
                  "bySeverity": {s: sum(1 for i in ISSUES if i["severity"] == s) for s in ("error", "warning", "info")},
                  "issues": ISSUES}

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs = {"roadmap.json": roadmap, "vocabulary.json": vocabulary, "grammar.json": grammar, "kanji.json": kanji,
               "reading_tasks.json": reading, "listening_tasks.json": listening, "mock_tests.json": mocks,
               "extraction_issues.json": issues_doc}
    for name, obj in outputs.items():
        (OUT_DIR / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"days={len(days_out)} tasks={len(all_tasks)} vocab={len(VOCAB_ITEMS)} grammar={len(GRAMMAR_PATTERNS)} "
          f"kanjiWords={len(KANJI_WORDS)} reading={len(READING)} listening={len(LISTENING)} mocks={len(full)} "
          f"issues={issues_doc['bySeverity']}")


if __name__ == "__main__":
    sys.exit(main())
