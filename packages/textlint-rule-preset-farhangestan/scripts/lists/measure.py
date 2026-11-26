"""
How the three lists fare against human edits on Wikipedia (extract_edits.py output):
  fixes        the list makes exactly the editor's change
  contradicts  an editor undid what the list would do (e.g. split a listed compound)
Usage: python3 -I measure.py lists.json edits.jsonl [...] 
"""
import collections
import json
import sys

ZWNJ = "‌"


def main(lists_path, edit_paths):
    L = json.load(open(lists_path, encoding="utf-8"))
    comp = {c["spaced"]: c["form"] for c in L["compounds"]}
    comp_rev = {v: k for k, v in comp.items()}
    ra = {r["word"] for r in L["ra"]}
    ez = {e["pair"] for e in L["ezafe"]}
    seen = set()
    res = collections.defaultdict(collections.Counter)
    examples = collections.defaultdict(list)
    for p in edit_paths:
        for line in open(p, encoding="utf-8"):
            e = json.loads(line)
            k = (e["page"], e["before"], e["after"])
            if k in seen:
                continue
            seen.add(k)
            b, a = e["before"], e["after"]
            strip = lambda s: s.strip(".،؛:!؟()«»\"")
            bs, as_ = strip(b), strip(a)
            # compounds: «X Y» → «X‌Y»
            for sp, form in comp.items():
                if sp in bs and form in as_:
                    res["compounds"]["fixes"] += 1
                    examples["compounds"].append(f"{b} → {a}")
                    break
                if form in bs and sp in as_:
                    res["compounds"]["contradicts"] += 1
                    examples["compounds-contra"].append(f"{b} → {a}")
                    break
            # «Wرا» → «W را»
            if bs.endswith("را") and bs[:-2] in ra and as_ == bs[:-2] + " را":
                res["ra"]["fixes"] += 1
                examples["ra"].append(f"{b} → {a}")
            if as_.endswith("را") and as_[:-2] in ra and bs == as_[:-2] + " را":
                res["ra"]["contradicts"] += 1
                examples["ra-contra"].append(f"{b} → {a}")
            # ezafe: «Xه» → «Xهٔ»/«Xۀ» before Y; Y is the next word in the line
            if bs.endswith("ه") and (as_ == bs + "ٔ" or as_ == bs[:-1] + "ۀ"):
                ctx = e["context"].split(" ")
                try:
                    j = ctx.index(a)
                except ValueError:
                    j = -1
                nxt = ctx[j + 1] if 0 <= j < len(ctx) - 1 else ""
                nxt = nxt[:-1] if nxt.endswith("هٔ") else (nxt[:-1] + "ه" if nxt.endswith("ۀ") else nxt)
                res["ezafe-edits"]["total"] += 1
                if f"{bs} {nxt}" in ez:
                    res["ezafe"]["fixes"] += 1
                    examples["ezafe"].append(f"{b} {nxt} → {a} {nxt}")
    print(json.dumps({k: dict(v) for k, v in res.items()}, ensure_ascii=False))
    for k, v in examples.items():
        print(f"\n{k} ({len(v)}):")
        for x in v[:15]:
            print("  ", x)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
