"""
Feature extraction for the ezafe model. src/util/ezafe-model.ts mirrors this
file exactly; test/ezafe-model-test.ts checks both give the same scores.

The model answers one question: is a word that ends in a silent «ه», and is
followed by another word, in the ezafe («خانهٔ قبلی») or not («خانه بزرگ است»)?
"""
import json
import os
import re

_DICT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "dict")
_POS = {}
for _tag, _words in json.load(open(os.path.join(_DICT, "ezafe-pos.json"), encoding="utf-8"))["tags"].items():
    for _w in _words.split(" "):
        _POS[_w] = _tag
_VERBS = json.load(open(os.path.join(_DICT, "hazm-verbs.json"), encoding="utf-8"))
PAST = set(_VERBS["past"])
PRESENT = set(_VERBS["present"])
PAST_END = ["یم", "ید", "ند", "م", "ی", ""]
PRESENT_END = ["یم", "ید", "ند", "م", "ی", "د"]

ZWNJ = "‌"
HAMZA_ABOVE = "ٔ"
MARKS = re.compile("[ً-ٕٓ-ٰٟ]")
TOKEN = re.compile(f"[ء-غف-ئٱ-ۓەۀیکگپچژ{ZWNJ}]+|[0-9۰-۹]+|[A-Za-z]+|\\S")
WORD = re.compile(f"^[ء-غف-يٱ-ۓەیکگپچژ{ZWNJ}]+$")

PRONOUNCED_HE = {
    "به", "مه", "ده", "ره", "شه", "که", "گره", "زره", "بزه", "فربه", "توجه", "متوجه",
    "منزه", "مشتبه", "مشبه", "تنبه", "متنبه", "فرمانده", "بازده", "سپهبد", "وجه", "شبه",
}
NOT_EZAFE = {
    "بلکه", "که", "چه", "آنچه", "هرچه", "چنانچه", "اگرچه", "گرچه", "همیشه", "البته", "دوباره", "همواره",
    "هماره", "یکباره", "وگرنه", "نه", "ناگه", "همانا", "زیراکه", "چنانکه", "آنکه", "اینکه",
    # determiners and numbers: «این‌گونه واژه‌ها»، «سه کتاب»
    "اینگونه", "این‌گونه", "آنگونه", "آن‌گونه", "همین‌گونه", "همان‌گونه", "همینگونه", "همانگونه", "هرگونه", "هیچ‌گونه", "هیچگونه", "چگونه", "بدین‌گونه", "بدینگونه", "سه", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "هیجده", "نوزده",
}


def normalize(text: str) -> str:
    """Arabic letters to Persian, harakat removed; ezafe marks are kept (see plain())."""
    text = text.replace("ي", "ی").replace("ى", "ی").replace("ك", "ک")
    return MARKS.sub("", text)


def ends_with_silent_he(word: str) -> bool:
    if not word.endswith("ه") or len(word) < 2 or word in PRONOUNCED_HE:
        return False
    return word[-2] not in "اویآ"


def tokens(text: str) -> list[str]:
    return TOKEN.findall(text)


def plain(tok: str) -> str:
    """A token as it looks with no ezafe mark: «خانهٔ»، «خانۀ» → «خانه»."""
    if tok.endswith("ه" + HAMZA_ABOVE):
        return tok[:-1]
    if tok.endswith("ۀ"):
        return tok[:-1] + "ه"
    return tok


def norm_tok(tok: str) -> str:
    if WORD.match(tok):
        return tok
    if tok[0].isdigit() or "۰" <= tok[0] <= "۹":
        return "<N>"
    if tok[0].isascii() and tok[0].isalpha():
        return "<L>"
    return "<P>"


def is_verb(w: str) -> bool:
    """A finite verb («می‌رود»، «رفتند»، «بگوید»، «نیست»، «است»)."""
    if w in ("است", "نیست", "هست", "بود", "باشد", "شد", "کرد"):
        return True
    for pre in ("نمی" + ZWNJ, "می" + ZWNJ, "نمی", "می", "ب", "ن", ""):
        if not w.startswith(pre):
            continue
        rest = w[len(pre):]
        if len(rest) < 2:
            continue
        if pre and any(rest.endswith(e) and rest[: len(rest) - len(e)] in PRESENT for e in PRESENT_END):
            return True
        if pre in ("", "ن", "نمی" + ZWNJ, "می" + ZWNJ, "نمی", "می") and any(rest.endswith(e) and rest[: len(rest) - len(e)] in PAST for e in PAST_END if rest != e):
            return True
    return False


def tag(w: str) -> str:
    if w.startswith("<"):
        return w
    if is_verb(w):
        return "V"
    if w.endswith("ه") and w[:-1] in PAST:
        return "PART"
    t = _POS.get(w)
    if t:
        return t
    if ZWNJ in w and w.split(ZWNJ)[-1] in ("ها", "های", "هایی"):
        return "PL"
    return "UNK"


def context(toks: list[str], i: int, step: int, n: int) -> list[str]:
    """n tokens before (step -1) or after (step 1) i, stopping at punctuation."""
    out = []
    j = i + step
    while len(out) < n:
        if j < 0 or j >= len(toks):
            out.append("<S>")
            break
        t = norm_tok(toks[j])
        out.append(t)
        if t == "<P>":
            break
        j += step
    while len(out) < n:
        out.append("<S>")
    return out


