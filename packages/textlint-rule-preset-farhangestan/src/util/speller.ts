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
import informal from "../dict/informal-words.json";

const PAST_STEMS = new Set<string>(hazmVerbs.past);
const PRESENT_STEMS = new Set<string>(hazmVerbs.present);
/** Informal words common across many blogs and forums (1.6.0): accepted, never offered. */
const INFORMAL = new Set<string>((informal as { words: string }).words.split(" "));
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
/** A letter left out or a homophone swapped: a word from ≈ 128 occurrences (1.6.4). */
const SURE_EDIT_BUCKET = 7;
const SPLIT_BUCKET = 10;

let LEX: Map<string, number> | null = null;
/**
 * Names, loanwords and spoken forms the corpora know but the Wikipedia lexicon does not (1.6.4,
 * scripts/spelling/build-accept.cjs): words of at least ten blog and forum sites, of two Wikipedia
 * articles, or of a Wikipedia title. Accepted by the checker only (never offered, never a reason
 * for another rule): checked after the run-together words («فکرکنم» stays «فکر کنم»).
 */
let ACCEPT = new Set<string>();
/**
 * Words of Wikipedia that blogs and forums hardly use (at least 50 times in Wikipedia, under one in seven
 * as often in blogs): mostly names («ژوکوف»، «کاستیا»، «موریسون»، «آپولون»). Never offered for a word one
 * letter away: «ژوکف»، «کستیا»، «مورسون»، «آپولن» are the same names spelled another way (1.6.4).
 */
let ENCYCLOPEDIC = new Set<string>();
/** First names: words that begin Wikipedia titles of two or three words («کارل»، «یوهان»، «کاترین»; 1.6.4). */
let NAME_FIRST = new Set<string>();
/** Is `w` a first name (the next word is then a name)? */
export function nameFirst(w: string): boolean {
    return NAME_FIRST.has(skeleton(normalize(w))) || NAMES.has(w);
}

/** Load the lexicon (the site loads it lazily; Node loads the bundled file). */
export function loadSpellingLexicon(data: { buckets: Record<string, string>; accept?: string; encyclopedic?: string; namefirst?: string }): void {
    const m = new Map<string, number>();
    for (const [b, words] of Object.entries(data.buckets)) {
        if (!words) continue;
        for (const w of words.split(" ")) m.set(w, Number(b));
    }
    LEX = m;
    ACCEPT = new Set(data.accept ? data.accept.split(" ") : []);
    ENCYCLOPEDIC = new Set(data.encyclopedic ? data.encyclopedic.split(" ") : []);
    NAME_FIRST = new Set(data.namefirst ? data.namefirst.split(" ") : []);
}

function lex(): Map<string, number> | null {
    if (!LEX && (lexiconData as { buckets?: Record<string, string> }).buckets) loadSpellingLexicon(lexiconData as { buckets: Record<string, string>; accept?: string; encyclopedic?: string; namefirst?: string });
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
    // the first letter stays (1.6.0: before, a near letter could replace it, «حروم» → «حروف» but also
    // «ارابش» → «ترابش»); «ا» and «آ» count as one
    if (w[0] !== cand[0] && !(ALEFS.includes(w[0]) && ALEFS.includes(cand[0]))) return null;
    // a verb keeps its shape: the same «می/نمی» and the same last letter («نمیذاشت» is not «نمی‌باشد»)
    const pre = w.match(/^ن?می/)?.[0];
    if (pre && (!cand.startsWith(pre) || cand[cand.length - 1] !== w[w.length - 1])) return null;
    // a short word: one letter more or less at most
    if (w.length <= 5 && Math.abs(w.length - cand.length) > 1) return null;
    return c;
}
const ALEFS = "اآأإ";
/**
 * What kind of edit turns `w` into `cand` (1.6.4). The judged cards of 1.6.3 (157 on blogs, 160 on
 * held-out Wikipedia) showed which kinds are typos: a letter left out («مشمل» ← «مشتمل»، «متسط» ←
 * «متوسط») or a homophone swapped («سراق» ← «سراغ») were real typos 17 times in 23, a neighbouring key
 * or two letters swapped mostly so; but a guess with a letter too many («ماهلر» → «ماهر»، «طاقک» →
 * «طاق»، «دانلودز» → «دانلود») or another letter changed («سنح» → «سطح»، «دخیا» → «دریا»، «شریع» →
 * «شروع») was right only 5 times in 56: names, loanwords, the wrong word. Only the first kinds are offered.
 */
