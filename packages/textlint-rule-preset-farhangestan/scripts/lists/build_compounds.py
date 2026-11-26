"""
Write src/dict/spaced-compounds.json from select.py's list: compounds of فرهنگ
املایی written with a ZWNJ («جامعه‌شناس») that Wikipedia almost always writes as
one word, so the spaced form («جامعه شناس») is a mistake. Each entry keeps the
farhang page and the counts it was chosen by. Where the 2nd edition of دستور خط
overrides the farhang («بخشنامه», not «بخش‌نامه»), the book's form is the target
and the entry is marked "book".
Usage: python3 -I build_compounds.py lists.json > src/dict/spaced-compounds.json
"""
import json
import os
import sys

DICT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "dict")


def main(path):
    lists = json.load(open(path, encoding="utf-8"))
    farhang = json.load(open(os.path.join(DICT, "farhang-emlaei.json"), encoding="utf-8"))["entries"]
    overrides = json.load(open(os.path.join(DICT, "farhang-v2-overrides.json"), encoding="utf-8"))["overrides"]
    book_joined = {w for g in json.load(open(os.path.join(DICT, "book-joined.json"), encoding="utf-8"))["groups"] for w in g["words"]}
    entries = []
    for c in lists["compounds"]:
        row = farhang.get(c["form"].replace("‌", ""))
        if not row:
            continue
        key = c["form"].replace("‌", "")
        entry = {"spaced": c["spaced"], "to": c["form"], "page": row[2], "counts": [c["written"], c["spaced_n"]]}
        # the book wins over the farhang (and over Wikipedia's spelling)
        book = overrides.get(key) or (key if key in book_joined else None)
        if book and book != c["form"]:
            entry["to"] = book
            entry["book"] = True
        entries.append(entry)
    # Arabic compounds with «ال» (دستور خط: «قاضی‌القضات»، «آیت‌الله»): all two-part «X‌الY»
    # forms of the farhang, whatever Wikipedia does; written with a space they are always wrong
    # (نگارش و ویرایش، سمیعی، ص ۲۱۴–۲۱۵ agrees)
    have = {e["spaced"] for e in entries}
    for key, (pref, _others, page) in farhang.items():
        form = overrides.get(key) or pref
        if not form:
            continue
        parts = form.split("‌")
        if len(parts) != 2 or not parts[1].startswith("ال") or len(parts[0]) < 2 or len(parts[1]) < 4:
            continue
        spaced = f"{parts[0]} {parts[1]}"
        if spaced not in have:
            entries.append({"spaced": spaced, "to": form, "page": page, "counts": [], "arabic": True})
            have.add(spaced)
    entries.sort(key=lambda e: e["spaced"])
    json.dump({"source": "فرهنگ املایی خطّ فارسی (۱۳۹۴)؛ برگزیده با شمارش ویکی‌پدیای فارسی: "
                         "یکجا نوشته‌شده دست‌کم ۵۰ بار، با فاصله حداکثر ۲۰٪، کسرهٔ اضافه کمتر از ۱٪ (scripts/lists)",
               "entries": entries}, sys.stdout, ensure_ascii=False, indent=0)
    print(len(entries), file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