def features(toks: list[str], i: int) -> list[str]:
    """Features for the word toks[i] (plain form, ending in a silent «ه»)."""
    w0 = toks[i]
    w1, w2 = context(toks, i, 1, 2)
    m1, m2 = context(toks, i, -1, 2)
    f = [
        "b",
        "w0=" + w0,
        "w0s=" + w0[-4:],
        "w1=" + w1,
        "w2=" + w2,
        "m1=" + m1,
        "m2=" + m2,
        "w1p=" + w1[:2],
        "w1s=" + w1[-2:],
        "w1s1=" + w1[-1:],
        "m1s=" + m1[-2:],
        "w0w1=" + w0 + "|" + w1,
        "m1w0=" + m1 + "|" + w0,
        "w1w2=" + w1 + "|" + w2,
        "w0w1s=" + w0 + "|" + w1[-2:],
        "w0t=" + tag(w0),
        "w1t=" + tag(w1),
        "w2t=" + tag(w2),
        "m1t=" + tag(m1),
        "w1tw2t=" + tag(w1) + "|" + tag(w2),
        "m1tw1t=" + tag(m1) + "|" + tag(w1),
        "w0w1t=" + w0 + "|" + tag(w1),
    ]
    return f


def candidates(text: str):
    """Yield (features, label, word) for every silent-«ه» word followed by a word.

    The label comes from the ezafe mark in the text: «هٔ»، «ۀ»، «ه‌ی»، «ه ی» → 1."""
    raw = tokens(normalize(text))
    # fold «خانه ی» / «خانه‌ی» into one marked token
    toks, marked = [], []
    k = 0
    while k < len(raw):
        t = raw[k]
        if t.endswith("ه" + ZWNJ + "ی") and len(t) > 3:
            toks.append(t[:-2]); marked.append(True)
        elif t.endswith("ه") and k + 1 < len(raw) and raw[k + 1] == "ی":
            toks.append(t); marked.append(True); k += 1
        else:
            p = plain(t)
            toks.append(p); marked.append(p != t)
        k += 1
    for i, w in enumerate(toks):
        if not ends_with_silent_he(w) or w in NOT_EZAFE or ZWNJ in w[-2:]:
            continue
        if i + 1 >= len(toks) or not WORD.match(toks[i + 1]):
            continue
        yield features(toks, i), int(marked[i]), w


# --- joined «را» («کتابرا» → «کتاب را») ---------------------------------------
_KNOWN = set(json.load(open(os.path.join(_DICT, "hazm-words.json"), encoding="utf-8"))["words"])
# pronouns and demonstratives + «را» are handled by word lists, not the model
RA_SKIP_STEMS = {"آن", "این", "خود", "ما", "تو", "شما", "آنها", "اینها", "او", "من", "هم", "مرا", "چه"}


def ra_features(t: str, toks: list[str], i: int) -> list[str]:
    """Features for the token t = X + «را», at position i of toks (t itself is toks[i])."""
    x = t[:-2]
    w1, w2 = context(toks, i, 1, 2)
    m1, _ = context(toks, i, -1, 2)
    return [
        "b",
        "x=" + x,
        "xs=" + x[-3:],
        "ts=" + t[-4:],
        "tk=" + ("1" if t in _KNOWN else "0"),
        "xt=" + tag(x),
        "xlen=" + str(min(len(x), 6)),
        "w1=" + w1,
        "w1t=" + tag(w1),
        "w1p=" + w1[:2],
        "w2t=" + tag(w2),
        "m1=" + m1,
        "m1t=" + tag(m1),
        "xw1t=" + x + "|" + tag(w1),
        "m1tw1t=" + tag(m1) + "|" + tag(w1),
    ]


def ra_candidate(t: str) -> bool:
    """A token the «را» model looks at: X + «را», X a known word, not a pronoun."""
    return t.endswith("را") and len(t) >= 4 and t[:-2] in _KNOWN and t[:-2] not in RA_SKIP_STEMS and ZWNJ not in t


def ra_examples(text: str, sample_positive: float, rnd):
    """Training examples. Wikipedia writes «را» apart, so:
    - every joined token X + «را» in the text is a word ending in «را» (label 0: «لورا»، «کارا»);
    - «X را» written apart becomes a synthetic joined token (label 1), sampled."""
    toks = [plain(t) for t in tokens(normalize(text))]
    for i, t in enumerate(toks):
        if ra_candidate(t):
            yield ra_features(t, toks, i), 0
        elif i + 1 < len(toks) and toks[i + 1] == "را" and WORD.match(t):
            joined = t + "را"
            if ra_candidate(joined) and rnd.random() < sample_positive:
                merged = toks[:i] + [joined] + toks[i + 2:]
                yield ra_features(joined, merged, i), 1


def ra_candidates(text: str):
    """(features, token) for every candidate token in text, as the rule sees it."""
    toks = [plain(t) for t in tokens(normalize(text))]
    for i, t in enumerate(toks):
        if ra_candidate(t):
            yield ra_features(t, toks, i), t
