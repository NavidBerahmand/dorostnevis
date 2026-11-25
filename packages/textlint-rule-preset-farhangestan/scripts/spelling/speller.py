"""
Prototype of the spelling checker (src/util/speller.ts mirrors it).

A word is accepted if its letters (ZWNJ ignored: spacing is other rules' job)
are in the lexicon, or are a lexicon word plus common affixes. Otherwise the
word is reported with suggestions: lexicon words at edit distance 1 (and 2
for long words), ranked by frequency, with sound-alike letters (ت/ط، س/ص/ث…)
preferred; or two lexicon words run together.
"""
import json
import os

ZWNJ = "‌"
ALPHABET = "ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیآئؤءأ"
SOUND_ALIKE = [set("تط"), set("سصث"), set("زذضظ"), set("هح"), set("قغ"), set("اآع"), set("ئی"), set("ءئأؤ")]
PREFIXES = ["نمی", "می", "بی", "نا", "ب", "ن"]
SUFFIXES = sorted([
    "هایشان", "هایتان", "هایمان", "هایش", "هایت", "هایم", "هایی", "های", "ها", "ان", "ات", "ین",
    "ترین", "تر", "ی", "ای", "یی", "م", "ت", "ش", "مان", "تان", "شان", "ام", "اش", "یم", "ید", "ند", "د", "ه", "اند", "ایم", "اید", "است", "ست", "گی", "گان",
], key=len, reverse=True)


MIN_SUGGESTION_FREQ = 500
FUNCTION_WORDS = {"و", "در", "از", "به", "با", "که", "را", "این", "آن", "تا", "بر", "هم", "یا", "هر"}


def skeleton(w: str) -> str:
    return w.replace(ZWNJ, "")


class Speller:
    def __init__(self, freq: dict[str, int]):
        self.freq = freq

    def known(self, w: str) -> bool:
        return w in self.freq

    def accepted(self, w: str, depth: int = 2) -> bool:
        # a ZWNJ compound is fine when its parts are: «نیم‌فاصله»، «حاصل‌مصدرها»
        if ZWNJ in w and depth == 2:
            parts = [p for p in w.split(ZWNJ) if p]
            if all(len(p) <= 2 or self.accepted(p, 2) for p in parts):
                return True
        w = skeleton(w)
        if len(w) <= 2 or w in self.freq:
            return True
        if depth == 0:
            return False
        for p in PREFIXES:
            if w.startswith(p) and len(w) - len(p) >= 2 and self.accepted(w[len(p):], depth - 1):
                return True
        for s in SUFFIXES:
            if w.endswith(s) and len(w) - len(s) >= 2:
                stem = w[: -len(s)]
                if self.accepted(stem, depth - 1):
                    return True
                # silent ه before «گی/گان»: «خستگی» ← «خسته»
                if s in ("گی", "گان") and self.accepted(stem + "ه", depth - 1):
                    return True
        return False

    def edits1(self, w: str):
        for i in range(len(w) + 1):
            for c in ALPHABET:
                yield w[:i] + c + w[i:]
            if i < len(w):
                yield w[:i] + w[i + 1:]
                for c in ALPHABET:
                    if c != w[i]:
                        yield w[:i] + c + w[i + 1:]
            if i < len(w) - 1:
                yield w[:i] + w[i + 1] + w[i] + w[i + 2:]

    def score(self, w: str, cand: str) -> float:
        f = self.freq.get(cand, 0)
        # one sound-alike substitution counts as almost no error
        bonus = 1.0
        if len(w) == len(cand):
            diff = [(a, b) for a, b in zip(w, cand) if a != b]
            if len(diff) == 1 and any(diff[0][0] in g and diff[0][1] in g for g in SOUND_ALIKE):
                bonus = 50.0
        return f * bonus

    def check(self, word: str, n: int = 3) -> list[str] | None:
        """None if the word is fine or nothing good can be suggested; else suggestions."""
        if self.accepted(word):
            return None
        s = self.suggest(word, n)
        if not s:
            return None
        best = s[0]
        if " " in best:
            return s
        # only a frequent word is a convincing correction (names have rare neighbours)
        return s if self.freq.get(best, 0) >= MIN_SUGGESTION_FREQ else None

    def suggest(self, word: str, n: int = 3) -> list[str]:
        w = skeleton(word)
        cands = {c for c in self.edits1(w) if self.accepted(c, 1)}
        if not cands and len(w) >= 6:
            cands = {c2 for c1 in self.edits1(w) for c2 in self.edits1(c1) if c2 in self.freq}
        ranked = sorted(cands, key=lambda c: -self.score(w, c))
        out = ranked[:n]
        # two words run together: «درکانادا» → «در کانادا»; first when the first
        # part is a function word, which is how most of these happen
        for i in range(1, len(w) - 1):
            a, b = w[:i], w[i:]
            if (a in FUNCTION_WORDS or self.freq.get(a, 0) >= 1000) and self.freq.get(b, 0) >= 1000:
                if a in FUNCTION_WORDS:
                    out.insert(0, a + " " + b)
                else:
                    out.append(a + " " + b)
                break
        return out[:n]
