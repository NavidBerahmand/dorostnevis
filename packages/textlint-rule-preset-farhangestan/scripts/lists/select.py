"""
Pick the entries of the three deterministic lists from count.py's counts.

Usage: python3 -I select.py counts.json > lists.json
Thresholds are at the top; each list keeps its counts so the choice can be checked.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DICT = os.path.join(HERE, "..", "..", "src", "dict")

# compounds: written as one word often, rarely spaced, (almost) never an ezafe
COMP_MIN_WRITTEN = 50
COMP_MAX_SPACED = 0.20
COMP_MAX_EZAFE = 0.01
# ezafe: in articles that mark it, nearly always marked
EZ_MIN = 10
EZ_MIN_RATIO = 0.99
# «را»: «W را» common, «Wرا» (almost) never, and «Wرا» is no word
RA_MIN = 100
RA_MAX_JOINED = 0.02

# «Wرا» that is itself a name or word in Wikipedia text (checked by hand): «ویرا» Vera, «اورا» Aura…
RA_EXCLUDE = {"وی", "او", "است", "هوا", "شب", "آرا", "اش"}
FUNCTION = set("و در از به با که را این آن تا بر هم یا هر برای یک دو سه چند نه نیز اما ولی اگر پس بی می".split())


def words():
    known = set()
    for name in ("hazm-words.json", "farhang-emlaei.json"):
        d = json.load(open(os.path.join(DICT, name), encoding="utf-8"))
        if "entries" in d:
            for k, v in d["entries"].items():
                known.add(k)
                if v[0]:
                    known.add(v[0].replace("‌", ""))
        else:
            for w in d.get("words", []):
                known.add(w.replace("‌", ""))
    return known


def main(path):
    c = json.load(open(path, encoding="utf-8"))
    known = words()

    compounds = []
    for form, (z, j, s, e) in c["compounds"].items():
        written = z + j
        x, y = form.split("‌")
        if x in FUNCTION or y in FUNCTION:
            continue
        if written < COMP_MIN_WRITTEN or s / (written + s) > COMP_MAX_SPACED:
            continue
        if x.endswith("ه") and e / max(1, written + e) > COMP_MAX_EZAFE:
            continue
        if s == 0:
            continue  # nobody writes it spaced: nothing to correct
        compounds.append({"form": form, "spaced": f"{x} {y}", "written": written, "spaced_n": s, "ezafe_n": e})

    ezafe = []
    for pair, (m, u) in c["ezafe"].items():
        a, b = pair.split(" ")
        if b in FUNCTION or m + u < EZ_MIN or m / (m + u) < EZ_MIN_RATIO:
            continue
        ezafe.append({"pair": pair, "marked": m, "unmarked": u})

    ra = []
    for w, (sep, joined) in c["ra"].items():
        if sep < RA_MIN or joined / sep > RA_MAX_JOINED or (w + "را") in known or w in FUNCTION or w in RA_EXCLUDE or len(w) <= 2:
            continue
        ra.append({"word": w, "separate": sep, "joined": joined})

    for lst, key in ((compounds, "written"), (ezafe, "marked"), (ra, "separate")):
        lst.sort(key=lambda d: -d[key])
    json.dump({"thresholds": {"compounds": [COMP_MIN_WRITTEN, COMP_MAX_SPACED, COMP_MAX_EZAFE],
                              "ezafe": [EZ_MIN, EZ_MIN_RATIO], "ra": [RA_MIN, RA_MAX_JOINED]},
               "compounds": compounds, "ezafe": ezafe, "ra": ra}, sys.stdout, ensure_ascii=False, indent=0)
    print(f"compounds {len(compounds)}, ezafe {len(ezafe)}, ra {len(ra)}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
