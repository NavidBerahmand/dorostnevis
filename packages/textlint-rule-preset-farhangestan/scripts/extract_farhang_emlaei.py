#!/usr/bin/env python3
"""
Extract «فرهنگ املایی خطّ فارسی» (فرهنگستان زبان و ادب فارسی، چاپ ۱۳۹۴) from its PDF.

Usage:
    pip install pymupdf fonttools
    python3 scripts/extract_farhang_emlaei.py فرهنگ.pdf > entries.json

The PDF is typeset in legacy (non-Unicode) Persian fonts, so its text layer is
gibberish. Every glyph was read from rendered glyph sheets and is mapped here
by glyph name (names are shared by all font subsets in the file). Whether a
glyph joins the next letter (initial/medial form) comes from its outline
touching the left edge at the baseline; a joining letter in a non-joining
form inside a word therefore marks a ZWNJ, so the book's half-spaces are
recovered exactly. The book also uses a narrow space between مضاف and
مضاف‌الیه («آبِ آلوده»); it is output as a normal space.

Output: a JSON list of entries
    {"page": 600, "text": "نبضگاه/نبض‌گاه", "groups": [[...forms...]], "kind": "slash", "note": null}
See parse_entry() for the notation.
"""
import io
import json
import re
import sys

import pymupdf
from fontTools.cffLib import CFFFontSet

# The table below is keyed by glyph position in the main font
# (EALOKG+TT3832o00, first used on page 23), then converted to glyph names.
MAIN_FONT = "TT3832o00"
FIRST_PAGE = 23  # the word list starts here; pages before are the introduction
MAIN_CHARSET = []
SKIP_FONTS = ("TT3831o00", "TT3833o00")  # section-letter headings, running header

ZWNJ = "\u200c"
# glyph id (index in the CFF charset, .notdef = 0) -> (text, joins_to_next)
# Letters are read from the rendered glyph sheets; "joins_to_next" comes from
# the glyph outline touching the left edge at baseline (initial/medial forms).
G = {}


def g(idx, text, joins=False):
    G[idx + 1] = (text, joins)


# isolated / final forms (do not join the next letter)
for i, t in [(0, "ه"), (3, "د"), (5, "آ"), (6, "ف"), (8, "ا"), (9, "ب"), (10, "پ"), (11, "ت"), (12, "ث"),
             (13, "ج"), (14, "چ"), (15, "ح"), (16, "خ"), (17, "د"), (18, "ذ"), (19, "ر"), (20, "ز"),
             (21, "ژ"), (22, "س"), (23, "ش"), (24, "ص"), (25, "ض"), (26, "ط"), (27, "ظ"), (28, "ع"),
             (29, "غ"), (30, "ف"), (31, "ق"), (32, "ک"), (33, "گ"), (34, "ل"), (35, "م"), (36, "ن"),
             (37, "و"), (39, "ی"), (40, "الله"), (61, "ا"), (62, "آ"), (63, "أ"), (64, "أ"), (65, "اً"),
             (66, "اً"), (67, "ب"), (70, "پ"), (73, "ت"), (76, "ث"), (79, "ج"), (82, "چ"), (84, "ح"),
             (87, "خ"), (90, "ذ"), (91, "ر"), (92, "ز"), (93, "ژ"), (94, "س"), (97, "ش"), (100, "ص"),
             (102, "گ"), (105, "ل"), (106, "ۀ"), (107, "ی"), (108, "لا"), (111, "ة"), (112, "ؤ"),
             (116, "ة"), (119, "و"), (122, "ء"), (123, "ه"), (125, "ک"), (127, "م"), (128, "لاً"),
             (129, "لاً"), (131, "لا"), (132, "ؤ"), (146, "ع"), (147, "ض"), (152, "ن"), (156, "ۀ"),
             (159, "ق"), (163, "ط"), (168, "ظ"), (169, "غ")]:
    g(i, t)
# initial / medial forms (join the next letter)
for i, t in [(1, "م"), (4, "ق"), (7, "ل"), (38, "ه"), (68, "ب"), (69, "ب"), (71, "پ"), (72, "پ"),
             (74, "ت"), (75, "ت"), (77, "ث"), (78, "ث"), (80, "ج"), (81, "ج"), (83, "چ"), (85, "ح"),
             (86, "ح"), (88, "خ"), (89, "خ"), (95, "س"), (96, "س"), (98, "ش"), (99, "ش"), (101, "ص"),
             (103, "گ"), (104, "گ"), (109, "چ"), (110, "ه"), (113, "م"), (114, "ص"), (118, "ی"),
             (120, "ی"), (121, "ل"), (124, "ن"), (130, "ئ"), (133, "ئ"), (134, "ـ"), (148, "ع"),
             (149, "ع"), (150, "ک"), (151, "ک"), (153, "ن"), (154, "ف"), (155, "ط"), (157, "ف"),
             (158, "غ"), (160, "ض"), (161, "ظ"), (162, "ق"), (164, "غ"), (165, "ط"), (166, "ض"),
             (167, "ظ")]:
    g(i, t, True)
