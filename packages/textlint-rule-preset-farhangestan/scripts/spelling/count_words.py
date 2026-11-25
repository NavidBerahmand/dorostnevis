#!/usr/bin/env python3
"""
Count word forms in Persian Wikipedia articles (from ../ezafe-model/extract_wiki.py),
skipping the test articles (title hash bucket 0), and write a TSV: word<TAB>count.

Usage: python3 count_words.py articles.jsonl > counts.tsv
"""
import hashlib
import json
import re
import sys
from collections import Counter

ZWNJ = "‌"
WORD = re.compile(f"[ء-غف-يٱ-ۓیکگپچژ{ZWNJ}]+")
MARKS = re.compile("[ً-ٰٟ]")


def normalize(t: str) -> str:
    t = t.replace("ي", "ی").replace("ى", "ی").replace("ك", "ک").replace("ۀ", "ه").replace("هٔ", "ه")
    return MARKS.sub("", t)


def main(path):
    c = Counter()
    for line in open(path, encoding="utf-8"):
        a = json.loads(line)
        if int(hashlib.md5(a["title"].encode()).hexdigest(), 16) % 10 == 0:
            continue
        for p in a["paras"]:
            for w in WORD.findall(normalize(p)):
                w = w.strip(ZWNJ)
                if len(w) >= 2:
                    c[w] += 1
    for w, n in c.most_common():
        if n < 2:
            break
        print(f"{w}\t{n}")


if __name__ == "__main__":
    main(sys.argv[1])
