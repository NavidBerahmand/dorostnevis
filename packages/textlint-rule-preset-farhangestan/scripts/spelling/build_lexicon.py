#!/usr/bin/env python3
"""
Write src/dict/spelling-lexicon.json from count_words.py's output: every word
form seen at least 3 times in the Persian Wikipedia training articles (ZWNJ
removed, counts merged), grouped by frequency bucket floor(log2(count)).

Usage: python3 build_lexicon.py counts.tsv
"""
import json
import math
import os
import sys
from collections import defaultdict

MIN_COUNT = 3
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "dict", "spelling-lexicon.json")


def main(path):
    freq = defaultdict(int)
    for line in open(path, encoding="utf-8"):
        w, n = line.rstrip("\n").split("\t")
        n = int(n)
        if n < MIN_COUNT:
            break
        freq[w.replace("‌", "")] += n
    buckets = defaultdict(list)
    for w, n in freq.items():
        buckets[int(math.log2(n))].append(w)
    data = {
        "source": "Persian Wikipedia (CC BY-SA): word forms seen at least 3 times; bucket = floor(log2(count))",
        "buckets": {str(b): " ".join(sorted(ws)) for b, ws in sorted(buckets.items())},
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    print(f"{len(freq)} words, {os.path.getsize(OUT) // 1024} KB", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