# punctuation and digits (no joining)
for i, t in [(41, ")"), (42, "("), (43, "،"), (44, "/"), (45, "."), (56, ":"), (57, "؛"),
             (58, "QUOTE_A"), (59, "="), (60, "QUOTE_B")]:
    g(i, t)
for d in range(10):
    g(46 + d, "۰۱۲۳۴۵۶۷۸۹"[d])
# zero-width marks
MARKS = {2: "ّ", 117: "َ", 115: "ِ", 139: "َ", 136: "ً", 144: "ٍ",
         137: "ُ", 140: "ٌ", 138: "ْ", 141: "َّ", 142: "ُّ",
         126: "ٰ", 143: "ٖ", 135: "ٔ", 145: ""}
for i, t in MARKS.items():
    G[i + 1] = (t, None)

PUNCT = {"(", ")", "QUOTE_A", "QUOTE_B", "،", "/", ".", ":", "؛", "="}
NON_JOINING_LETTERS = set("اآأإدذرزژوؤۀةء") | {"لا", "لاً", "اً", "الله"}


KASRA = ("\u0650", "\u064D")


def decode_line(chars, size):
    """chars: list of (glyph_id, x0, x1, is_mark) -> logical text.

    Gaps (relative to the font size): > 0.3 is a word space; 0.08–0.3 is
    either the book's narrow space between مضاف and مضاف‌الیه («آبِ آلوده»)
    or a kerning gap after a non-joining letter («آب‌اکسیژن»). A kasra on the
    previous letter, or a joining letter before the gap, means it is a space.
    """
    bases = sorted([c for c in chars if not c[3]], key=lambda c: -c[2])
    marks = [c for c in chars if c[3]]
    # attach each mark to the base glyph whose box contains the mark's ink centre
    attached = {i: [] for i in range(len(bases))}
    for gid, x0, x1, _ in marks:
        centre = x0 + size * 0.2
        best = min(range(len(bases)), key=lambda i: 0 if bases[i][1] <= centre <= bases[i][2]
                   else min(abs(bases[i][1] - centre), abs(bases[i][2] - centre))) if bases else None
        if best is not None:
            attached[best].append(BY_NAME[gid][0])
    out, unknown = [], []
    prev = None  # (text, joins, x0, marks)
    for i, (gid, x0, x1, _) in enumerate(bases):
        text, joins = BY_NAME.get(gid, (f"⟨{gid}⟩", False))
        if gid not in BY_NAME:
            unknown.append(gid)
        if prev is not None:
            gap = (prev[2] - x1) / size
            prev_letter_nonjoining = prev[0] in NON_JOINING_LETTERS or prev[0][-1:] in NON_JOINING_LETTERS
            if gap > 0.3:
                out.append(" ")
            elif gap > 0.08 and (any(m in KASRA for m in prev[3]) or not prev_letter_nonjoining or prev[0] in PUNCT):
                out.append(" ")
            elif not prev[1] and not prev_letter_nonjoining and prev[0] not in PUNCT and text not in PUNCT \
                    and text != "ء" \
                    and not prev[0].isdigit() and not text[:1].isdigit():
                out.append(ZWNJ)
        out.append(text)
        out.extend(attached[i])
        prev = (text, joins, x0, attached[i])
    return "".join(out), unknown


BY_NAME = {}
_charsets = {}


def finish_tables(doc):
    for pno in range(len(doc)):
        for f in doc[pno].get_fonts(full=True):
            if f[3].endswith(MAIN_FONT):
                MAIN_CHARSET.extend(charset(doc, f[0]))
                break
        if MAIN_CHARSET:
            break
    for gid, value in G.items():
        BY_NAME[MAIN_CHARSET[gid]] = value
    BY_NAME["question"] = ("؟", False)


def charset(doc, xref):
    if xref not in _charsets:
        _, ext, _, buf = doc.extract_font(xref)
        names = []
        if ext == "cff":
            cff = CFFFontSet()
            cff.decompile(io.BytesIO(buf), None)
            names = list(cff[cff.fontNames[0]].charset)
        _charsets[xref] = names
    return _charsets[xref]


