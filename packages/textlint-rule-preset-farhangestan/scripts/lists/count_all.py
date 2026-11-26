"""
Corpus counts for every farhang compound (ZWNJ or joined) written with spaces.
Output JSON: per candidate key, spaced counts per (form, suffix), ezafe-marked bigram counts,
written counts, sample contexts; plus unigram totals and phrase-start counts for second parts.
"""
import collections, json, os, re, sys

ZWNJ = "‌"
DICT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "dict")
TOK = re.compile(r"[ء-غف-يً-ٰٕٱ-ۓە‌]+|[^\sء-ە‌]")
WORDCH = re.compile(r"^[ء-ە‌]")
SUFFIXES = ["", "ی", "ها", "های", "ان", "ات", "ش", "شان", "ای", "یی", "م", "ت", "مان", "تان", "اش", "ام"]
FUNC = set("و در به از با که را این آن برای تا بر یک هر یا نیز هم اما ولی چون زیرا اگر چه است بود شد".split())
KASRA = "ِ"


def strip_diac(t):
    return re.sub("[ً-ْٰ]", "", t)


def main(corpus, out):
    farhang = json.load(open(os.path.join(DICT, "farhang-emlaei.json")))["entries"]
    overrides = json.load(open(os.path.join(DICT, "farhang-v2-overrides.json")))["overrides"]
    book_joined = {w for g in json.load(open(os.path.join(DICT, "book-joined.json")))["groups"] for w in g["words"]}
    # key (letters without ZWNJ) -> info
    cand = {}
    for key, (pref, others, page) in farhang.items():
        if not pref:
            continue
        target = overrides.get(key) or pref
        if key in book_joined:
            target = key
        zw = None
        if ZWNJ in pref:
            zw = pref
        else:
            for o in others:
                if ZWNJ in o and o.replace(ZWNJ, "") == key:
                    zw = o
                    break
        cand[key] = {"target": target, "pref": pref, "zw": zw, "page": page}
    for w in book_joined:
        k = w.replace(ZWNJ, "")
        if k not in cand:
            cand[k] = {"target": w, "pref": w, "zw": None, "page": None, "bookonly": True}
    keys = set(cand)
    # positions where a token boundary may fall: ZWNJ positions (in letters) of the zw form; joined: any
    def zpos(form):
        out, n = set(), 0
        for ch in form:
            if ch == ZWNJ:
                out.add(n)
            else:
                n += 1
        return out
    allowed = {k: (zpos(c["zw"]) if c["zw"] else None) for k, c in cand.items()}

    uni = collections.Counter()
    start = collections.Counter()
    spaced = collections.defaultdict(collections.Counter)  # key -> "a|b|suf" counter (bounds as string)
    ez = collections.defaultdict(collections.Counter)
    samples = collections.defaultdict(list)
    n_words = 0
    for ln, line in enumerate(open(corpus, encoding="utf-8")):
        art = json.loads(line)
        for para in art["paras"]:
            toks = TOK.findall(para)
            L = len(toks)
            prev_w = None
            for i, t in enumerate(toks):
                isw = bool(WORDCH.match(t))
                if not isw:
                    prev_w = None
                    continue
                n_words += 1
                t0 = strip_diac(t)
                uni[t0] += 1
                p = toks[i - 1] if i else None
                if p is None or not WORDCH.match(p) or strip_diac(p) in FUNC:
                    start[t0] += 1
                # spaced windows of 2..4 word tokens
                letters = t0.replace(ZWNJ, "")
                bounds = []
                acc = letters
                j = i
                for k in range(2, 5):
                    j += 1
                    if j >= L or not WORDCH.match(toks[j]):
                        break
                    bounds.append(len(acc))
                    nxt = strip_diac(toks[j])
                    nl = nxt.replace(ZWNJ, "")
                    for suf in SUFFIXES:
                        if suf and not nl.endswith(suf):
                            continue
                        base = acc + (nl[: -len(suf)] if suf else nl)
                        if base in keys:
                            al = allowed[base]
                            if al is not None and not all(b in al for b in bounds):
                                continue
                            if any(b < 2 or len(base) - b < 2 for b in bounds):
                                continue
                            sig = ",".join(map(str, bounds)) + "|" + suf
                            spaced[base][sig] += 1
                            if len(samples[base]) < 400:
                                samples[base].append([sig, " ".join(toks[max(0, i - 6): j + 6])])
                    acc = acc + nl
                # ezafe-marked first part: «Xِ Y», «Xهٔ Y», «Xۀ Y», vowel-final «Xی Y»
                if i + 1 < L and WORDCH.match(toks[i + 1]):
                    x = None
                    kind = None
                    if t.endswith(KASRA):
                        x, kind = strip_diac(t), "kasra"
                    elif t.endswith("هٔ"):
                        x, kind = t[:-1], "he"
                    elif t.endswith("ۀ"):
                        x, kind = t[:-1] + "ه", "he"
                    elif t0.endswith("ی") and len(t0) > 2 and t0[-2] in "اوآ":
                        x, kind = t0[:-1], "yeh"
                    if x:
                        nxt = strip_diac(toks[i + 1]).replace(ZWNJ, "")
                        xl = x.replace(ZWNJ, "")
                        for suf in SUFFIXES:
                            if suf and not nxt.endswith(suf):
                                continue
                            base = xl + (nxt[: -len(suf)] if suf else nxt)
                            if base in keys:
                                al = allowed[base]
                                if al is not None and len(xl) not in al:
                                    continue
                                ez[base][kind + "|" + suf] += 1
                                if len(samples[base]) < 400:
                                    samples[base].append(["EZ:" + kind + "|" + suf, " ".join(toks[max(0, i - 6): i + 7])])
        if ln % 20000 == 0:
            print(ln, n_words, file=sys.stderr, flush=True)
    written = collections.Counter()
    for tok, c in uni.items():
        k = tok.replace(ZWNJ, "")
        if k in keys and len(tok) > 0:
            written[k] += c
    res = {"n_words": n_words, "cand": cand, "spaced": spaced, "ez": ez, "written": written, "samples": samples}
    json.dump(res, open(out, "w"), ensure_ascii=False)
    json.dump({"uni": {k: v for k, v in uni.items() if v >= 2}, "start": {k: v for k, v in start.items() if v >= 1}},
              open(out + ".uni", "w"), ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
