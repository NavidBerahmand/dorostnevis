"""
Classify every farhang compound's spaced form: red (certain), yellow (can also be two words), excluded.
Usage: python3 -I classify.py full.json > classified.json
"""
import collections, json, sys

ZWNJ = "‌"
DICT = "/home/user/dorostnevis/packages/textlint-rule-preset-farhangestan/src/dict"
# prepositions, conjunctions, pronouns, determiners, prefixes with their own rules in دستور خط
FUNCTION = set("و در از به با که را این آن تا بر یا برای نیز اما ولی اگر پس هر هم بی می نمی نه همین همان چه چون زیرا".split())
# «دو دهنه» is usually «two openings»: after a number the spaced form is a counted noun as often as not
NUMBERS = set("یک دو سه چهار پنج شش هفت هشت نه ده یازده دوازده بیست سی چهل پنجاه صد هزار چند نیم".split())
FREE_MIN = 5
FREE_RATIO = 0.05


def main(path):
    d = json.load(open(path))
    U = json.load(open(path + ".uni"))
    uni, start = U["uni"], U["start"]
    verbs = json.load(open(f"{DICT}/hazm-verbs.json"))
    past, present = set(verbs["past"]), set(verbs["present"])
    vforms = set()
    for p in past:
        for e in ("", "ه", "ن", "ند", "یم", "ید", "م"):
            vforms.add(p + e)
    for s in present:
        for e in ("د", "ند"):
            vforms.add(s + e)

    ezp = json.load(open(path.replace("full.json", "ezprev.json")))
    vfull = set(vforms)
    for p in past:
        for e in ("ی", "یم", "ید"):
            vfull.add(p + e)
    for st in present:
        for e in ("م", "یم", "ید"):
            vfull.add(st + e)
    lex = set(json.load(open(f"{DICT}/hazm-common-nouns.json"))["words"]) | set(json.load(open(f"{DICT}/hazm-adjectives.json"))["adjectives"])

    def free(tok, side="y"):
        """A standalone word: a noun that often starts a phrase, or a word often after an ezafe (an adjective)."""
        u = max(1, uni.get(tok, 0))
        st, ez = start.get(tok, 0), ezp.get(tok, 0)
        return tok in lex or (st >= 50 and st / u >= 0.15) or (ez >= 10 and ez / u >= 0.08)

    known = set(json.load(open(f"{DICT}/hazm-words.json"))["words"]) | {k for k, v in json.load(open(f"{DICT}/farhang-emlaei.json"))["entries"].items() if v[0] and ZWNJ not in v[0]}
    out = []
    for key, c in d["cand"].items():
        sp = d["spaced"].get(key, {})
        ez = d["ez"].get(key, {})
        form = c["zw"] or c["pref"]
        tgt = c["target"]
        # split points: from the ZWNJ form, else from the corpus's spaced bounds
        if c["zw"]:
            parts = c["zw"].split(ZWNJ)
            splits = [tuple(sorted(int(x) for x in sig.split("|")[0].split(","))) for sig in sp] or [None]
        else:
            parts = None
        n_sp = sum(sp.values())
        variants = collections.Counter()
        for sig, n in sp.items():
            b, suf = sig.split("|")
            variants[(b, suf)] += n
        # evaluate per bound set
        bsets = collections.defaultdict(lambda: {"n": 0, "suf": collections.Counter()})
        for (b, suf), n in variants.items():
            bsets[b]["n"] += n
            bsets[b]["suf"][suf] += n
        if c["zw"]:
            # always include the full-space form of the ZWNJ compound, even if never seen
            nb = []
            acc = 0
            for p in parts[:-1]:
                acc += len(p)
                nb.append(str(acc))
            bsets[",".join(nb)]  # touch
        for b, info in bsets.items():
            bounds = [int(x) for x in b.split(",")]
            pieces, prev = [], 0
            for x in bounds + [len(key)]:
                pieces.append(key[prev:x])
                prev = x
            if any(len(p) < 2 for p in pieces):
                continue
            # the written pieces keep the ZWNJs of the farhang's form that are not spaces
            if c["zw"]:
                wp, cur, n = [], "", 0
                for ch in c["zw"]:
                    if ch == ZWNJ:
                        if n in bounds:
                            wp.append(cur)
                            cur = ""
                        else:
                            cur += ch
                    else:
                        cur += ch
                        n += 1
                wp.append(cur)
            else:
                wp = pieces
            spaced = " ".join(wp)
            subparts = c["zw"].split(ZWNJ) if c["zw"] else pieces
            # a split of a joined word found in the corpus: only into known words («باکلاس» ≠ «باکل اس»)
            if not c["zw"] and not all(p in known for p in pieces):
                continue
            reason = None
            if any(p in FUNCTION for p in pieces) or any(p in FUNCTION for p in subparts):
                reason = "function-word"
            elif c.get("bookonly") and not c["zw"]:
                pass
            # verb-form second part (finite verb or participle): «قرار داد»، «شناخته شده»
            if not reason and pieces[-1] in vforms:
                reason = "verb"
            # only the plain pair or a plural after it («میانِ سال‌های»): other suffixes match by chance («حملهٔ ورم»)
            ezs = {k: n for k, n in ez.items() if k.split("|")[1] in ("", "ها", "های")}
            ezn = sum(n for k, n in ezs.items() if not k.startswith("yeh")) + (sum(n for k, n in ezs.items() if k.startswith("yeh")) // 2)
            xfree = all(free(p, "x") for p in pieces[:-1])
            yfree = any(free(p) for p in pieces[1:])
            amb_suf, verb_suf = [], []
            for suf in ["ی", "ها", "های", "ان", "ات", "ش", "شان", "ای", "یی", "م", "ت", "مان", "تان"]:
                yt = pieces[-1] + suf
                if yt in vfull:
                    verb_suf.append(suf)
                elif free(yt):
                    amb_suf.append(suf)
            amb = ezn >= 1 or (xfree and yfree) or pieces[0] in NUMBERS
            out.append({
                "key": key, "spaced": spaced, "to": tgt, "form": form, "page": c["page"],
                "zw": bool(c["zw"]), "n_spaced": info["n"], "suf": dict(info["suf"]), "written": d["written"].get(key, 0),
                "ez": ezn, "xfree": xfree, "yfree": yfree,
                "ystart": [start.get(p, 0) for p in pieces[1:]], "yuni": [uni.get(p, 0) for p in pieces[1:]],
                "amb": amb, "amb_suf": amb_suf, "verb_suf": verb_suf, "pieces": pieces, "excluded": reason, "bookonly": bool(c.get("bookonly")),
            })
    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1])