def page_entries(page, main_font=None):
    """Group glyphs into entries: rows (by baseline) x columns."""
    chars, marks = [], []
    # texttrace reports the font name without the subset prefix («EALOKG+»)
    xrefs = {}
    for f in page.get_fonts(full=True):
        xrefs[f[3]] = f[0]
        xrefs[f[3].split("+", 1)[-1]] = f[0]
    for span in page.get_texttrace():
        font = span["font"]
        if any(k in font for k in SKIP_FONTS) or font not in xrefs:
            continue
        names = charset(page.parent, xrefs[font])
        if not names:
            continue  # front matter (TrueType) fonts
        for uni, gid, origin, bbox in span["chars"]:
            name = names[gid] if 0 <= gid < len(names) else f"gid{gid}"
            item = (name, bbox[0], bbox[2], origin[1], span["size"])
            (marks if BY_NAME.get(name, ("", False))[1] is None else chars).append(item)
    if not chars:
        return []
    size = chars[0][4]
    chars.sort(key=lambda c: c[3])
    rows, cur = [], [chars[0]]
    for c in chars[1:]:
        if c[3] - cur[-1][3] <= size * 0.3:
            cur.append(c)
        else:
            rows.append(cur)
            cur = [c]
    rows.append(cur)
    baselines = [sum(c[3] for c in r) / len(r) for r in rows]
    for m in marks:  # marks may sit on a slightly different baseline
        k = min(range(len(rows)), key=lambda i: abs(baselines[i] - m[3]))
        if abs(baselines[k] - m[3]) <= size * 1.2:
            rows[k].append(m)
    entries = []
    for row in rows:
        row.sort(key=lambda c: c[1])
        groups, g_ = [], [row[0]]
        for c in row[1:]:
            if c[1] - max(x[2] for x in g_) > size * 1.5:
                groups.append(g_)
                g_ = [c]
            else:
                g_.append(c)
        groups.append(g_)
        for grp in groups:
            if all(BY_NAME.get(c[0], ("", False))[1] is None for c in grp):
                continue  # stray marks
            entries.append((max(c[2] for c in grp), grp[0][3], grp))
    entries.sort(key=lambda e: (-round(e[0] / (size * 6)), e[1]))
    return [(e[1], [(c[0], c[1], c[2], BY_NAME.get(c[0], ("", False))[1] is None) for c in e[2]], size) for e in entries]


MARKS_RE = re.compile("[\u064B-\u065F\u0670]")


def merge_lines(rows):
    """Join entries wrapped onto two lines («آب‌دوغ‌خیار ـ» + «آبدوغ‌خیار», «… (نوعی گلابی)»)."""
    out = []
    for page, text in rows:
        text = re.sub(r"\s+([،/])", r"\1", text).strip()
        if out and (out[-1][1].endswith("ـ") or text.startswith("(")):
            sep = " " if out[-1][1].endswith("ـ") and not out[-1][1].endswith(" ـ") else " "
            prev = out[-1][1]
            if prev.endswith("ـ") and not prev.endswith(" ـ"):
                prev = prev[:-1].rstrip() + " ـ"
            out[-1] = (out[-1][0], prev + sep + text)
        else:
            out.append((page, text))
    return out


def expand_optional(form):
    """«آب‌آزما(ی)» → [«آب‌آزما», «آب‌آزمای»]; «درهم(و)برهم» → both."""
    m = re.search(r"\(([^()]{1,2})\)", form)
    if not m:
        return [form]
    with_ = form[: m.start()] + m.group(1) + form[m.end():]
    without = form[: m.start()] + form[m.end():]
    return expand_optional(without) + expand_optional(with_)


def parse_entry(text):
    """
    Notation (introduction of the dictionary, ص ۱۹–۲۰):
      «/»  two forms, neither preferred          → kind "slash"
      «،»  the first form is preferred           → kind "comma"
      «ـ»  the first follows دستور خط, the second
           is more common                        → kind "dash"
      «(…)» a note (meaning, part of speech), or an optional letter «(ی)».
    """
    note = None
    m = re.search(r"\s*\((?:=\s*)?([^()]{3,})\)\s*$", text)
    if m:
        note = m.group(1).strip()
        text = text[: m.start()].strip()
    kind = "single"
    if " ـ " in text:
        kind = "dash"
    elif "،" in text:
        kind = "comma"
    elif "/" in text:
        kind = "slash"
    groups = []
    for part in re.split(r"\s+ـ\s+|،|/", text):
        part = MARKS_RE.sub("", part).strip(" \u200c")
        part = re.sub(r"(?<=\S)ـ+(?=\S)", "", part)  # kashida used for justification
        if part:
            groups.append(expand_optional(part))
    return {"text": text, "kind": kind, "forms": groups, "note": note}


def main():
    path = sys.argv[1]
    doc = pymupdf.open(path)
    finish_tables(doc)
    rows = []
    for pno in range(FIRST_PAGE - 1, len(doc)):
        for _y, grp, size in page_entries(doc[pno]):
            text, unknown = decode_line(grp, size)
            if unknown:
                print(f"page {pno + 1}: unknown glyphs {unknown}", file=sys.stderr)
            if text.strip():
                rows.append((pno + 1, text))
    entries = []
    for page, text in merge_lines(rows):
        e = parse_entry(text)
        if e["forms"]:
            e["page"] = page
            entries.append(e)
    json.dump(entries, sys.stdout, ensure_ascii=False, indent=0)
    sys.stdout.write("\n")
    print(f"{len(entries)} entries", file=sys.stderr)


if __name__ == "__main__":
    main()
