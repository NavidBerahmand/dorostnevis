/**
 * Spelling (typo) checker. Mirrors scripts/spelling/speller.py (the quality bar of 1.5.0,
 * below, is here only).
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
import names from "../dict/names.json";

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

/**
 * How common a form is in the corpus: floor(log2(count)), -1 if never seen; null while the
 * lexicon is not loaded (the page fetches it after it opens).
 */
export function corpusBucket(raw: string): number | null {
    const L = lex();
    if (!L || L.size === 0) return null;
    return L.get(skeleton(normalize(raw))) ?? -1;
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


/*
 * Persian given names (1.5.2: «مهردخت» was offered «مهرداد»): the lists in dict/names.json, and
 * names made of parts: «سید/محمد/امیر…» + a name, a name + «علی/سادات/دخت/بانو…», two names
 * («مهرانگیز» = «مهر» + «انگیز» is in the list; «ماه‌دخت»، «گل‌بانو»), and family names: a name or
 * a word + «پور/زاده/نیا/فر/راد/نژاد…» («رضاپور»، «کریمی‌نیا»، «حسین‌زاده»).
 */
const NAMES = new Set<string>((names as { names: string }).names.split(" "));
const NAME_PREFIXES = ["سید", "میرزا", "میر", "محمد", "امیر", "ملک", "شاه", "آقا", "حاجی", "حاج", "کربلایی", "مشهدی", "غلام", "ابو", "عبد", "بی‌بی"];
const NAME_SUFFIXES = ["السادات", "سادات", "بیگم", "بگم", "خانم", "خاتون", "دخت", "بانو", "ناز", "علی", "قلی", "الدین", "الدوله", "السلطنه", "الله", "اله", "رضا", "حسین", "بخش", "جان", "گل", "آقا", "خان"];
const FAMILY_SUFFIXES = ["زاده", "پور", "نیا", "فر", "راد", "نژاد", "وند", "لو", "کیا", "منش", "فرد", "زاد", "دوست", "مهر", "آبادی", "خانی", "یان"];
/** A name, or a word common enough to be one's part («مهر»، «گل»، «کریمی»). */
function namePart(w: string, L: Map<string, number>): boolean {
    return w.length >= 2 && (NAMES.has(w) || (L.get(w) ?? -1) >= 5 || isKnown(w));
}
function isName(w: string, L: Map<string, number>): boolean {
    if (NAMES.has(w)) return true;
    for (const p of NAME_PREFIXES) {
        const rest = w.slice(p.length);
        if (w.startsWith(p) && rest.length >= 3 && (NAMES.has(rest) || (L.get(rest) ?? -1) >= 8 || isName(rest, L))) return true;
    }
    for (const s of NAME_SUFFIXES) if (w.endsWith(s) && w.length - s.length >= 2 && (NAMES.has(w.slice(0, -s.length)) || (L.get(w.slice(0, -s.length)) ?? -1) >= 5)) return true;
    for (const s of FAMILY_SUFFIXES) if (w.endsWith(s) && w.length - s.length >= 2 && namePart(w.slice(0, -s.length), L)) return true;
    return false;
}

const NO_LEX = new Map<string, number>();
function acceptedSkeleton(w: string, depth: number): boolean {
    const L = lex() ?? NO_LEX; // the page fetches the lexicon after it opens
    if (w.length <= 2 || L.has(w) || isKnown(w) || verbForm(w) || LISTED.has(w) || isName(w, L)) return true;
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

/*
 * The quality bar for a suggestion (since 1.5.0: «چمدون‌های» was offered «نمونهای»):
 * - one edit, or two only when one of them is a substitution of a neighbouring key or of a
 *   letter commonly confused with it (ت/ط، س/ص/ث، ب/پ، ک/گ…): a weighted distance of at most
 *   1.5, where such a substitution, or two letters swapped, costs 0.5 and any other edit 1;
 * - the same first letter, unless the first letter is the one swapped for a near one;
 * - the most frequent such word first (corpus count), a cheaper edit before a dearer one.
 * Words the old, looser search found candidates for but none passes are still reported,
 * without a replacement («در واژه‌نامه نیست»).
 */
const KEY_ROWS = ["ضصثقفغعهخحجچ", "شسیبلاتنمکگ", "ظطزرذدپو"];
const KEY_POS = new Map<string, [number, number]>();
KEY_ROWS.forEach((row, r) => [...row].forEach((c, i) => KEY_POS.set(c, [r, i])));
const CONFUSED = [...SOUND_ALIKE, "بپتثنی", "جچحخ", "دذ", "رزژ", "سش", "صض", "طظ", "عغ", "فق", "کگ", "وؤ", "اآأ", "هۀة"];

/** A substitution of a neighbouring key or of a commonly confused letter. */
export function nearLetters(a: string, b: string): boolean {
    if (CONFUSED.some((g) => g.includes(a) && g.includes(b))) return true;
    const pa = KEY_POS.get(a);
    const pb = KEY_POS.get(b);
    return !!pa && !!pb && Math.abs(pa[0] - pb[0]) <= 1 && Math.abs(pa[1] - pb[1]) <= 1;
}

/** Weighted Damerau–Levenshtein: near substitutions and swaps 0.5, other edits 1 (capped). */
export function editCost(a: string, b: string, cap = 2): number {
    const n = a.length;
    const m = b.length;
    if (Math.abs(n - m) > cap) return cap + 1;
    const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const sub = a[i - 1] === b[j - 1] ? 0 : nearLetters(a[i - 1], b[j - 1]) ? 0.5 : 1;
            let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + sub);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 0.5);
            d[i][j] = v;
        }
    }
    return d[n][m];
}

