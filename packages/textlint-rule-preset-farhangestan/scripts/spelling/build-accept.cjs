// The checker's accept list (1.6.4): names, loanwords and spoken forms the corpora know but the
// Wikipedia lexicon does not, added to src/dict/spelling-lexicon.json as "accept". A word is taken if
// the checker does not already accept it and it is on at least ten blog and forum sites, in at least
// two Wikipedia articles, or part of a Wikipedia title and seen twice (mine_accept.py counts them).
// Not a tanvin typed as «آ/أ» («واقعآ»: the checker corrects it), not two words of more than 3,000
// occurrences each run together («فکرکنم»).
//
// Also "encyclopedic": words Wikipedia uses at least 50 times and blogs under one time in seven as often;
// "namefirst": first names, words that begin many Wikipedia titles of two or three words.
//
// Usage: npm run build && node scripts/spelling/build-accept.cjs blogs.json wikipedia.json
const fs = require("fs");
const path = require("path");
const SP = require("../../lib/util/speller.js");

const [blogsPath, wikiPath] = process.argv.slice(2);
const blogs = JSON.parse(fs.readFileSync(blogsPath, "utf8"));
const wiki = JSON.parse(fs.readFileSync(wikiPath, "utf8"));
const WORD = /^[ء-غف-يپچژکگیآ]{3,}$/;
const take = new Set();
// not two very frequent words run together («فکرکنم»، «اونروز»: the checker offers them apart)
const runTogether = (w) => {
    for (let i = 2; i <= w.length - 2; i++) if ((blogs[w.slice(0, i)]?.[0] ?? 0) >= 3000 && (blogs[w.slice(i)]?.[0] ?? 0) >= 3000) return true;
    return false;
};
for (const [w, [, sites]] of Object.entries(blogs)) if (sites >= 10 && !/[آأ]$/.test(w) && !runTogether(w)) take.add(w);
for (const [w, [count, articles, titles]] of Object.entries(wiki)) if (articles >= 2 || (titles >= 1 && count >= 2)) take.add(w);
const out = [...take].filter((w) => WORD.test(w) && !SP.accepted(w)).sort();
const file = path.join(__dirname, "..", "..", "src", "dict", "spelling-lexicon.json");
const lex = JSON.parse(fs.readFileSync(file, "utf8"));
lex.source = lex.source.replace(/; accept: .*$/, "") + "; accept: names, loanwords and spoken forms of at least ten blog and forum sites, two Wikipedia articles or a Wikipedia title (scripts/spelling/build-accept.cjs)";
lex.accept = out.join(" ");
// words the checker may offer (bucket 7 and up) that Wikipedia uses at least 50 times and blogs under one
// time in seven as often: mostly names, never offered for a word one letter away («ژوکف» is «ژوکوف»)
const encyclopedic = Object.entries(lex.buckets).filter(([b]) => Number(b) >= 7).flatMap(([, ws]) => ws.split(" "))
    .filter((w) => (wiki[w]?.[0] ?? 0) >= 50 && ((blogs[w]?.[0] ?? 0) + 1) / ((wiki[w]?.[0] ?? 0) + 1) < 0.15).sort();
lex.encyclopedic = encyclopedic.join(" ");
// first names: words that begin at least 3 Wikipedia titles of two or three words, one time in 25 they are
// seen («کارل»، «یوهان»، «کاترین»): the word after one is a name
const nameFirst = Object.entries(wiki).filter(([w, v]) => WORD.test(w) && v.length > 3 && v[3] >= 3 && v[3] / (v[0] + v[3]) >= 0.04).map(([w]) => w).sort();
lex.namefirst = nameFirst.join(" ");
lex.source = lex.source.replace(/; namefirst: .*$/, "");
lex.source = lex.source.replace(/; encyclopedic: .*$/, "") + "; encyclopedic: words Wikipedia uses at least 50 times and blogs under one time in seven as often, never offered; namefirst: words that begin Wikipedia titles of two or three words (first names)";
fs.writeFileSync(file, JSON.stringify(lex) + "\n");
console.error(out.length, "accepted,", encyclopedic.length, "encyclopedic,", nameFirst.length, "first names,", Math.round(fs.statSync(file).size / 1024), "KB");
