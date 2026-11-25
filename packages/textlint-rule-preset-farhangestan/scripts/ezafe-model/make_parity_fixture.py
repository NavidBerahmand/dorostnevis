#!/usr/bin/env python3
"""
Write test/fixtures/ezafe-parity.json: sentences with the scores features.py
and the exported weights give, so test/ezafe-model-test.ts can check that the
TypeScript port scores them the same.

Usage: python3 make_parity_fixture.py text-file [more text files]
"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from features import candidates  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
W = json.load(open(os.path.join(ROOT, "src", "dict", "ezafe-model.json"), encoding="utf-8"))["weights"]
lines = [l.strip() for path in sys.argv[1:] for l in open(path, encoding="utf-8") if l.strip()]
random.seed(1)
out = []
for line in random.sample(lines, min(400, len(lines))):
    line = line[:400]
    scores = [[w, round(1 / (1 + math.exp(-sum(W.get(k, 0) for k in f))), 6)] for f, _, w in candidates(line)]
    if scores:
        out.append([line, scores])
json.dump(out, open(os.path.join(ROOT, "test", "fixtures", "ezafe-parity.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(len(out), "sentences", file=sys.stderr)
