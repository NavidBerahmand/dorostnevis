#!/usr/bin/env python3
"""
Train the joined-«را» model and write src/dict/ra-model.json.

Usage: python3 train_ra.py articles.jsonl

Wikipedia writes «را» apart from the word before it, so a token like «لورا»
in Wikipedia is a word (a name), never «لو» + «را»: these are the negatives.
Positives are made by joining «X را» back together. Articles split 90/10 by
title hash; the test set is reported at several thresholds.
"""
import hashlib
import json
import os
import random
import sys

import numpy as np
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression

sys.path.insert(0, os.path.dirname(__file__))
from features import ra_examples  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "dict", "ra-model.json")
PRUNE = float(os.environ.get("PRUNE", "0.3"))


def main(path):
    rnd = random.Random(1)
    train, test = [], []
    for n, line in enumerate(open(path, encoding="utf-8")):
        a = json.loads(line)
        bucket = int(hashlib.md5(a["title"].encode()).hexdigest(), 16) % 10
        rows = [r for p in a["paras"] for r in ra_examples(p, 0.05, rnd)]
        (test if bucket == 0 else train).extend(rows)
    print(f"train {len(train)} ({sum(y for _, y in train)} positive), test {len(test)}", file=sys.stderr)
    vec = DictVectorizer()
    X = vec.fit_transform([{k: 1 for k in f} for f, _ in train])
    X.indices = X.indices.astype(np.int32); X.indptr = X.indptr.astype(np.int32)
    y = np.array([y for _, y in train])
    model = LogisticRegression(C=0.5, max_iter=2000, solver="liblinear")
    model.fit(X, y)
    Xt = vec.transform([{k: 1 for k in f} for f, _ in test])
    yt = np.array([y for _, y in test])
    p = model.predict_proba(Xt)[:, 1]
    for t in (0.5, 0.7, 0.8, 0.9, 0.95):
        pred = p >= t
        tp = int((pred & (yt == 1)).sum()); fp = int((pred & (yt == 0)).sum()); fn = int((~pred & (yt == 1)).sum())
        print(f"t={t}: precision {tp / max(tp + fp, 1):.3f} recall {tp / max(tp + fn, 1):.3f} (fp {fp})", file=sys.stderr)
    names = vec.get_feature_names_out()
    weights = {n: round(float(v), 2) for n, v in zip(names, model.coef_[0]) if abs(v) >= PRUNE}
    weights["b"] = round(float(weights.get("b", 0.0)) + float(model.intercept_[0]), 3)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"source": "scripts/ezafe-model/train_ra.py on Persian Wikipedia (CC BY-SA)", "weights": weights}, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    print(f"features kept: {len(weights)}; file {os.path.getsize(OUT) // 1024} KB", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
