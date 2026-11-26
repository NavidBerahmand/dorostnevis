"""
Summarise compare.cjs output: what kinds of orthographic edits people make on
Persian Wikipedia, and how many of each the preset catches.

Usage: python3 -I analyze.py a.annotated.jsonl [b.annotated.jsonl …] > report.md
"""
import collections
import difflib
import json
import re
import sys

DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
ZWNJ = "‌"
PUNCT = set(".،,؛;:!؟?«»\"'()-–—…")


def kind_of(before: str, after: str) -> str:
    if before.translate(DIGITS) == after.translate(DIGITS):
        return "رقم فارسی/لاتین"
    ops = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, before, after, autojunk=False).get_opcodes():
        if tag != "equal":
            ops.append((before[i1:i2], after[j1:j2]))
    dels = "".join(a for a, _ in ops)
    ins = "".join(b for _, b in ops)
    chars = set(dels + ins)
    if chars and chars <= set(" " + ZWNJ) | PUNCT and chars & PUNCT:
        return "فاصلهٔ نشانه‌ها"
    if chars & set("يكى") and set(dels) <= set("يكى" + ZWNJ + " "):
        return "ی/ک عربی"
    if "ٔ" in ins or "ۀ" in ins or re.search(r"ه\s*ی$", before) and after.endswith(("هٔ", "ۀ")):
        return "نشانهٔ اضافه"
    if chars & set("ئأإؤءٔ"):
        return "همزه"
    if chars <= {" ", ZWNJ}:
        if ZWNJ in ins and " " in dels:
            return "فاصله ← نیم‌فاصله"
        if ZWNJ in ins and not dels:
            return "پیوسته ← نیم‌فاصله"
        if " " in ins and not dels:
            return "جدا کردن (فاصله)"
        if " " in ins and ZWNJ in dels:
            return "نیم‌فاصله ← فاصله"
        if " " in dels and not ins:
            return "پیوسته کردن"
        if ZWNJ in dels and not ins:
            return "حذف نیم‌فاصله"
    if chars & PUNCT:
        return "نشانه‌گذاری"
    return "دیگر"


def main(paths):
    rows = []
    for p in paths:
        for line in open(p, encoding="utf-8"):
            rows.append(json.loads(line))
    # one edit per page: the same change repeated in later revisions counts once
    seen = set()
    uniq = []
    for r in rows:
        k = (r["page"], r["before"], r["after"])
        if k in seen:
            continue
        seen.add(k)
        r["type"] = kind_of(r["before"], r["after"])
        # rows from the de-duplicated set carry how many pages made the edit
        r["w"] = r.get("n_pages", 1)
        if "manual" in r:
            r["kind"] = "manual" if r["manual"] >= r["tool"] else "tool"
        uniq.append(r)

    VERDICTS = ["agree", "flagged", "other", "missed"]
    NAMES = {"agree": "خودکار، همان", "flagged": "فقط گزارش", "other": "تغییر دیگر", "missed": "ندیده"}
    print(f"# ویرایش‌های املایی انسانی ویکی‌پدیا در برابر واج‌بان\n")
    print(f"{len(uniq)} تغییر یکتا؛ {sum(r['w'] for r in uniq)} ویرایش در سطح صفحه.\n")
    for kind_filter, title in (("manual", "دستی"), ("tool", "با ابزار نیمه‌خودکار"), (None, "همه")):
        sub = [r for r in uniq if kind_filter is None or r.get("kind") == kind_filter]
        if not sub:
            continue
        W = lambda rs: sum(r["w"] for r in rs)
        print(f"\n## {title} ({W(sub)} ویرایش)\n")
        print("| نوع | تعداد | " + " | ".join(NAMES[v] for v in VERDICTS) + " | ابزار حاصل را دوباره عوض می‌کند |")
        print("|---|---|" + "---|" * len(VERDICTS) + "---|")
        by = collections.defaultdict(list)
        for r in sub:
            by[r["type"]].append(r)
        for t, rs in sorted(by.items(), key=lambda x: -W(x[1])):
            c = collections.Counter()
            for r in rs:
                c[r["verdict"]] += r["w"]
            tot = W(rs)
            und = sum(r["w"] for r in rs if r["undone"])
            cells = " | ".join(f"{c[v]} ({100 * c[v] // tot}٪)" for v in VERDICTS)
            print(f"| {t} | {tot} | {cells} | {und} |")

    def top(rs, n=25):
        w = collections.Counter()
        for r in rs:
            w[(r["before"], r["after"])] += r["w"]
        items = w.most_common(n)
        return items, {k: range(v) for k, v in w.items()}

    real = [r for r in uniq if r["type"] != "رقم فارسی/لاتین"]
    for verdict, title in (("missed", "پرتکرارترین موارد ندیده"), ("other", "پرتکرارترین موارد با تغییر دیگر")):
        sub = [r for r in real if r["verdict"] == verdict]
        items, pages = top(sub, 40)
        print(f"\n## {title} ({len(sub)})\n")
        for (b, a), n in items:
            print(f"- «{b}» ← «{a}» — {len(pages[(b, a)])} صفحه")
    sub = [r for r in real if r["undone"]]
    items, pages = top(sub, 30)
    print(f"\n## ابزار حاصل ویرایش را دوباره عوض می‌کند ({len(sub)})\n")
    for (b, a), n in items:
        print(f"- «{b}» ← «{a}» — {len(pages[(b, a)])} صفحه")


if __name__ == "__main__":
    main(sys.argv[1:])