/** Does `cand` pass the quality bar as a correction of `w`? Its cost, or null. */
function passes(w: string, cand: string): number | null {
    const c = editCost(w, cand);
    if (c > 1.5) return null;
    // the first letter: the same, or swapped for a near one (same length)
    if (w[0] !== cand[0] && !(w.length === cand.length && nearLetters(w[0], cand[0]))) return null;
    // a short word: one letter more or less at most
    if (w.length <= 5 && Math.abs(w.length - cand.length) > 1) return null;
    return c;
}

export type SpellResult = { suggestions: string[] } | { note: true } | null;
const memo2 = new Map<string, SpellResult>();

/** Up to three suggestions for a word the lexicon does not accept, or null. */
export function spellingSuggestions(raw: string): string[] | null {
    const r = spellingCheck(raw);
    return r && "suggestions" in r ? r.suggestions : null;
}

/**
 * The checker's answer for a word: suggestions that pass the quality bar; a note
 * (`note`: unknown, nothing convincing to offer); or null (accepted, or no reason to doubt it).
 */
export function spellingCheck(raw: string, spokenSentence = false): SpellResult {
    const L = lex();
    if (!L || L.size === 0) return null;
    const word = normalize(raw);
    const mk = (spokenSentence ? "s\0" : "") + word;
    const cached = memo2.get(mk);
    if (cached !== undefined) return cached;
    const result = checkWord(word, L, spokenSentence);
    if (memo2.size > 20000) memo2.clear();
    memo2.set(mk, result);
    return result;
}

/** Short words a spoken sentence runs into the next one: «بااون»، «روعالی»، «مثلاچی». */
const SPOKEN_FUNCTION = ["با", "رو", "تو", "از", "به", "که", "این", "اون", "یه", "هم", "چه", "چی", "مثلا", "واسه", "برای", "دیگه"];

/**
 * In a spoken sentence (1.5.0): two words run together first (any frequent first word, or a
 * short spoken one: «امروزسه» → «امروز سه»، «بااون» → «با اون»), and one edit only.
 */