export type EditKind = "missing" | "homophone" | "near" | "swap" | "double" | "extra" | "other";
/** Letters that are one letter written another way («مٶسسه» ← «مؤسسه»). */
const VARIANTS = ["ؤٶ", "یىيې", "کك", "هەة"];
export function editKind(w: string, cand: string): EditKind {
    if (cand.length === w.length + 1) {
        for (let i = 0; i < cand.length; i++) if (cand.slice(0, i) + cand.slice(i + 1) === w) return "missing";
        return "other";
    }
    if (cand.length === w.length - 1) {
        for (let i = 0; i < w.length; i++) {
            if (w.slice(0, i) + w.slice(i + 1) !== cand) continue;
            // a letter typed twice («اصللا»): a slip of the finger, not another word
            return (i > 0 && w[i] === w[i - 1]) || (i < w.length - 1 && w[i] === w[i + 1]) ? "double" : "extra";
        }
        return "other";
    }
    if (cand.length !== w.length) return "other";
    const d: number[] = [];
    for (let i = 0; i < w.length; i++) if (w[i] !== cand[i]) d.push(i);
    if (d.length === 2 && d[1] === d[0] + 1 && w[d[0]] === cand[d[1]] && w[d[1]] === cand[d[0]]) return "swap";
    if (d.length !== 1) return "other";
    const [a, b] = [w[d[0]], cand[d[0]]];
    if ([...SOUND_ALIKE, ...VARIANTS].some((g) => g.includes(a) && g.includes(b))) return "homophone";
    const pa = KEY_POS.get(a);
    const pb = KEY_POS.get(b);
    if (pa && pb && Math.abs(pa[0] - pb[0]) <= 1 && Math.abs(pa[1] - pb[1]) <= 1) return "near";
    return CONFUSED.some((g) => g.includes(a) && g.includes(b)) ? "near" : "other";
}
/** The kinds offered, and how much more a candidate counts for its kind than for its frequency alone. */
const EDIT_BONUS: Partial<Record<EditKind, number>> = { missing: 7, homophone: 7, double: 5, swap: 4, near: 3 };
/** Frequency counts up to ≈ 4,000 occurrences: past that a likelier edit wins («مشمل» ← «مشتمل», not «مشکل»). */
const RANK_BUCKET_CAP = 12;

/** Closed-class words: two frequent words run together are offered apart only with one of these or a verb. */
const CLOSED = new Set(
    ("و در از به با بر که را رو این آن اون تا هر هم یا اما ولی تنها فقط حتی نیز یعنی همه همه‌ی چند کمی خیلی بسیار دیگر دیگه هنوز " +
        "دقیقا اصلا واقعا مثلا من تو او ما شما ایشان آنها اینها اونا همین همان چه چی کی کجا چرا چطور برای واسه توسط روی بین " +
        "مثل مثه بدون بعد قبل ها های ای یه یکی هیچ کل کلی یک دو سه چهار پنج شش هفت هشت نه ده صد هزار").split(" ")
);
/**
 * Two words run together worth offering apart: one closed-class word or a verb among them. A short
 * closed word («ها»، «یا»، «کی»، «در») only at the end, after a word that is no name: «هاکارت»، «خزریا»،
 * «کیبرگ»، «حسیندر» were names. Not «زیر»، «پیش»، «پس»: they make words («زیرهنگ»، «زیرمیدان»).
 */
