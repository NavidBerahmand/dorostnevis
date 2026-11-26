"""
Write src/dict/spaced-compounds.json: compounds of فرهنگ املایی (with a ZWNJ, «جامعه‌شناس»,
or joined, «بخشنامه») written with a space («جامعه شناس»), which is wrong whatever
Wikipedia does. The corpus only decides how sure a spaced form is a mistake:

  red     the spaced form cannot be two words: a part is no standalone word («دانش آموز»:
          «آموز» is bound) and the pair was never seen with an ezafe mark
  yellow  it can also be two words («کار خانه» = «کارِ خانه»، «خانه دار» in «خانهٔ دار»):
          both parts are standalone words (a noun that often starts a phrase, or a word often
          after an ezafe, or in Hazm's noun/adjective lists), or the pair occurs with «ِ/هٔ/ۀ»
  left out  a part is a preposition, conjunction or the like («به نام»، «در گذشته»: the book's
          own rules on those words decide), or the last part is a verb form («قرار داد»،
          «شناخته شده»), or another rule of the book already covers the spaced form
          (scripts/lists/check-compound-overlap.cjs)

The entries chosen before (1.3.1, by Wikipedia counts) keep their place and their colour.
Where the 2nd edition of دستور خط overrides the farhang («بخشنامه», not «بخش‌نامه»), the
book's form is the target.

Pipeline (counts on Persian Wikipedia, articles.jsonl from scripts/ezafe-model/extract_wiki.py):
  python3 -I count_all.py articles.jsonl full.json      # spaced/ezafe counts, unigrams, phrase starts
  python3 -I ezprev.py articles.jsonl ezprev.json       # how often a word follows an ezafe mark
  python3 -I classify.py full.json > classified.json
  python3 -I select.py counts.json > lists.json          # the 1.3.1 selection (count.py)
  python3 -I build_compounds.py lists.json classified.json > ../../src/dict/spaced-compounds.json
  node check-compound-overlap.cjs                       # drops new entries another rule covers
"""
import json
import os
import sys

DICT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "dict")
ZWNJ = "‌"


def selected_131(lists_path):
    """The 1.3.1 list: farhang compounds Wikipedia writes as one word (select.py), and all «X‌الY»."""
    lists = json.load(open(lists_path, encoding="utf-8"))
    farhang = json.load(open(os.path.join(DICT, "farhang-emlaei.json"), encoding="utf-8"))["entries"]
    overrides = json.load(open(os.path.join(DICT, "farhang-v2-overrides.json"), encoding="utf-8"))["overrides"]
    book_joined = {w for g in json.load(open(os.path.join(DICT, "book-joined.json"), encoding="utf-8"))["groups"] for w in g["words"]}
    entries = []
    for c in lists["compounds"]:
        row = farhang.get(c["form"].replace(ZWNJ, ""))
        if not row:
            continue
        key = c["form"].replace(ZWNJ, "")
        entry = {"spaced": c["spaced"], "to": c["form"], "page": row[2], "counts": [c["written"], c["spaced_n"]]}
        # the book wins over the farhang (and over Wikipedia's spelling)
        book = overrides.get(key) or (key if key in book_joined else None)
        if book and book != c["form"]:
            entry["to"] = book
            entry["book"] = True
        entries.append(entry)
    # Arabic compounds with «ال» (دستور خط: «قاضی‌القضات»، «آیت‌الله»): all two-part «X‌الY»
    # forms of the farhang; written with a space they are always wrong
    # (نگارش و ویرایش، سمیعی، ص ۲۱۴–۲۱۵ agrees)
    have = {e["spaced"] for e in entries}
    for key, (pref, _others, page) in farhang.items():
        form = overrides.get(key) or pref
        if not form:
            continue
        parts = form.split(ZWNJ)
        if len(parts) != 2 or not parts[1].startswith("ال") or len(parts[0]) < 2 or len(parts[1]) < 4:
            continue
        spaced = f"{parts[0]} {parts[1]}"
        if spaced not in have:
            entries.append({"spaced": spaced, "to": form, "page": page, "counts": [], "arabic": True})
            have.add(spaced)
    entries.sort(key=lambda e: e["spaced"])
    return entries


# «ه» that is a consonant, not the silent one: «راه آهن» has no hidden ezafe
PRONOUNCED_HE = set("راه شاه سیاه ته گاه کوه ماه چاه به ده مه که چه نه جاه گناه پگاه تباه کلاه نگاه آگاه سپاه پناه".split())
# both readings are the same word: «رئیسِ جمهور» is the president either way
SAME_MEANING = {"رئیس جمهور", "رئیس جمهوری"}


def arabic_al(spaced):
    """«رسول الله»، «فارغ التحصیل»: an Arabic «ال» compound is one word whatever the reading."""
    return any(p.startswith("ال") and len(p) >= 4 for p in spaced.split(" ")[1:])


def main(lists_path, path):
    classified = {x["spaced"]: x for x in json.load(open(path, encoding="utf-8"))}
    entries = selected_131(lists_path)
    # The 1.3.1 entries stay, with their targets, and stay red unless they can also be two
    # words: the pair is seen with an ezafe mark («پایانِ نامه»، «میانِ سال‌ها»), or the first
    # part ends in a silent «ه», after which the ezafe is rarely written, and both parts are
    # standalone words («خانه دار» = «خانهٔ دار»). Those are yellow now. Never the «ال» ones.
    for e in entries:
        x = classified.get(e["spaced"])
        if not x or e.get("arabic") or arabic_al(e["spaced"]) or e["spaced"] in SAME_MEANING or not x["amb"]:
            continue
        first = e["spaced"].split(" ")[0]
        if x["ez"] >= 1 or (first.endswith("ه") and first not in PRONOUNCED_HE and x["xfree"] and x["yfree"]):
            e["amb"] = True
    classified = list(classified.values())
    have = {e["spaced"] for e in entries}
    more = []
    stats = {"red": 0, "yellow": 0, "function-word": 0, "verb": 0}
    for x in sorted(classified, key=lambda x: x["spaced"]):
        if x["spaced"] in have:
            continue
        if x["excluded"]:
            stats[x["excluded"]] += 1
            continue
        amb = x["amb"] and not arabic_al(x["spaced"])
        kind = 1 if amb else 0
        if x["to"] != x["form"]:
            kind |= 2  # the book's form, not the farhang's
        # the target, short: 0 = the spaced form with ZWNJs, 1 = joined, else as written
        to = 0 if x["to"] == x["spaced"].replace(" ", ZWNJ) else 1 if x["to"] == x["spaced"].replace(" ", "") else x["to"]
        row = [x["spaced"], to, x["page"] or 0, kind]
        if (x["amb_suf"] and not arabic_al(x["spaced"])) or x["verb_suf"]:
            row += ["" if arabic_al(x["spaced"]) else ",".join(x["amb_suf"]), ",".join(x["verb_suf"])]
        more.append(row)
        have.add(x["spaced"])
        stats["yellow" if amb else "red"] += 1
    json.dump({
        "source": "فرهنگ املایی خطّ فارسی (۱۳۹۴)؛ همهٔ ترکیب‌های نیم‌فاصله‌دار و پیوستهٔ فرهنگ؛ رنگ با شمارش ویکی‌پدیای فارسی (scripts/lists/build_compounds.py)",
        "note": "entries: chosen in 1.3.1 (red). more: [spaced, to (0: with ZWNJs, 1: joined), page, kind (1 = can also be two words: yellow; 2 = the book's form), suffixes that make it two words, suffixes that make it a verb]",
        "entries": entries,
        "more": more,
    }, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    print(json.dumps(stats), file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
