/**
 * Spelling (typo) checker. Mirrors scripts/spelling/speller.py.
 *
 * A word is accepted if its letters (ZWNJ ignored: spacing is other rules'
 * job) are in the lexicon (word forms seen at least 3 times in Persian
 * Wikipedia, plus Hazm, فرهنگ املایی and the book's lists), or are a known
 * word plus common affixes, or a verb form. Otherwise suggestions are looked
 * for: frequent words at edit distance 1 (2 for long words), sound-alike
 * letters (ت/ط، س/ص/ث…) preferred, or two words run together («درکانادا»).
 * Without a convincing suggestion the word is not reported: unknown names
 * are common, typos with an obvious correction are what is worth showing.
 */
import { isKnown } from "./words";
import { verbForm } from "../rules/mi-prefix";
import lexiconData from "../dict/spelling-lexicon.json";
import hazmVerbs from "../dict/hazm-verbs.json";
import multiSpelling from "../dict/multi-spelling.json";
import hamza from "../dict/hamza.json";
import arabic from "../dict/arabic.json";

const PAST_STEMS = new Set<string>(hazmVerbs.past);
/** Forms the word lists already correct («اطاق»، «رییس»): the lexicon rule reports them. */
const LISTED = new Set<string>([multiSpelling, hamza, arabic].flatMap((d) => (d.entries as Array<{ from: string[] }>).flatMap((e) => e.from)));

const ZWNJ = "‌";
const ALPHABET = "ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیآئؤءأ";
const SOUND_ALIKE = ["تط", "سصث", "زذضظ", "هح", "قغ", "اآع", "ئی", "ءئأؤ"];
const PREFIXES = [
    "نمی", "می", "بی", "نا", "ب", "ن",
    // prefixes the book writes joined or with ZWNJ («غیرمساوی»، «بازآفرینی»، «پیش‌بینی»)
    "غیر", "ضد", "سوء", "هم", "پیش", "پس", "بر", "در", "باز", "فرا", "فرو", "وا", "ور", "نیم", "تک", "میان", "درون", "برون"
];
const SUFFIXES = [
    "هایشان", "هایتان", "هایمان", "هایش", "هایت", "هایم", "هایی", "های", "ها", "ان", "ات", "ین",
    "ترین", "تر", "ی", "ای", "یی", "م", "ت", "ش", "مان", "تان", "شان", "ام", "اش", "یم", "ید", "ند", "د", "ه",
    "اند", "ایم", "اید", "است", "ست", "گی", "گان"
].sort((a, b) => b.length - a.length);
const FUNCTION_WORDS = new Set(["و", "در", "از", "به", "با", "که", "را", "این", "آن", "تا", "بر", "هم", "یا", "هر"]);
/** Buckets are floor(log2(count)): 9 ≈ 500 occurrences, 10 ≈ 1000. */
const SUGGEST_BUCKET = 9;
const SPLIT_BUCKET = 10;
const SOUND_ALIKE_BONUS = 5.6; // ≈ log2(50)

let LEX: Map<string, number> | null = null;

/** Load the lexicon (the site loads it lazily; Node loads the bundled file). */
export function loadSpellingLexicon(data: { buckets: Record<string, string> }): void {
    const m = new Map<string, number>();
    for (const [b, words] of Object.entries(data.buckets)) {
        if (!words) continue;
        for (const w of words.split(" ")) m.set(w, Number(b));
    }
    LEX = m;
}

function lex(): Map<string, number> | null {
    if (!LEX && (lexiconData as { buckets?: Record<string, string> }).buckets) loadSpellingLexicon(lexiconData as { buckets: Record<string, string> });
    return LEX;
}

export function spellingReady(): boolean {
    return lex() !== null && LEX!.size > 0;
}

const skeleton = (w: string) => w.replace(/‌/g, "");

/** Spelling ignores what other rules own: Arabic letters, ezafe marks, harakat, edge ZWNJs. */
function normalize(w: string): string {
    return w
        .replace(/ي|ى/g, "ی")
        .replace(/ك/g, "ک")
        .replace(/ۀ/g, "ه")
        .replace(/هٔ/g, "ه")
        .replace(/[ً-ٰٟ]/g, "")
        .replace(/^‌+|‌+$/g, "");
}

const memo = new Map<string, string[] | null>();

function acceptedSkeleton(w: string, depth: number): boolean {
    const L = lex()!;
    if (w.length <= 2 || L.has(w) || isKnown(w) || verbForm(w) || LISTED.has(w)) return true;
    // infinitives: «انجامیدن» ← «انجامید»
    if (w.endsWith("ن") && PAST_STEMS.has(w.slice(0, -1))) return true;
    if (depth === 0) return false;
    for (const p of PREFIXES) {
        if (w.startsWith(p) && w.length - p.length >= 2 && acceptedSkeleton(w.slice(p.length), depth - 1)) return true;
    }
    for (const s of SUFFIXES) {
        if (!w.endsWith(s) || w.length - s.length < 2) continue;
        const stem = w.slice(0, -s.length);
        if (acceptedSkeleton(stem, depth - 1)) return true;
        if ((s === "گی" || s === "گان") && acceptedSkeleton(stem + "ه", depth - 1)) return true; // «خستگی» ← «خسته»
    }
    return false;
}