export function closedPair(a: string, b: string): boolean {
    if (a.length < 2 || b.length < 2) return false;
    // (a verb, not a stem with «ی»: «وادارسازی»، «جلدبندی»، «دوربری» are nouns of their own)
    const verb = (x: string) => verbish(x) && !x.endsWith("ی");
    if (a.length <= 2 && !verb(b)) return false;
    if (b.length <= 2 && (!END_CLOSED.has(b) || a.length < 3 || NAMES.has(a))) return false;
    // (not part of a name: «نیونیز» is «Núñez», not «نیو نیز»)
    if (ENCYCLOPEDIC.has(a) || ENCYCLOPEDIC.has(b)) return false;
    return CLOSED.has(a) || CLOSED.has(b) || verb(a) || verb(b);
}
const END_CLOSED = new Set(["از", "که", "را", "هم", "به", "با", "تا", "دو", "سه"]);
/** A verb form, an infinitive or a participle: «کنم»، «دادن»، «داشته»، «دارند»، «رسید». */
function verbish(x: string): boolean {
    if (verbForm(x) || PAST_STEMS.has(x) || /^ن?می/.test(x)) return true;
    if (/[نه]$/.test(x) && PAST_STEMS.has(x.slice(0, -1))) return true;
    return false;
}

/** Spoken endings: «بازیکنا»، «گوشیمو»، «سایتشون»، «رکوردشو»، «کتابارو» (1.6.0). */
const SPOKEN_ENDINGS = ["هامونو", "هاتونو", "هاشونو", "مونو", "تونو", "شونو", "هامون", "هاتون", "هاشون", "هارو", "ارو", "مون", "تون", "شون", "مو", "تو", "شو", "رو", "اس", "و", "ا", "ای", "ام", "ات", "اش", "م", "ت", "ش", "ه", "ن", "ین", "یم", "ی", "س"];
const OUTER = new Set(["و", "رو", "ا", "ه", "تون", "شون", "مون", "م", "ت", "ش", "ای", "مو", "تو", "شو", "مونو", "تونو", "شونو", "اس", "س"]);
const INNER = new Set(["م", "ت", "ش", "ا", "مون", "تون", "شون"]);
/** «نندازی»، «بفهمن»، «نمیذاشت»: a verb prefix, a stem as said, an ending. */
const VERB_ENDINGS = ["", "م", "ی", "ه", "یم", "ین", "ید", "ن", "ند", "مش", "تش", "ش", "شون", "ت"];
/**
 * A known word with spoken endings, or a verb as it is said: never «not in the dictionary» (1.6.0;
 * the blog study found 71% of the checker's reports in informal text false). `loose` (a spoken
 * sentence): also «ون/وم» for «ان/ام» («حروم» ← «حرام»).
 */
export function spokenInflection(w: string, loose = false, depth = 2): boolean {
    const L = lex() ?? NO_LEX;
    const ok = (x: string) => (x.length >= 3 && (isKnown(x) || (L.get(x) ?? -1) >= 7 || INFORMAL.has(x))) || (x.length === 2 && (L.get(x) ?? -1) >= 9);
    if (INFORMAL.has(w)) return true;
    for (const e of SPOKEN_ENDINGS) {
        if (!w.endsWith(e) || w.length - e.length < 2) continue;
        const stem = w.slice(0, -e.length);
        // «علاقشو»، «اجارش»، «شدتون»: the silent «ه» drops before a spoken ending
        if (/^[شمتو]|^(مون|تون|شون)/.test(e) && ok(stem + "ه")) return true;
        if (stem.length < 3) continue;
        if (ok(stem)) return true;
        // two endings: a pronoun or the plural, then «و/رو/ا/ه» («گوشیمو»، «چشاتون»، «بازیکناشون»)
        if (depth > 1 && OUTER.has(e) && SPOKEN_ENDINGS.some((e2) => INNER.has(e2) && stem.endsWith(e2) && stem.length - e2.length >= 2 && ok(stem.slice(0, -e2.length)))) return true;
    }
    // a verb, also with the spoken «را» or the «ها» of emphasis after it («گفتینو»، «میسازنا»; 1.6.1)
    const verbAt = (x: string) => {
        const v = x.match(/^(نمی|می|ن|ب)(.{2,})$/);
        if (!v) return false;
        const stemOk = (st: string) => PRESENT_STEMS.has(st) || PAST_STEMS.has(st) || PRESENT_STEMS.has("ا" + st) || PAST_STEMS.has("ا" + st) || PRESENT_STEMS.has("گ" + st) || PAST_STEMS.has("گ" + st) || SPOKEN_STEMS_SAID.has(st);
        return VERB_ENDINGS.some((e) => v[2].endsWith(e) && v[2].length - e.length >= 2 && stemOk(v[2].slice(0, v[2].length - e.length)));
    };
    if (verbAt(w) || (/[اوه]$/.test(w) && verbAt(w.slice(0, -1)))) return true;
    // a past verb said with its object «را»: «گفتینو»، «دیدمشو»
    const past = w.match(/^(.{3,}?)(م|ی|یم|ین|ید|ن|ند|ه)?(ش|ت)?و$/);
    if (past && PAST_STEMS.has(past[1].replace(/^ن/, ""))) return true;
    if (loose && /و[نم]/.test(w)) {
        const f = w.replace(/و([نم])(?!.*و[نم])/, "ا$1");
        if (f !== w && ok(f)) return true;
    }
    return false;
}
/** Present stems as they are said («ذار»، «نداز»، «تون»، «گ»). */
const SPOKEN_STEMS_SAID = new Set(["ذار", "زار", "ذاشت", "نداز", "تون", "تونست", "دون", "دونست", "خون", "خوند", "مون", "موند", "رسون", "شین", "گیر", "اومد", "یومد", "ومد", "خوا", "ری", "ذا", "یار", "یاورد"]);

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

