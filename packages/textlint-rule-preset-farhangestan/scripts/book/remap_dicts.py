"""
Rewrite «ص N» / «ص N–M» in the word lists to the exact page of the published
PDF where the entry's word appears (searching near the cited range).
Usage: python3 -I scripts/book/remap_dicts.py pages.txt [--write]
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from pages import load, load_spaced, norm, spaced

FA = "۰۱۲۳۴۵۶۷۸۹"
fa = lambda n: "".join(FA[int(c)] for c in str(n))
en = lambda s: int("".join(str(FA.index(c)) for c in s))
PAGE = re.compile(r"ص ([۰-۹]+)(?:–([۰-۹]+))?")
DICT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "dict")

P = load(sys.argv[1])
PS = load_spaced(sys.argv[1])
# matched running text, not the list: keep the cited page
KEEP = {"الزاماً", "معمولاً", "به‌عنوان", "جابه‌جایی", "به‌جای", "به‌کلی", "به‌کلّی", "خود را", "پیش‌از", "به‌طور", "معنا"}
# entries found in a note (تبصره) of another subsection than the one cited
LABELS = {
    ("ترکیب‌ها، الف، ص ۵۸–۶۱", 62): "ترکیب‌ها، ب-۲، تبصره، ص ۶۲",
    ("ترکیب‌ها، الف، ص ۵۸–۶۱", 63): "ترکیب‌ها، ب-۵، تبصره، ص ۶۳",
    ("ترکیب‌ها، الف، ص ۵۸–۶۱", 65): "ترکیب‌ها، ب-۱۰، تبصره، ص ۶۵",
    ("ترکیب‌ها، ب-۹، ص ۶۴", 65): "ترکیب‌ها، ب-۹، تبصره، ص ۶۵",
}
write = "--write" in sys.argv
report = []

def search(words, pages):
    for w in words:
        nw = norm(w)
        if len(nw) < 3: continue
        if len(nw) <= 4:  # short: whole word only («قوز» is inside «چلغوز»)
            sw = " " + spaced(w).strip() + " "
            hits = [p for p in pages if sw in PS[p - 1]]
        else:
            hits = [p for p in pages if nw in P[p - 1]]
        if hits: return hits
    return []

def stems(words):
    """«مسئولیت» → «مسئولی», «مسئول»…: the book often lists only the base word."""
    out = []
    for w in words:
        nw = norm(w)
        out += [nw[:-k] for k in (1, 2, 3) if len(nw) - k >= 4]
    return out

def locate(words, src, window=None, kind=""):
    m = PAGE.search(src)
    if not m or words[0] in KEEP: return src, None
    lo = en(m.group(1)); hi = en(m.group(2)) if m.group(2) else lo
    window = window or range(max(1, lo - 4), min(len(P), hi + 4) + 1)
    found = search(words, window)
    how = ""
    if not found and kind == "arabic" and any("ة" in w for w in words):
        # «ثقة‌الاسلام»، «دایرة‌المعارف»: rule 3 of «ة» lists them on its own page
        found = search(words, range(21, 72)); how = " (whole book)"
    if not found and kind == "hamza":
        found = search(stems(words), window); how = " (stem)"
    if not found:
        return src, f"NOT FOUND {words[:2]} in {lo}-{hi}"
    page = min(found, key=lambda p: (0 if lo <= p <= hi else 1, abs(p - lo)))
    new = src[:m.start()] + "ص " + fa(page) + src[m.end():]
    for (old, pg), label in LABELS.items():
        if src.endswith(old) and page == pg: new = src[: -len(old)] + label
    return new, None if lo <= page <= hi and lo == hi else f"{words[0]}: {m.group(0)} → ص {fa(page)}{how}"

for name in ["arabic", "hamza", "compounds", "multi-spelling"]:
    path = os.path.join(DICT, name + ".json")
    d = json.load(open(path, encoding="utf-8"))
    changed = 0
    for e in d["entries"]:
        if "source" not in e: continue
        words = [e["to"]] + list(e["from"]) if isinstance(e.get("to"), str) else list(e["from"])
        window = None
        if name == "multi-spelling":
            window = range(73, 82) if "عامّ" in e["source"] else range(82, 86)
        new, note = locate(words, e["source"], window, name)
        if note and "NOT FOUND" in note:
            # sections whose rule (not the word) is what the entry cites
            if "ص ۵۴–۵۵" in e["source"]: new = e["source"].replace("ص ۵۴–۵۵", "ص ۵۵")  # الف مقصوره، ص ۵۵
            if words[0].startswith("ابن"): new = PAGE.sub("ص ۳۶", e["source"])        # «ابن/ بن»، ص ۳۶
        if note: report.append(f"{name}\t{note}")
        if new != e["source"]: e["source"] = new; changed += 1
    print(name, "changed", changed, "of", len(d["entries"]))
    if write:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(d, fh, ensure_ascii=False, indent=1); fh.write("\n")
path = os.path.join(DICT, "book-joined.json")
d = json.load(open(path, encoding="utf-8"))
for g in d["groups"]:
    pages = set()
    for w in g["words"]:
        new, note = locate([w], g["source"])
        m = PAGE.search(new)
        if m and not note or (note and "NOT" not in note): pages.add(en(m.group(1)))
        elif note: report.append(f"book-joined\t{note}")
    if pages:
        a, b = min(pages), max(pages)
        g["source"] = PAGE.sub("ص " + fa(a) + ("" if a == b else "–" + fa(b)), g["source"])
    print("book-joined", g["source"])
if write:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(d, fh, ensure_ascii=False, indent=1); fh.write("\n")
print("\n".join(report))
