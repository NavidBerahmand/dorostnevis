"""
Page lookup in the published PDF of دستور خطّ فارسی (ویراست جدید):
https://apll.ir/wp-content/uploads/2023/07/Dastour-e-Khat-17.04.1402.pdf
In that file the PDF page index equals the printed page number.

Usage: pdftotext Dastour-e-Khat-17.04.1402.pdf pages.txt
       python3 -I pages.py pages.txt WORD...        # pages where each word occurs
"""
import re, sys, unicodedata

def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[‎‏‪-‮ـً-ٰٟ‌‍-]", "", s)
    s = (s.replace("ي", "ی").replace("ى", "ی").replace("ك", "ک").replace("ۀ", "ه").replace("ة", "ه")
         .replace("أ", "ا").replace("إ", "ا").replace("االله", "الله"))
    return re.sub(r"[^آ-یءئؤپچژکگ]", "", s)

def spaced(s: str) -> str:
    """Like norm(), but words stay apart (for whole-word checks of short words)."""
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[\u200e\u200f\u202a-\u202e\u0640\u064b-\u065f\u0670\u200c\u200d\ue000-\uf8ff]", "", s)
    s = (s.replace("ي", "ی").replace("ى", "ی").replace("ك", "ک").replace("ۀ", "ه").replace("ة", "ه")
         .replace("أ", "ا").replace("إ", "ا"))
    return " " + re.sub(r"[^آ-یءئؤپچژکگ]+", " ", s) + " "

def load_spaced(path: str) -> list[str]:
    return [spaced(p) for p in open(path, encoding="utf-8").read().split("\f")]

def load(path: str) -> list[str]:
    """Normalized letters of each page; index 0 is page 1."""
    return [norm(p) for p in open(path, encoding="utf-8").read().split("\f")]

def find(pages: list[str], word: str) -> list[int]:
    w = norm(word)
    return [i + 1 for i, p in enumerate(pages) if w and w in p]

if __name__ == "__main__":
    P = load(sys.argv[1])
    for w in sys.argv[2:]:
        print(w, find(P, w))
