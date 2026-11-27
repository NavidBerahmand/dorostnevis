#!/usr/bin/env python3
"""
Drop from src/dict/spaced-compounds.json the yellow compounds of a number and a noun that running
text writes as two words nearly always (1.6.4): «یک گونه» (4,647 times spaced, never «یک‌گونه»),
«یک زبان»، «دو هفته»، «سی سال»، «پنج روز». The farhang has «یک‌گونه»، «دوهفته»، «پنج‌روز», but in a
sentence the two words are a number and what it counts («یک گونه از …»، «پنج روز بستری»): of the
59 wrong cards among 320 judged yellow ones of 1.6.3, 23 were such pairs. Taken out: a pair (first
part a number, yellow) seen at least 20 times, written with a ZWNJ or joined less than 15% of the
time. Kept: «یک‌بار»، «یک‌سو»، «دوبرابر»، «دودل»، «سه‌بعدی»، «پنج‌ساله»، «چهارراه»، «یکباره», and the
book's own examples («ده‌پانزده»، «یک‌خوابه»).

Usage: python3 -I prune_phrases.py shares.json   (count_shares.py)
"""
import json
import os
import sys

DICT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "dict")
# the book's own examples (ص ۵۸–۵۹، بند ۱۰ الف) and words made like them stay: «ده‌پانزده (نفر)»، «یک‌خوابه»
BOOK = set("ده پانزده|پنج تن|پنج لایه|ده چرخ|نه فلک|هشت بهشت|هفت گنبد|یک خوابه|سی سالگی".split("|"))
BOOK_LIKE = ("خوابه", "سالگی")
NUM = set("یک دو سه چهار پنج شش هفت هشت نه ده یازده دوازده سیزده چهارده پانزده شانزده هفده هجده نوزده بیست سی چهل پنجاه شصت هفتاد هشتاد نود صد یکصد دویست سیصد هزار".split())


def main(shares_path):
    shares = json.load(open(shares_path, encoding="utf-8"))
    path = os.path.join(DICT, "spaced-compounds.json")
    d = json.load(open(path, encoding="utf-8"))
    dropped = []

    def phrase(spaced):
        v = shares.get(spaced, [0, 0, 0, 0])
        n = sum(v)
        if spaced in BOOK or spaced.endswith(BOOK_LIKE):
            return False
        return spaced.split(" ")[0] in NUM and n >= 20 and (v[1] + v[3]) / n < 0.15

    keep = []
    for r in d["more"]:
        if (r[3] & 1) and phrase(r[0]):
            dropped.append(r[0])
        else:
            keep.append(r)
    d["more"] = keep
    d["entries"] = [e for e in d["entries"] if not (e.get("amb") and phrase(e["spaced"]) and not dropped.append(e["spaced"]))]
    d["note"] = d["note"].split(" Pruned")[0] + " Pruned (1.6.4, scripts/lists/prune_phrases.py): yellow pairs of a number and a noun that running text writes apart nearly always."
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(d, fh, ensure_ascii=False, separators=(",", ":"))
    print(len(dropped), "dropped:", " / ".join(dropped[:40]), file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
