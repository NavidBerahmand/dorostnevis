import json, re, collections, sys
TOK = re.compile(r"[ء-غف-يً-ٰٕٱ-ۓە‌]+|[^\sء-ە‌]")
W = re.compile(r"^[ء-ە‌]")
D = lambda t: re.sub("[ً-ْٰ]", "", t)
FUNC = set("برای ولی وی دری".split())
ezp = collections.Counter()
for line in open(sys.argv[1], encoding="utf-8"):
    for para in json.loads(line)["paras"]:
        toks = TOK.findall(para)
        for i in range(1, len(toks)):
            p, t = toks[i - 1], toks[i]
            if not W.match(t) or not W.match(p):
                continue
            if p.endswith(("ِ", "هٔ", "ۀ")) or (D(p).endswith("های") and len(D(p)) > 3) or (len(D(p)) >= 3 and D(p).endswith(("ای", "وی")) and D(p) not in FUNC):
                ezp[D(t)] += 1
json.dump({k: v for k, v in ezp.items() if v >= 2}, open(sys.argv[2], "w"), ensure_ascii=False)
