#!/usr/bin/env python3
"""
Extract plain-text paragraphs from a Persian Wikipedia XML dump (or a slice
of one), one JSON object per article: {"title": ..., "paras": [...]}.

Usage: python3 -I extract_wiki.py dump.xml > articles.jsonl
       bzip2 -dc dump.xml.bz2 | python3 -I extract_wiki.py - > articles.jsonl
"""
import html
import json
import re
import sys

PAGE = re.compile(r"<page>(.*?)</page>", re.S)
TITLE = re.compile(r"<title>(.*?)</title>")
NS = re.compile(r"<ns>(\d+)</ns>")
TEXT = re.compile(r"<text[^>]*>(.*?)</text>", re.S)


def clean(t: str) -> str:
    t = html.unescape(t)
    for _ in range(3):
        t = re.sub(r"\{\{[^{}]*\}\}", "", t)
    t = re.sub(r"<ref[^>]*/>", "", t)
    t = re.sub(r"<ref.*?</ref>", "", t, flags=re.S)
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"\[https?://\S+ ?([^\]]*)\]", r"\1", t)
    t = re.sub(r"'{2,}", "", t)
    return t


def pages(path: str):
    """Stream <page> bodies; reads stdin when path is «-» (e.g. from bzip2 -dc)."""
    fh = sys.stdin if path == "-" else open(path, encoding="utf-8", errors="ignore")
    buf = []
    inside = False
    for line in fh:
        if "<page>" in line:
            inside, buf = True, []
        if inside:
            buf.append(line)
        if "</page>" in line and inside:
            inside = False
            yield "".join(buf)


def main(path: str) -> None:
    for body in pages(path):
        ns = NS.search(body)
        if not ns or ns.group(1) != "0":
            continue
        text = TEXT.search(body)
        if not text or text.group(1).lstrip().startswith("#"):
            continue
        paras = []
        for line in clean(text.group(1)).split("\n"):
            line = line.strip()
            if len(line) < 60 or line[0] in "|!{}=*#:;[":
                continue
            if sum(1 for c in line if "؀" <= c <= "ۿ") < len(line) * 0.6:
                continue
            paras.append(line)
        if paras:
            print(json.dumps({"title": TITLE.search(body).group(1), "paras": paras}, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1])
