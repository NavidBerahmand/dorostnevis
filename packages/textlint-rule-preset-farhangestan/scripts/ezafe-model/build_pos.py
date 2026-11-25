#!/usr/bin/env python3
"""
Write src/dict/ezafe-pos.json: the Hazm part-of-speech tags of every word
Hazm has seen (frequency > 0), grouped by tag string to keep the file small.

Usage: python3 build_pos.py hazm-0.12.1-py3-none-any.whl
"""
import json
import os
import sys
import zipfile
from collections import defaultdict

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "dict", "ezafe-pos.json")

with zipfile.ZipFile(sys.argv[1]) as z:
    lines = z.read("hazm/data/words.dat").decode("utf-8").splitlines()
groups = defaultdict(list)
for line in lines:
    w, f, tags = line.split("\t")
    if int(f) > 0 and " " not in w:
        groups[tags].append(w)
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump({"source": "Hazm words.dat (MIT)", "tags": {t: " ".join(sorted(ws)) for t, ws in sorted(groups.items())}}, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write("\n")
print(f"{sum(len(v) for v in groups.values())} words, {len(groups)} tags, {os.path.getsize(OUT) // 1024} KB", file=sys.stderr)
