"""
Counts on Persian Wikipedia text for the three deterministic lists.

Input: articles.jsonl ({"title", "paras"} per line, from scripts/ezafe-model/extract_wiki.py).
Output (JSON): for each candidate
  compounds   "X‌Y" from فرهنگ املایی: written with ZWNJ / joined / spaced «X Y» / as ezafe «Xهٔ Y»
  ezafe       pairs «Xه Y» in articles that mark the ezafe: with the mark / without
  ra          words W: «W را» / «Wرا»
Usage: python3 -I count.py articles.jsonl farhang-emlaei.json > counts.json
"""
import collections
import json
import re
import sys

ZWNJ = "‌"
TOKEN = re.compile(r"[؀-ۿ‌]+")
EZ_MARK = ("هٔ", "ۀ")


def unmark(w: str) -> str:
    """The next word's own ezafe mark is not part of the pair: «انتخابیهٔ» → «انتخابیه»."""
    if w.endswith("هٔ"):
        return w[:-1]
    if w.endswith("ۀ"):
        return w[:-1] + "ه"
    return w


def main(corpus, farhang_path):
    farhang = json.load(open(farhang_path, encoding="utf-8"))["entries"]
    # two-part compounds: «جامعه‌شناس» → («جامعه», «شناس»)
    pairs = {}
    for v in farhang.values():
        form = v[0]
        if not form or form.count(ZWNJ) != 1:
            continue
        x, y = form.split(ZWNJ)
        if len(x) >= 2 and len(y) >= 2:
            pairs[(x, y)] = form
    comp = {form: [0, 0, 0, 0] for form in pairs.values()}  # zwnj, joined, spaced, ezafe
    joined_of = {form.replace(ZWNJ, ""): form for form in comp}

    ez = collections.defaultdict(lambda: [0, 0])  # (stem+ه, next) → [marked, unmarked]
    ra = collections.defaultdict(lambda: [0, 0])  # W → [«W را», «Wرا»]
    n_art = n_marked_art = 0
    for line in open(corpus, encoding="utf-8"):
        art = json.loads(line)
        n_art += 1
        text = "\n".join(art["paras"])
        toks = TOKEN.findall(text)
        marks = sum(1 for t in toks if t.endswith(EZ_MARK))
        silent = sum(1 for t in toks if t.endswith("ه"))
        marked_article = marks >= 5 and marks / max(1, marks + silent) >= 0.3
        n_marked_art += marked_article
        for i, t in enumerate(toks):
            # compounds
            if t in comp:
                comp[t][0] += 1
            elif t in joined_of:
                comp[joined_of[t]][1] += 1
            nxt = toks[i + 1] if i + 1 < len(toks) else None
            if nxt is None:
                continue
            f = pairs.get((t, nxt))
            if f:
                comp[f][2] += 1
            if t.endswith(EZ_MARK):
                base = t[:-2] + "ه" if t.endswith("هٔ") else t[:-1] + "ه"
                f = pairs.get((base, nxt))
                if f:
                    comp[f][3] += 1
                if marked_article:
                    ez[(base, unmark(nxt))][0] += 1
            elif marked_article and t.endswith("ه") and len(t) >= 3:
                ez[(t, unmark(nxt))][1] += 1
            # «را»
            if nxt == "را":
                ra[t][0] += 1
        for t in toks:
            if t.endswith("را") and len(t) >= 4:
                ra[t[:-2]][1] += 1
        if n_art % 50000 == 0:
            print(n_art, file=sys.stderr)
    ez = {f"{a} {b}": v for (a, b), v in ez.items() if sum(v) >= 5}
    ra = {w: v for w, v in ra.items() if v[0] >= 20 or v[1] >= 5}
    json.dump({"articles": n_art, "marked_articles": n_marked_art, "compounds": comp, "ezafe": ez, "ra": ra},
              sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
