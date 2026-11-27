#!/usr/bin/env python3
"""
Count the words of the two corpora behind the checker's accept list (1.6.4; build-accept.cjs
writes the list):

  blogs      every word of the blog and forum units (one JSON object per line: "t" the text,
             "dom" the site), with the number of sites it is on; the units measured are left out
  wikipedia  every word of the Persian Wikipedia articles (one JSON object per line: "title",
             "paras"), skipping the test articles (title hash bucket 0, as count_words.py), with
             the number of articles it is in and of titles it is part of, and (a fourth number) of titles of
             two or three words it begins, when at least three different words follow it

Words are counted as the checker reads them: Arabic «ي/ك» as Persian, «ۀ» as «ه», no harakat, no ZWNJ.

Usage: python3 -I mine_accept.py blogs units.jsonl.gz measured.jsonl blogs.json
       python3 -I mine_accept.py wikipedia all.jsonl wikipedia.json
"""
import gzip
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict

WORD = re.compile(r"[ء-غف-يٱ-ۓیکگپچژؐ-ًؚ-ٰٟ‌]+")


def norm(w):
    w = w.replace("ي", "ی").replace("ى", "ی").replace("ك", "ک").replace("ۀ", "ه").replace("هٔ", "ه")
    w = re.sub("[ً-ٰٟؐ-ؚ]", "", w)
    return w.strip("‌").replace("‌", "")


def blogs(units, measured, out):
    skip = {json.loads(line)["t"] for line in open(measured, encoding="utf-8")}
    count, sites = Counter(), defaultdict(set)
    for line in gzip.open(units, "rt", encoding="utf-8"):
        u = json.loads(line)
        if u["t"] in skip:
            continue
        for w in set(norm(x) for x in WORD.findall(u["t"])):
            if len(w) >= 3:
                s = sites[w]
                if len(s) < 200:
                    s.add(u.get("dom") or u.get("d"))
        count.update(w for w in (norm(x) for x in WORD.findall(u["t"])) if len(w) >= 3)
    json.dump({w: [c, len(sites[w])] for w, c in count.items() if c >= 2}, open(out, "w", encoding="utf-8"), ensure_ascii=False)


def wikipedia(articles, out):
    count, arts, titles = Counter(), Counter(), Counter()
    first, seconds = Counter(), defaultdict(set)
    for line in open(articles, encoding="utf-8"):
        a = json.loads(line)
        if int(hashlib.md5(a["title"].encode()).hexdigest(), 16) % 10 == 0:
            continue
        titles.update(set(norm(x) for x in WORD.findall(a["title"])))
        # the first word of a title of two or three words («کارل مارکس»، «دریاچه ارومیه»)
        parts = re.sub(r"\s*\(.*?\)\s*", "", a["title"]).strip().split(" ")
        if 2 <= len(parts) <= 3 and all(re.fullmatch("[\u0600-\u06FF\u200c]+", x) for x in parts):
            first[norm(parts[0])] += 1
            if len(seconds[norm(parts[0])]) < 50:
                seconds[norm(parts[0])].add(parts[1])
        words = [norm(x) for p in a["paras"] for x in WORD.findall(p)]
        words = [w for w in words if len(w) >= 3]
        count.update(words)
        arts.update(set(words))
    words = {w: [c, arts[w], titles[w]] for w, c in count.items() if c >= 2 or titles[w]}
    for w, c in first.items():
        if len(seconds[w]) >= 3:
            words.setdefault(w, [count[w], arts[w], titles[w]]).append(c)
    json.dump(words, open(out, "w", encoding="utf-8"), ensure_ascii=False)


if __name__ == "__main__":
    if sys.argv[1] == "blogs":
        blogs(*sys.argv[2:5])
    else:
        wikipedia(*sys.argv[2:4])
