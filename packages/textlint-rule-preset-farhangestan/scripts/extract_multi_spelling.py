#!/usr/bin/env python3
"""
Extract «فهرست واژه‌های عامّ/خاصّ دو یا چنداملایی» from the دستور خطّ فارسی
(ویراست دوم) .docx into src/dict/multi-spelling.json.

Usage:
    python3 scripts/extract_multi_spelling.py path/to/book.docx > src/dict/multi-spelling.json

Requires pandoc on PATH. The .docx itself is not part of this repository.

What is kept: rows whose variants map unambiguously to the Academy's
preferred form(s). What is skipped, and why:
  - rows with a sense note in parentheses (طاق «سقف» vs تاق «فرد»): the
    right spelling depends on meaning;
  - rows where every variant is accepted (توفان/طوفان);
  - variants that are a different, valid word (خطا, حیز, طاب) — see EXCLUDE;
  - variants written with harakat in the book (آخُر, غُرُق): without the
    vowel marks they are ordinary words (آخر, غرق), so they are never matched.
"""
import html
import json
import re
import subprocess
import sys

ZWNJ = "\u200c"
MARKS = re.compile(r"[ً-ٰٟ]")
FOOTNOTE = re.compile(r"[0-9۰-۹]+")

# Variants that are valid, different words: never "correct" them.
EXCLUDE = {
    "حیز",   # حیّز (space, extent)
    "خطا",   # error
    "طاب",   # طاب ثراه
    "لغ",    # too short / ambiguous
    "آغا",   # kept in historical names (آغامحمدخان), see the note under آقا
    "تارم",  # also تار + ـَم (my tar)
}

TABLES = {
    "common": "دستور خط، فهرست واژه‌های عامّ دو یا چنداملایی، ص ۷۳",
    "proper": "دستور خط، فهرست نام‌های خاصّ دو یا چنداملایی، ص ۸۲",
}


def clean(s: str) -> str:
    """Text of a cell, with footnote numbers removed and ZWNJ normalized (marks kept)."""
    s = html.unescape(re.sub(r"<[^>]+>", "", s))
    s = s.replace("\u200f", ZWNJ).replace("\u200e", "")
    s = FOOTNOTE.sub("", s)
    s = re.sub(ZWNJ + "+", ZWNJ, s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def strip_marks(s: str) -> str:
    return MARKS.sub("", s).strip(ZWNJ)


def split_forms(s: str) -> list[str]:
    return [f.strip().strip(ZWNJ) for f in s.split("/") if f.strip()]


def main(path: str) -> None:
    out = subprocess.run(["pandoc", path, "-t", "html"], capture_output=True, text=True, check=True).stdout
    tables = [
        t for t in re.findall(r"<table.*?</table>", out, re.S)
        if "مرجّح" in t or "مرجح" in t
    ]
    if len(tables) != 2:
        sys.exit(f"expected 2 multi-spelling tables, found {len(tables)}")

    entries = []
    for kind, table in zip(("common", "proper"), tables):
        for row in re.findall(r"<tr.*?</tr>", table, re.S)[1:]:
            cells = [clean(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]
            if len(cells) < 2 or not cells[0] or not cells[1]:
                continue
            variants_raw, preferred_raw = cells[0], cells[1]
            variants_raw = re.sub(r"\(نیز نک\.[^)]*\)", "", variants_raw).strip()
            if "(" in variants_raw or "(" in preferred_raw:
                continue  # sense-specific spelling
            preferred = [strip_marks(f) for f in split_forms(preferred_raw)]
            variants = split_forms(variants_raw)
            wrong = [
                strip_marks(v) for v in variants
                if not MARKS.search(v)
                and strip_marks(v) not in preferred
                and strip_marks(v) not in EXCLUDE
            ]
            if not wrong:
                continue
            entries.append({"from": wrong, "to": preferred[0], "source": TABLES[kind]})

    # A form that is "wrong" in one row but preferred in another, or that maps
    # to two different targets, is ambiguous: drop it.
    preferred_all = {e["to"] for e in entries}
    targets: dict[str, set[str]] = {}
    for e in entries:
        for f in e["from"]:
            targets.setdefault(f, set()).add(e["to"])
    for e in entries:
        e["from"] = [f for f in e["from"] if f not in preferred_all and len(targets[f]) == 1]
    entries = [e for e in entries if e["from"]]

    json.dump({"entries": entries}, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main(sys.argv[1])