function checkWord(word: string, L: Map<string, number>, spokenSentence = false): SpellResult {
    if (spokenSentence) {
        const w = skeleton(word);
        if (accepted(word)) return null;
        for (let i = 2; i <= w.length - 2; i++) {
            const a = w.slice(0, i);
            const b = w.slice(i);
            const aOk = SPOKEN_FUNCTION.includes(a) || (L.get(a) ?? -1) >= 11;
            const bOk = SPOKEN_FUNCTION.includes(b) || ((L.get(b) ?? -1) >= 10 && (b.length >= 3 || (L.get(b) ?? -1) >= 12));
            if (aOk && bOk) return { suggestions: [a + " " + b] };
        }
        const r = checkWord(word, L, false);
        if (!r || !("suggestions" in r)) return r;
        const one = r.suggestions.filter((c) => c.includes(" ") || editCost(w, skeleton(c)) <= 1);
        return one.length ? { suggestions: one } : { note: true };
    }
    // a function word run into the next word: «درکانادا» → «در کانادا» (checked first:
    // the affix rules would otherwise accept «در» + «کانادا» as a prefixed word)
    const sk = skeleton(word);
    if (!L.has(sk) && !isKnown(word) && !isKnown(sk)) {
        for (const f of ["و", "در", "از", "به", "با", "که", "را", "این", "آن", "تا", "هر"]) {
            if (!sk.startsWith(f)) continue;
            const rest = sk.slice(f.length);
            if (rest.length >= 3 && (L.get(rest) ?? -1) >= SPLIT_BUCKET && !verbForm(rest)) return { suggestions: [f + " " + rest] };
        }
    }
    if (accepted(word)) return null;
    // Arabic names and terms with the article: «المعلی»، «الدروس»
    if (word.startsWith("ال") && word.length >= 5) return null;
    const w = skeleton(word);
    // frequent words one edit away; two only if none of those passes (and, as before 1.5.0,
    // the old search went two edits away for long words with nothing one edit away)
    const loose = new Map<string, number>();
    for (const c of edits1(w)) {
        const b = L.get(c);
        if (b !== undefined && b >= SUGGEST_BUCKET) loose.set(c, b);
    }
    const pass = new Map<string, number>();
    for (const [c, b] of loose) {
        const cost = passes(w, c);
        if (cost !== null) pass.set(c, b + (cost <= 0.5 ? SOUND_ALIKE_BONUS : 0));
    }
    if (pass.size === 0 && w.length >= 5) {
        const oldTwo = loose.size === 0 && w.length >= 6;
        for (const c1 of edits1(w)) {
            for (const c2 of edits1(c1)) {
                if (pass.has(c2)) continue;
                const b = L.get(c2);
                if (b === undefined || b < SUGGEST_BUCKET) continue;
                if (oldTwo) loose.set(c2, b);
                const cost = passes(w, c2);
                if (cost !== null) pass.set(c2, b + (cost <= 1 ? 0 : -3));
            }
        }
    }
    const ranked = [...pass.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    const out = ranked.slice(0, 3);
    // two words run together: «درکانادا» → «در کانادا» (a function word first), or two frequent words
    let looseSplit = false;
    for (let i = 1; i < w.length - 1; i++) {
        const a = w.slice(0, i);
        const b = w.slice(i);
        if ((FUNCTION_WORDS.has(a) || (L.get(a) ?? -1) >= SPLIT_BUCKET) && (L.get(b) ?? -1) >= SPLIT_BUCKET) {
            looseSplit = true;
            if (FUNCTION_WORDS.has(a) && b.length >= 2) out.unshift(a + " " + b);
            else if (a.length >= 3 && b.length >= 3) out.push(a + " " + b); // «ثروتمندشدن»، not «خان ما»
            break;
        }
    }
    if (out.length) return { suggestions: out.slice(0, 3) };
    return loose.size || looseSplit ? { note: true } : null;
}
