#!/usr/bin/env python3
"""
Train the ezafe model (logistic regression) and write src/dict/ezafe-model.json.

Usage:
    python3 -I extract_wiki.py fawiki-slice.xml > articles.jsonl
    python3 train.py articles.jsonl book.txt

Training data is Persian Wikipedia, which marks the ezafe after a silent «ه»
as «هٔ». Many articles skip the mark, which would teach the model that the
ezafe is rare, so only articles that mark it consistently are used (at least
5 marks, and at least 30% of candidates marked; carefully edited text has
about 28%, so these are the articles that mark it everywhere). Weights under
0.3 are dropped: on the book that loses nothing and shrinks the file 4x. Articles are split 90/10 by title hash for testing. The book
(دستور خط، which marks every ezafe with «ۀ») is a second, independent test.
"""
import hashlib
import json
import os
import sys
from collections import Counter

import numpy as np
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression

sys.path.insert(0, os.path.dirname(__file__))
from features import candidates  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "dict", "ezafe-model.json")
MIN_COUNT = 3
MIN_RATIO = float(os.environ.get("MIN_RATIO", "0.3"))
PRUNE = float(os.environ.get("PRUNE", "0.3"))
POS_WEIGHT = float(os.environ.get("POS_WEIGHT", "1"))
C = float(os.environ.get("C", "0.5"))


def load(path):
    train, test = [], []
    kept = 0
    for line in open(path, encoding="utf-8"):
        a = json.loads(line)
        rows = [(f, y) for p in a["paras"] for f, y, _ in candidates(p)]
        pos = sum(y for _, y in rows)
        if pos < 5 or pos / len(rows) < MIN_RATIO:
            continue
        kept += 1
        bucket = int(hashlib.md5(a["title"].encode()).hexdigest(), 16) % 10
        (test if bucket == 0 else train).extend(rows)
    print(f"articles kept: {kept}; train {len(train)}, test {len(test)}", file=sys.stderr)
    return train, test


def to_dicts(rows):
    return [{k: 1 for k in f} for f, _ in rows], np.array([y for _, y in rows])


def report(name, y, p):
    for t in (0.5, 0.7, 0.8, 0.9, 0.95):
        pred = p >= t
        tp = int((pred & (y == 1)).sum()); fp = int((pred & (y == 0)).sum()); fn = int((~pred & (y == 1)).sum())
        prec = tp / max(tp + fp, 1); rec = tp / max(tp + fn, 1)
        print(f"{name} t={t}: precision {prec:.3f} recall {rec:.3f} (tp {tp}, fp {fp}, fn {fn})", file=sys.stderr)
    acc = ((p >= 0.5) == (y == 1)).mean()
    print(f"{name}: accuracy {acc:.3f}, positives {int(y.sum())}/{len(y)}", file=sys.stderr)


def main(articles, book):
    train, test = load(articles)
    counts = Counter(k for f, _ in train for k in f)
    keep = {k for k, c in counts.items() if c >= MIN_COUNT}
    train = [([k for k in f if k in keep], y) for f, y in train]
    Xd, y = to_dicts(train)
    vec = DictVectorizer()
    X = vec.fit_transform(Xd)
    X.indices = X.indices.astype(np.int32); X.indptr = X.indptr.astype(np.int32)
    model = LogisticRegression(C=C, max_iter=2000, solver="liblinear", class_weight={0: 1.0, 1: POS_WEIGHT})
    model.fit(X, y)

    def score(rows):
        Xt = vec.transform([{k: 1 for k in f} for f, _ in rows])
        return model.predict_proba(Xt)[:, 1], np.array([y for _, y in rows])

    p, yt = score(test)
    report("wiki-test", yt, p)
    book_rows = [(f, y) for line in open(book, encoding="utf-8") for f, y, _ in candidates(line)]
    pb, yb = score(book_rows)
    report("book", yb, pb)

    # export: feature → weight, pruned and rounded to keep the file small
    names = vec.get_feature_names_out()
    w = model.coef_[0]
    weights = {n: round(float(v), 2) for n, v in zip(names, w) if abs(v) >= PRUNE}
    weights["b"] = round(float(weights.get("b", 0.0)) + float(model.intercept_[0]), 3)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"source": "scripts/ezafe-model/train.py on Persian Wikipedia (CC BY-SA)", "weights": weights}, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    print(f"features kept: {len(weights)}; file {os.path.getsize(OUT) // 1024} KB", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
