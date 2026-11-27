#!/usr/bin/env python3
"""
Calibrate the ezafe model's confidence on clean labels and store the result
in src/dict/ezafe-model.json as {"calibration": {"a": …, "b": …}}.

Usage: python3 calibrate.py book.txt

Wikipedia leaves part of the ezafes unmarked, so the raw model is too
cautious: at 0.9 it fixed only 15–23% of real ezafes. Two clean sets fix the
scale (Platt scaling, p = sigmoid(a·z + b)):
- the text of دستور خط, which marks every ezafe («ۀ»): 842 cases;
- hand-labels.jsonl: 300 random cases from unmarked Wikipedia articles (not
  used in training), labelled by hand;
- since 1.6.3, hand-labels-blog.jsonl: 143 cards the site showed on blog and
  forum text (1.6.2), judged by hand.
Each set is also checked with the scale fitted on the other one. The features are
computed again from each case's context («m2 m1 [w0] w1 w2»), so the labels stay
good when the features change.
"""
import json
import os
import sys

import numpy as np
from sklearn.linear_model import LogisticRegression

sys.path.insert(0, os.path.dirname(__file__))
from features import candidates, features  # noqa: E402

HERE = os.path.dirname(__file__)
MODEL = os.path.join(HERE, "..", "..", "src", "dict", "ezafe-model.json")


def main(book):
    data = json.load(open(MODEL, encoding="utf-8"))
    w = data["weights"]
    z = lambda f: sum(w.get(k, 0) for k in f)  # noqa: E731
    def ctx_features(ctx):
        t = ctx.split(); i = [k for k, x in enumerate(t) if x.startswith("[")][0]
        return features([x.strip("[]") for x in t], i)
    hand = [json.loads(l) for f in ("hand-labels.jsonl", "hand-labels-blog.jsonl") for l in open(os.path.join(HERE, f), encoding="utf-8")]
    hz = np.array([z(ctx_features(h["context"])) for h in hand]); hy = np.array([h["label"] for h in hand])
    rows = [(f, y) for line in open(book, encoding="utf-8") for f, y, _ in candidates(line)]
    bz = np.array([z(f) for f, _ in rows]); by = np.array([y for _, y in rows])

    def fit(zz, yy):
        m = LogisticRegression(C=1e6).fit(zz.reshape(-1, 1), yy)
        return float(m.coef_[0][0]), float(m.intercept_[0])

    def report(name, zz, yy, a, b):
        p = 1 / (1 + np.exp(-(a * zz + b)))
        out = [f"{name}: accuracy {((p >= .5) == yy).mean():.3f}"]
        for t in (.6, .8, .9):
            pr = p >= t; tp = int((pr & (yy == 1)).sum()); fp = int((pr & (yy == 0)).sum())
            out.append(f"t={t} precision {tp / max(tp + fp, 1):.2f} recall {tp / max(int(yy.sum()), 1):.2f}")
        print(" | ".join(out), file=sys.stderr)

    report("raw, book", bz, by, 1, 0)
    report("raw, hand", hz, hy, 1, 0)
    report("fitted on hand, book", bz, by, *fit(hz, hy))
    report("fitted on book, hand", hz, hy, *fit(bz, by))
    a, b = fit(np.concatenate([hz, bz]), np.concatenate([hy, by]))
    data["calibration"] = {"a": round(a, 3), "b": round(b, 3)}
    with open(MODEL, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    print(f"calibration a={a:.3f} b={b:.3f}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
