#!/usr/bin/env python3
"""
Turn the extracted «فرهنگ املایی» entries into the lookup table used by the
`dictionary` rule (src/dict/farhang-emlaei.json).

Usage:
    python3 scripts/extract_farhang_emlaei.py فرهنگ.pdf > /tmp/entries.json
    python3 scripts/build_farhang_data.py /tmp/entries.json
    npm run build && node scripts/check-farhang-conflicts.cjs   # applies the 2nd edition

Only one-word entries are kept (no space in any form): the rule compares a
word with the dictionary form of the same letters («آب‌پاش»، «آبپاش»), and
multi-word entries («آبِ آلوده») are phrases, not spelling variants.

Compound infinitives («نگه‌داشتن»، «جازدن») are dropped: the dictionary
follows the 1st edition there, and the 2nd edition writes them with a full
space («نگه داشتن»), which the compound-verbs rule already handles.
"""
import json
import os
import sys

ZWNJ = "‌"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "dict", "farhang-emlaei.json")
PREVERBS = ("بر", "در", "باز", "فرا", "فرو", "ور", "وا")


def skeleton(form: str) -> str:
    return form.replace(ZWNJ, "")


def is_compound_infinitive(form: str) -> bool:
    if not form.endswith(("دن", "تن")):
        return False
    if ZWNJ not in form:
        return False
    return not form.startswith(PREVERBS)


def main(path: str) -> None:
    entries = json.load(open(path, encoding="utf-8"))
    table: dict[str, dict] = {}
    skipped = 0
    for e in entries:
        forms = [f for group in e["forms"] for f in group]
        if any(" " in f for f in forms) or not forms:
            continue
        if any(is_compound_infinitive(f) for f in forms):
            skipped += 1
            continue
        preferred = e["forms"][0][0]
        key = skeleton(preferred)
        row = table.setdefault(key, {"preferred": [], "valid": [], "pages": []})
        if preferred not in row["preferred"]:
            row["preferred"].append(preferred)
        for f in forms:
            if f not in row["valid"]:
                row["valid"].append(f)
        if e["page"] not in row["pages"]:
            row["pages"].append(e["page"])
    # compact: {skeleton: [preferred, [other valid forms], page]}
    compact = {}
    for key, row in sorted(table.items()):
        # two different entries with the same letters but different spacing
        # (آبرو «honour» / آب‌رو «water channel»): all are valid, none preferred
        ambiguous = len(row["preferred"]) > 1
        others = row["valid"] if ambiguous else [f for f in row["valid"] if f != row["preferred"][0]]
        compact[key] = [None if ambiguous else row["preferred"][0], others, row["pages"][0]]
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "source": "فرهنگ املایی خطّ فارسی، فرهنگستان زبان و ادب فارسی، ۱۳۹۴",
                "note": "[preferred form or null when two entries share the letters, other valid forms, page]",
                "entries": compact,
            },
            fh,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        fh.write("\n")
    print(f"{len(compact)} one-word entries; {skipped} compound infinitives skipped", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