export function accepted(raw: string): boolean {
    const word = normalize(raw);
    // a ZWNJ compound is fine when its parts are: «نیم‌فاصله»، «حاصل‌مصدرها»
    if (word.includes(ZWNJ)) {
        const parts = word.split(ZWNJ).filter((p: string) => p.length > 0);
        // (a part may carry the linking «و/تا/به/ا» of «هست‌ونیست»، «گوش‌تاگوش»)
        const ok = (p: string) => p.length <= 2 || acceptedSkeleton(p, 2) || /^(و|تا|به|ا)/.test(p) && acceptedSkeleton(p.replace(/^(و|تا|به|ا)/, ""), 2);
        if (parts.every(ok)) return true;
        if (isKnown(word)) return true;
    }
    return acceptedSkeleton(skeleton(word), 2);
}

function* edits1(w: string): Generator<string> {
    for (let i = 0; i <= w.length; i++) {
        for (const c of ALPHABET) yield w.slice(0, i) + c + w.slice(i);
        if (i < w.length) {
            yield w.slice(0, i) + w.slice(i + 1);
            for (const c of ALPHABET) if (c !== w[i]) yield w.slice(0, i) + c + w.slice(i + 1);
        }
        if (i < w.length - 1) yield w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
    }
}

function score(w: string, cand: string, bucket: number): number {
    if (w.length === cand.length) {
        const diff: Array<[string, string]> = [];
        for (let i = 0; i < w.length; i++) if (w[i] !== cand[i]) diff.push([w[i], cand[i]]);
        if (diff.length === 1 && SOUND_ALIKE.some((g) => g.includes(diff[0][0]) && g.includes(diff[0][1]))) {
            return bucket + SOUND_ALIKE_BONUS;
        }
    }
    return bucket;
}

/** Up to three suggestions for a word the lexicon does not accept, or null. */
export function spellingSuggestions(raw: string): string[] | null {
    const L = lex();
    if (!L || L.size === 0) return null;
    const word = normalize(raw);
    const cached = memo.get(word);
    if (cached !== undefined) return cached;
    const result = suggestFor(word, L);
    if (memo.size > 20000) memo.clear();
    memo.set(word, result);
    return result;
}

function suggestFor(word: string, L: Map<string, number>): string[] | null {
    // a function word run into the next word: «درکانادا» → «در کانادا» (checked first:
    // the affix rules would otherwise accept «در» + «کانادا» as a prefixed word)
    const sk = skeleton(word);
    if (!L.has(sk) && !isKnown(word) && !isKnown(sk)) {
        for (const f of ["و", "در", "از", "به", "با", "که", "را", "این", "آن", "تا", "هر"]) {
            if (!sk.startsWith(f)) continue;
            const rest = sk.slice(f.length);
            if (rest.length >= 3 && (L.get(rest) ?? -1) >= SPLIT_BUCKET && !verbForm(rest)) return [f + " " + rest];
        }
    }
    if (accepted(word)) return null;
    // Arabic names and terms with the article: «المعلی»، «الدروس»
    if (word.startsWith("ال") && word.length >= 5) return null;
    const w = skeleton(word);
    const cands = new Map<string, number>();
    for (const c of edits1(w)) {
        const b = L.get(c);
        if (b !== undefined && b >= SUGGEST_BUCKET) cands.set(c, score(w, c, b));
    }
    if (cands.size === 0 && w.length >= 6) {
        for (const c1 of edits1(w)) {
            for (const c2 of edits1(c1)) {
                const b = L.get(c2);
                if (b !== undefined && b >= SUGGEST_BUCKET && !cands.has(c2)) cands.set(c2, b);
            }
        }
    }
    const out = [...cands.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 3);
    // two words run together: «درکانادا» → «در کانادا», first when it starts with a function word
    for (let i = 1; i < w.length - 1; i++) {
        const a = w.slice(0, i);
        const b = w.slice(i);
        if ((FUNCTION_WORDS.has(a) || (L.get(a) ?? -1) >= SPLIT_BUCKET) && (L.get(b) ?? -1) >= SPLIT_BUCKET) {
            if (FUNCTION_WORDS.has(a)) out.unshift(a + " " + b);
            else out.push(a + " " + b);
            break;
        }
    }
    return out.length ? out.slice(0, 3) : null;
}