/**
 * «و» run into the next word («وبدنش»، «وعمدی»، «وزنبور») or «که» onto the last one («حالتیکه»): the
 * two words, when the rest is a word (1.6.1; before, a word two letters away was guessed).
 */
function runTogether(w: string, L: Map<string, number>): string | null {
    // «وقصه»: four letters too when the rest is a frequent word (1.6.4; it was guessed «وقفه»)
    if (w.startsWith("و") && w.length === 4 && !w.startsWith("وو") && (L.get(w.slice(1)) ?? -1) >= 9) return "و " + w.slice(1);
    if (w.startsWith("و") && w.length >= 5) {
        const rest = w.slice(1);
        if (!rest.startsWith("و") && (L.get(rest) ?? -1) >= 4 && accepted(rest)) return "و " + rest;
        if (rest.length >= 4 && (spokenInflection(rest) || (accepted(rest) && rest.length >= 5))) return "و " + rest;
    }
    if (w.endsWith("که") && w.length >= 6) {
        const head = w.slice(0, -2);
        if ((L.get(head) ?? -1) >= 6 || isKnown(head)) return head + " که";
    }
    return null;
}

/** Short words a spoken sentence runs into the next one: «بااون»، «روعالی»، «مثلاچی». */
const SPOKEN_FUNCTION = ["با", "رو", "تو", "از", "به", "که", "این", "اون", "یه", "هم", "چه", "چی", "مثلا", "واسه", "برای", "دیگه", "هر"];

/**
 * In a spoken sentence (1.5.0): two words run together first (any frequent first word, or a
 * short spoken one: «امروزسه» → «امروز سه»، «بااون» → «با اون»), and one edit only.
 */
