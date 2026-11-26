"""
Human orthographic edits from a Persian Wikipedia history dump.

Streams a pages-meta-history XML (7z -so … | python3 -I extract_edits.py -) and,
for each pair of consecutive revisions of an article (namespace 0), finds the
places where a person changed only how words are written: the letters stay the
same once spaces, ZWNJs, Arabic/Persian letter forms, hamza seats and
diacritics are ignored («کتاب ها» → «کتاب‌ها»، «رییس» → «رئیس»، «خانه ی» → «خانهٔ»).

Skipped: bots (user name or comment), reverts, and large edits (more than
MAX_CHANGED_LINES changed lines). Output, one JSON object per change:

  {"page", "rev", "user", "comment", "before", "after", "context"}

where before/after are the changed words and context is the new line around them.
"""
import difflib
import json
import re
import sys
import xml.etree.ElementTree as ET

MAX_CHANGED_LINES = 40
MAX_LINE = 2000
BOT = re.compile(r"bot\b|ربات|Bot|BOT", re.I)
# semi-automatic editing tools: a person accepts what the tool's own rules propose
TOOL = re.compile(r"ابرابزار|ویرایشگر|اشتباه‌یاب|اشتباه یاب|AWB|AutoWikiBrowser|ابزار|وپ:اب|ویرایش‌گر", re.I)
MARKUP = re.compile(r"[|{}<>=\[\]'\\/#*&;]|https?:")
DIACRITICS = re.compile(r"[\u064B-\u065F\u0670]")
REVERT = re.compile(r"واگردان|خنثی|برگرداندن|rv\b|revert|undid|undo|بازگرد", re.I)

TATWEEL_DIACRITICS = re.compile(r"[ـً-ٰٟ‌‍‎‏ \s]")
SKELETON_MAP = str.maketrans({
    "ي": "ی", "ى": "ی", "ك": "ک", "ۀ": "ه", "ة": "ه", "ئ": "ی", "أ": "ا", "إ": "ا", "ؤ": "و", "ء": "",
    "ٔ": "", "ە": "ه", "ھ": "ه", "ہ": "ه",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
})
PERSIAN = re.compile(r"[؀-ۿ]")
# a token: a run of non-space characters (ZWNJ stays inside the token)
TOKEN = re.compile(r"[^\s]+")


def skeleton(s: str) -> str:
    return TATWEEL_DIACRITICS.sub("", s.translate(SKELETON_MAP))


def changes_in_line(old: str, new: str):
    """Token-level replacements in a line whose letters did not change."""
    a = TOKEN.findall(old)
    b = TOKEN.findall(new)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        before = " ".join(a[i1:i2])
        after = " ".join(b[j1:j2])
        if not before or not after or before == after:
            continue
        if not PERSIAN.search(before + after):
            continue
        # wiki markup, links and references are not prose
        if MARKUP.search(before) or MARKUP.search(after):
            continue
        # only vowel marks added or removed («انسو» → «اِنسو»): not an orthographic fix
        if DIACRITICS.sub("", before) == DIACRITICS.sub("", after):
            continue
        if skeleton(before) != skeleton(after):
            continue
        yield before, after, " ".join(b[max(0, j1 - 6):j2 + 6])


def pair_changes(old_text: str, new_text: str):
    ol = old_text.split("\n")
    nl = new_text.split("\n")
    sm = difflib.SequenceMatcher(None, ol, nl, autojunk=False)
    changed = 0
    out = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        changed += max(i2 - i1, j2 - j1)
        if changed > MAX_CHANGED_LINES:
            return []
        if tag != "replace" or i2 - i1 != j2 - j1:
            continue
        for o, n in zip(ol[i1:i2], nl[j1:j2]):
            if len(o) > MAX_LINE or len(n) > MAX_LINE:
                continue
            out.extend(changes_in_line(o, n))
    return out


def main(path: str):
    src = sys.stdin.buffer if path == "-" else open(path, "rb")
    ns = ""
    page_title = None
    page_ns = None
    prev_text = None
    n_pairs = n_out = 0
    for event, el in ET.iterparse(src, events=("start", "end")):
        tag = el.tag.rsplit("}", 1)[-1]
        if event == "start":
            if tag == "page":
                page_title, page_ns, prev_text = None, None, None
            continue
        if tag == "title":
            page_title = el.text
        elif tag == "ns":
            page_ns = el.text
        elif tag == "revision":
            if page_ns == "0":
                text_el = next((c for c in el if c.tag.endswith("text")), None)
                text = (text_el.text or "") if text_el is not None else ""
                contributor = next((c for c in el if c.tag.endswith("contributor")), None)
                user = ""
                if contributor is not None:
                    u = next((c for c in contributor if c.tag.endswith("username") or c.tag.endswith("ip")), None)
                    user = (u.text or "") if u is not None else ""
                comment_el = next((c for c in el if c.tag.endswith("comment")), None)
                comment = (comment_el.text or "") if comment_el is not None else ""
                rev_el = next((c for c in el if c.tag.endswith("id")), None)
                rev = rev_el.text if rev_el is not None else ""
                if prev_text is not None and text and not BOT.search(user) and not BOT.search(comment) and not REVERT.search(comment):
                    n_pairs += 1
                    for before, after, ctx in pair_changes(prev_text, text):
                        n_out += 1
                        print(json.dumps({"page": page_title, "rev": rev, "user": user, "comment": comment,
                                          "kind": "tool" if TOOL.search(comment) else "manual",
                                          "before": before, "after": after, "context": ctx}, ensure_ascii=False))
                prev_text = text
            el.clear()
        elif tag == "page":
            el.clear()
    print(f"pairs {n_pairs}, changes {n_out}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
