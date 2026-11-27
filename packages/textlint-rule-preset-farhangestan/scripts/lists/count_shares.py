#!/usr/bin/env python3
"""
How each spaced compound of src/dict/spaced-compounds.json is written in running text (1.6.4):
[blog spaced, blog with ZWNJ or joined, Wikipedia spaced, Wikipedia with ZWNJ or joined], on the blog
and forum units (the measured ones left out) and Persian Wikipedia (test articles, title hash bucket
0, left out). prune_phrases.py reads it.

Usage: python3 -I count_shares.py units.jsonl.gz measured.jsonl all.jsonl shares.json
"""
import gzip
import hashlib
import json
import os
import re
import sys
from collections import defaultdict

DICT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "dict")
Z = "‌"
TOK = re.compile(r"[ء-يپچژکگیۀ‌ٔ]+")


def nz(w):
    return w.replace("ي", "ی").replace("ك", "ک").replace("ۀ", "ه").replace("هٔ", "ه")


def main(units, measured, wiki, out):
    d = json.load(open(os.path.join(DICT, "spaced-compounds.json"), encoding="utf-8"))
    keys = {e["spaced"] for e in d["entries"]} | {r[0] for r in d["more"]}
    first = defaultdict(list)
    for k in keys:
        first[k.split(" ")[0]].append(k)
    joined = {k.replace(" ", ""): k for k in keys}
    cnt = defaultdict(lambda: [0, 0, 0, 0])

    def scan(texts, at):
        for t in texts:
            toks = [nz(x).strip(Z) for x in TOK.findall(t)]
            for i, w in enumerate(toks):
                if Z in w and w.replace(Z, " ") in keys:
                    cnt[w.replace(Z, " ")][at + 1] += 1
                    continue
                if Z not in w and w in joined:
                    cnt[joined[w]][at + 1] += 1
                for k in first.get(w, ()):
                    n = k.count(" ") + 1
                    if " ".join(toks[i:i + n]) == k:
                        cnt[k][at] += 1

    skip = {json.loads(line)["t"] for line in open(measured, encoding="utf-8")}

    def blogs():
        for line in gzip.open(units, "rt", encoding="utf-8"):
            u = json.loads(line)
            if u["t"] not in skip:
                yield u["t"]

    def wikipedia():
        for line in open(wiki, encoding="utf-8"):
            a = json.loads(line)
            if int(hashlib.md5(a["title"].encode()).hexdigest(), 16) % 10 != 0:
                yield from a["paras"]

    scan(blogs(), 0)
    scan(wikipedia(), 2)
    json.dump(dict(cnt), open(out, "w", encoding="utf-8"), ensure_ascii=False)


if __name__ == "__main__":
    main(*sys.argv[1:5])