function checkWord(word: string, L: Map<string, number>, spokenSentence = false): SpellResult {
    if (spokenSentence) {
        const w = skeleton(word);
        if (accepted(word) || spokenInflection(w, true)) return null;
        const run = runTogether(w, L);
        if (run) return { suggestions: [run] };
        for (let i = 2; i <= w.length - 2; i++) {
            const a = w.slice(0, i);
            const b = w.slice(i);
            const aOk = SPOKEN_FUNCTION.includes(a) || (L.get(a) ?? -1) >= 11;
            const bOk = SPOKEN_FUNCTION.includes(b) || ((L.get(b) ?? -1) >= 10 && (b.length >= 3 || (L.get(b) ?? -1) >= 12));
            // two frequent words: with a closed-class word or a verb among them (1.6.4: «ماهیران»، «ریپیر»، «پرفایل»)
            if (aOk && bOk && (SPOKEN_FUNCTION.includes(a) || SPOKEN_FUNCTION.includes(b) || closedPair(a, b))) return { suggestions: [a + " " + b] };
        }
        const r = checkWord(word, L, false);
        if (!r || !("suggestions" in r)) return r;
        const one = r.suggestions.filter((c) => c.includes(" ") || editCost(w, skeleton(normalize(c))) <= 1 || /اً$/.test(c));
        return one.length ? { suggestions: one } : { note: true };
    }
    // a function word run into the next word: «درکانادا» → «در کانادا» (checked first:
    // the affix rules would otherwise accept «در» + «کانادا» as a prefixed word); not a word the writer
    // joined with a ZWNJ on purpose («به‌نشان»، «به‌مرکزیت»: the book's compound prepositions; 1.6.4)
    const sk = skeleton(word);
    if (!L.has(sk) && !isKnown(word) && !isKnown(sk)) {
        for (const f of ["و", "در", "از", "به", "با", "که", "را", "این", "آن", "تا", "هر"]) {
            if (!sk.startsWith(f) || word.startsWith(f + ZWNJ)) continue;
            const rest = sk.slice(f.length);
            // («آنامی» is a name, not «آن امی»: after «آن/این» four letters at least)
            if (rest.length >= (f === "آن" || f === "این" ? 4 : 3) && (L.get(rest) ?? -1) >= SPLIT_BUCKET && !verbForm(rest)) return { suggestions: [f + " " + rest] };
        }
    }
    if (accepted(word) || spokenInflection(sk)) return null;
    const w = sk;
    // a tanvin typed as «آ» or «أ» («واقعآ»، «قبلأ»، «حدودآ»): the word with «اً» (1.6.4; it was guessed «واقع»، «قبل»)
    if (/[آأ]$/.test(w) && w.length >= 4 && (L.get(w.slice(0, -1) + "ا") ?? -1) >= 8) return { suggestions: [w.slice(0, -1) + "اً"] };
    const run = runTogether(sk, L);
    if (run) return { suggestions: [run] };
    // Arabic names and terms with the article: «المعلی»، «الدروس»
    if (word.startsWith("ال") && word.length >= 5) return null;
    // two words run together: a function word and a frequent word («همهاز»), or two frequent words
    // with a closed-class word or a verb among them («فکرکنم»، «تنهامحصول»، «باوردارند»; 1.6.4: not
    // two nouns, «چاهدراز»، «اسکندرشهر»، «پرفایل» were names and compounds)
    let looseSplit = false;
    let split: string | null = null;
    for (let i = 1; i < w.length - 1; i++) {
        const a = w.slice(0, i);
        const b = w.slice(i);
        if ((FUNCTION_WORDS.has(a) || (L.get(a) ?? -1) >= SPLIT_BUCKET) && (L.get(b) ?? -1) >= SPLIT_BUCKET) {
            looseSplit = true;
            if (FUNCTION_WORDS.has(a) && b.length >= 2) split = a + " " + b;
            else if (!word.includes(ZWNJ) && closedPair(a, b)) split = a + " " + b;
            break;
        }
    }
    if (split && FUNCTION_WORDS.has(split.split(" ")[0])) return { suggestions: [split] };
    // a name, a loanword or a spoken form many sites or Wikipedia use (1.6.4)
    if (ACCEPT.has(w)) return null;
    // frequent words one edit away, of the kinds that are typos (editKind); two edits: never offered
    // (1.6.1: «وعمدی» → «واحدی»، «وبودر» → «ورودی» were the guesses people judged wrong)
    // (a letter left out or a homophone: a less frequent word too, «غرمجاز» ← «غیرمجاز», «اویز» ← «آویز»)
    const loose = new Map<string, number>();
    const pass = new Map<string, number>();
    for (const c of edits1(w)) {
        const b = L.get(c);
        if (b === undefined || b < SURE_EDIT_BUCKET || ENCYCLOPEDIC.has(c)) continue;
        const kind = editKind(w, c);
        if (b < SUGGEST_BUCKET && kind !== "missing" && kind !== "homophone") continue;
        loose.set(c, b);
        const bonus = EDIT_BONUS[kind];
        if (bonus !== undefined && passes(w, c) !== null) pass.set(c, Math.min(b, RANK_BUCKET_CAP) + bonus);
    }
    const ranked = [...pass.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    const out = ranked.slice(0, 3);
    if (split) out.push(split);
    if (out.length) return { suggestions: out.slice(0, 3) };
    return loose.size || looseSplit ? { note: true } : null;
}
