#!/usr/bin/env python3
"""
Build the word lists used by the «joined form» checks from Hazm's data
(https://github.com/roshan-research/hazm, MIT licence).

Usage:
    pip download hazm --no-deps -d /tmp/hazm
    python3 scripts/build_hazm_data.py /tmp/hazm/hazm-*.whl

Writes:
    src/dict/hazm-verbs.json       past and present stems, plus joined forms that are real words
    src/dict/hazm-bi.json          «بیX» → «بی‌X» where Hazm only knows the separated form
    src/dict/hazm-adjectives.json  adjectives that take -تر/-ترین, plus stems where «Xتر» is a real word

The guiding test, for every list: a joined form is only ever corrected when
Hazm does NOT know it as a word (frequency > 0). That keeps «میدان»,
«بیمار», «دفتر» and «مستتر» safe.
"""
import json
import os
import sys
import zipfile

ZWNJ = "‌"
NON_JOINING = "اآأإدذرزژوؤۀةء"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "dict")

PRESENT_ENDINGS = ["م", "ی", "د", "یم", "ید", "ند"]
PAST_ENDINGS = ["", "م", "ی", "یم", "ید", "ند"]
PREVERBS = ["", "بر", "در", "باز", "فرا", "فرو", "ور", "وا"]

# Words Hazm does not list (or lists with frequency 0) that look like a
# joined «می»/«نمی» verb form. Found by review.
EXTRA_NOT_VERBS = ["میدانی", "میانی", "میانجی", "میگساری", "میتاخت"]

ADJECTIVE_MIN_FREQ = 1000


def read(z: zipfile.ZipFile, name: str) -> list[str]:
    return z.read(name).decode("utf-8").splitlines()


def main(wheel: str) -> None:
    with zipfile.ZipFile(wheel) as z:
        words: dict[str, tuple[int, set[str]]] = {}
        for line in read(z, "hazm/data/words.dat"):
            w, f, tags = line.split("\t")
            words[w] = (int(f), set(tags.split(",")))
        verb_lines = read(z, "hazm/data/verbs.dat")

    def real(w: str) -> bool:
        return w in words and words[w][0] > 0

    # --- verbs -------------------------------------------------------------
    past, present = set(), set()
    for line in verb_lines:
        if "#" not in line:
            continue
        p, s = line.strip().split("#")
        if p:
            past.add(p)
        if s:
            present.add(s)

    def forms():
        for s in present:
            for e in PRESENT_ENDINGS:
                yield s + e
        for s in past:
            for e in PAST_ENDINGS:
                yield s + e

    not_verbs = set(EXTRA_NOT_VERBS)
    for f in forms():
        for pre in PREVERBS:
            for mi in ("می", "نمی"):
                joined = pre + mi + f
                if real(joined):
                    not_verbs.add(joined)
                if f.startswith("آ"):
                    alt = pre + mi + "ا" + f[1:]
                    if real(alt):
                        not_verbs.add(alt)

    verbs = {
        "source": "Hazm verbs.dat (MIT)",
        "past": sorted(past),
        "present": sorted(present),
        "notVerbs": sorted(not_verbs),
    }

    # --- بی- ------------------------------------------------------------------
    bi = {}
    for w, (f, _) in words.items():
        if w.startswith("بی" + ZWNJ) and f > 0 and ZWNJ not in w[3:]:
            joined = "بی" + w[3:]
            if not real(joined):
                bi[joined] = w

    # --- -تر/-ترین ------------------------------------------------------------
    adjectives, blocked = [], []
    for w, (f, tags) in words.items():
        if "AJ" not in tags or f < ADJECTIVE_MIN_FREQ or ZWNJ in w or len(w) < 2:
            continue
        if w[-1] in NON_JOINING:
            continue  # «دورتر» looks the same joined or separated
        # every form the rule would rewrite must not itself be a real word
        # («دیمی» + «تری» = «دیمیتری», «دف» + «تر» = «دفتر»)
        if any(real(w + t + x) for t in ("تر", "ترین") for x in ("", "ی", "ها", "های", "هایی")):
            blocked.append(w)
        else:
            adjectives.append(w)

    def dump(name: str, data) -> None:
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=0)
            fh.write("\n")

    dump("hazm-verbs.json", verbs)
    dump("hazm-bi.json", {"source": "Hazm words.dat (MIT)", "pairs": dict(sorted(bi.items()))})
    dump(
        "hazm-adjectives.json",
        {"source": "Hazm words.dat (MIT)", "adjectives": sorted(adjectives), "blocked": sorted(blocked)},
    )
    print(
        f"verbs: {len(past)} past / {len(present)} present, {len(not_verbs)} not-verbs; "
        f"bi: {len(bi)}; adjectives: {len(adjectives)} (+{len(blocked)} blocked)",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main(sys.argv[1])
