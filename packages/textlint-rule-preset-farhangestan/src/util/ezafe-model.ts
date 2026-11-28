/**
 * The ezafe model: is a word ending in a silent «ه», followed by another word,
 * in the ezafe («خانۀ قبلی») or not («خانه بزرگ است»)?
 *
 * A logistic regression trained by scripts/ezafe-model/train.py on Persian
 * Wikipedia articles that mark the ezafe consistently. This file mirrors
 * scripts/ezafe-model/features.py exactly; test/ezafe-model-test.ts checks
 * both give the same scores.
 */
import model from "../dict/ezafe-model.json";
import pos from "../dict/ezafe-pos.json";
import hazmVerbs from "../dict/hazm-verbs.json";
import raModel from "../dict/ra-model.json";
import hazmWords from "../dict/hazm-words.json";

const ZWNJ = "‌";
const HAMZA_ABOVE = "ٔ";
const MARKS = /[ً-ٕٓ-ٰٟ]/g;
const TOKEN = new RegExp(
    `[ء-غف-ئً-ٰٟٱ-ۓەۀیکگپچژ${ZWNJ}]+|[0-9۰-۹]+|[A-Za-z]+|\\S`,
    "g"
);
const WORD = new RegExp(`^[ء-غف-يٱ-ۓەیکگپچژ${ZWNJ}]+$`);

const WEIGHTS: Record<string, number> = model.weights as Record<string, number>;
/** Platt scaling from scripts/ezafe-model/calibrate.py (the raw model is too cautious). */
const CAL = (model as { calibration?: { a: number; b: number } }).calibration ?? { a: 1, b: 0 };
const POS = new Map<string, string>();
for (const [tag, words] of Object.entries(pos.tags as Record<string, string>)) {
    for (const w of words.split(" ")) POS.set(w, tag);
}
const PAST = new Set<string>(hazmVerbs.past);
const PRESENT = new Set<string>(hazmVerbs.present);
const PAST_END = ["یم", "ید", "ند", "م", "ی", ""];
const PRESENT_END = ["یم", "ید", "ند", "م", "ی", "د"];

const PRONOUNCED_HE = new Set([
    "به", "مه", "ده", "ره", "شه", "که", "گره", "زره", "بزه", "فربه", "توجه", "متوجه",
    "منزه", "مشتبه", "مشبه", "تنبه", "متنبه", "فرمانده", "بازده", "سپهبد", "وجه", "شبه"
]);
export const NOT_EZAFE = new Set([
    "بلکه", "که", "چه", "آنچه", "هرچه", "چنانچه", "اگرچه", "گرچه", "همیشه", "البته", "دوباره", "همواره",
    "هماره", "یکباره", "وگرنه", "نه", "ناگه", "همانا", "زیراکه", "چنانکه", "آنکه", "اینکه",
    // spoken «یه» (a), «چیه»، «کیه» (since 1.6.10 words in «ـیه» are candidates)
    "یه", "چیه", "کیه",
    // determiners and numbers: «این‌گونه واژه‌ها»، «سه کتاب»
    "اینگونه", "این‌گونه", "آنگونه", "آن‌گونه", "همین‌گونه", "همان‌گونه", "همینگونه", "همانگونه", "هرگونه", "هیچ‌گونه", "هیچگونه", "چگونه", "بدین‌گونه", "بدینگونه", "سه", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "هیجده", "نوزده"
]);

function normalize(text: string): string {
    return text.replace(/ي/g, "ی").replace(/ى/g, "ی").replace(/ك/g, "ک").replace(MARKS, "");
}

/** Since 1.6.10 a long vowel before «ه» is no sign by itself («شیوه، نحوه، سایه، نظریه»): words/PRONOUNCED_HE_WORDS and «ـاه». */
const PRONOUNCED_HE_WORDS = new Set([
    "فرمانده", "بازده", "گره", "زره", "بزه", "فربه", "توجه", "متوجه", "مواجه", "مشابه", "متشابه", "مرفه",
    "منزه", "مشتبه", "تنبه", "متنبه", "وجه", "فقیه", "سفیه", "شبیه", "کریه", "وجیه", "نزیه", "تنبیه",
    "تشبیه", "توجیه", "تنزیه", "موجه", "ابله", "مکروه", "کوه", "گروه", "شکوه", "انبوه", "اندوه", "ستوه",
    "فقه", "واله", "سپه", "نستوه", "نبیه", "سیه"
]);

function endsWithSilentHe(word: string): boolean {
    if (!word.endsWith("ه") || word.length < 2 || PRONOUNCED_HE.has(word) || PRONOUNCED_HE_WORDS.has(word)) return false;
    return !"اآ".includes(word[word.length - 2]) && !word.endsWith("پژوه");
}

function plain(tok: string): string {
    if (tok.endsWith("ه" + HAMZA_ABOVE)) return tok.slice(0, -1);
    if (tok.endsWith("ۀ")) return tok.slice(0, -1) + "ه";
    return tok;
}

function normTok(tok: string): string {
    if (WORD.test(tok)) return tok;
    if (/^[0-9۰-۹]/.test(tok)) return "<N>";
    if (/^[A-Za-z]/.test(tok)) return "<L>";
    return "<P>";
}

function isVerb(w: string): boolean {
    if (["است", "نیست", "هست", "بود", "باشد", "شد", "کرد"].includes(w)) return true;
    for (const pre of ["نمی" + ZWNJ, "می" + ZWNJ, "نمی", "می", "ب", "ن", ""]) {
        if (!w.startsWith(pre)) continue;
        const rest = w.slice(pre.length);
        if (rest.length < 2) continue;
        if (pre && PRESENT_END.some((e) => rest.endsWith(e) && PRESENT.has(rest.slice(0, rest.length - e.length)))) return true;
        if (
            ["", "ن", "نمی" + ZWNJ, "می" + ZWNJ, "نمی", "می"].includes(pre) &&
            PAST_END.some((e) => rest !== e && rest.endsWith(e) && PAST.has(rest.slice(0, rest.length - e.length)))
        ) {
            return true;
        }
    }
    return false;
}

function tag(w: string): string {
    if (w.startsWith("<")) return w;
    if (isVerb(w)) return "V";
    if (w.endsWith("ه") && PAST.has(w.slice(0, -1))) return "PART";
    const t = POS.get(w);
    if (t) return t;
    if (w.includes(ZWNJ) && ["ها", "های", "هایی"].includes(w.split(ZWNJ).pop()!)) return "PL";
    return "UNK";
}

/*
 * Spoken-aware tags for the ezafe model (since 1.6.3; the «را» model keeps tag()). Mirrors tag2() and
 * spoken_verb() in features.py.
 */
const SPOKEN_STEMS = new Set([
    "گ", "ر", "د", "ش", "تون", "خوا", "دون", "خون", "مون", "رسون", "ذار", "زار", "آ", "یا", "گیر", "کن", "زن",
    "بین", "خور", "دو", "پوش", "بر", "گرد", "شکن", "کش", "سوز", "ترس", "پرس", "فهم", "ریز", "خند", "شین", "پلک", "گرد‌ون", "چرخون"
]);
const SPOKEN_PERSON = ["یم", "ین", "ید", "ند", "م", "ی", "ه", "ن", "د"];
const SPOKEN_BARE = new Set([
    "داره", "نداره", "دارن", "ندارن", "دارین", "باشه", "نباشه", "باشن", "باشین", "بشه", "نشه", "بشن", "بره", "نره", "کنه", "شه",
    "گه", "تونه", "هستن", "نیستن", "هستین", "نیستین", "هس", "نیس", "میشه", "نمیشه"
]);

function spokenVerb(w: string): boolean {
    if (SPOKEN_BARE.has(w)) return true;
    for (const pre of ["نمی" + ZWNJ, "می" + ZWNJ, "نمی", "می"]) {
        if (!w.startsWith(pre)) continue;
        const rest = w.slice(pre.length);
        for (const e of [...SPOKEN_PERSON, ""]) {
            if (!(rest.length > e.length && rest.endsWith(e))) continue;
            const st = rest.slice(0, rest.length - e.length);
            if (PRESENT.has(st) || SPOKEN_STEMS.has(st) || PRESENT.has("آ" + st) || PAST.has(st)) return true;
            if (st.slice(0, 1) === "ا" && (SPOKEN_STEMS.has("آ" + st.slice(1)) || PRESENT.has("آ" + st.slice(1)))) return true;
        }
        return false;
    }
    for (const pre of ["ب", "ن"]) {
        if (!(w.startsWith(pre) && w.length > 3)) continue;
        const rest = w.slice(1);
        for (const e of ["ه", "ن", "ین"]) {
            if (rest.length > e.length + 1 && rest.endsWith(e) && (PRESENT.has(rest.slice(0, -e.length)) || SPOKEN_STEMS.has(rest.slice(0, -e.length)))) return true;
        }
    }
    return w.endsWith("ین") && PAST.has(w.slice(0, -2));
}

function tag2(w: string): string {
    const t = tag(w);
    if (t !== "UNK") return t;
    if (w.endsWith("ن") && PAST.has(w.slice(0, -1))) return "INF";
    if (spokenVerb(w)) return "V";
    return t;
}

/**
 * A finite verb, written or spoken («گفتم»، «می‌ده»، «بشه»، «نکرد»), that is no noun as well (since 1.6.3: «پرداخت»،
 * «ساخت»، «خرید» are nouns too and may be an ezafe's second part: «نحوۀ پرداخت»).
 */
export function isFiniteVerb(w: string): boolean {
    if (tag2(w) !== "V") return false;
    const t = POS.get(w);
    return !t || !t.split(",").includes("N");
}

/**
 * A present-tense verb written with no «می» or «ب» («گذاریم»، «دارد»، «باشد»: literary or subjunctive) that is no noun
 * or adjective as well (1.6.8: no red ezafe before one, «پا به عرصه گذاریم»).
 */
export function barePresent(w: string): boolean {
    const t = POS.get(w);
    if (t && /(?:^|,)(?:N|AJ)(?:,|$)/.test(t)) return false;
    return PRESENT_END.some((e) => w.length > e.length + 1 && w.endsWith(e) && PRESENT.has(w.slice(0, w.length - e.length)));
}

function context(toks: string[], i: number, step: number, n: number): string[] {
    const out: string[] = [];
    let j = i + step;
    while (out.length < n) {
        if (j < 0 || j >= toks.length) {
            out.push("<S>");
            break;
        }
        const t = normTok(toks[j]);
        out.push(t);
        if (t === "<P>") break;
        j += step;
    }
    while (out.length < n) out.push("<S>");
    return out;
}

function features(toks: string[], i: number): string[] {
    const w0 = toks[i];
    const [w1, w2] = context(toks, i, 1, 2);
    const [m1, m2] = context(toks, i, -1, 2);
    return [
        "b",
        "w0=" + w0,
        "w0s=" + w0.slice(-4),
        "w1=" + w1,
        "w2=" + w2,
        "m1=" + m1,
        "m2=" + m2,
        "w1p=" + w1.slice(0, 2),
        "w1s=" + w1.slice(-2),
        "w1s1=" + w1.slice(-1),
        "m1s=" + m1.slice(-2),
        "w0w1=" + w0 + "|" + w1,
        "m1w0=" + m1 + "|" + w0,
        "w1w2=" + w1 + "|" + w2,
        "w0w1s=" + w0 + "|" + w1.slice(-2),
        "w0t=" + tag2(w0),
        "w1t=" + tag2(w1),
        "w2t=" + tag2(w2),
        "m1t=" + tag2(m1),
        "w1tw2t=" + tag2(w1) + "|" + tag2(w2),
        "m1tw1t=" + tag2(m1) + "|" + tag2(w1),
        "w0w1t=" + w0 + "|" + tag2(w1),
        // since 1.6.3: the word after next («اطلاع دارید»: a compound verb begins at w1), and the words around
        "w1w2t=" + w1 + "|" + tag2(w2),
        "m1w1=" + m1 + "|" + w1,
        // since 1.6.10: the mark after w1 / before w0, and w0 with the word after next
        "w2P=" + mark(toks, i + 2),
        "m1P=" + mark(toks, i - 1),
        "w0w2t=" + w0 + "|" + tag2(w2)
    ];
}

/** The punctuation mark at toks[j], «<S>» at either end, «-» for a word, a number or Latin (features.py mark()). */
function mark(toks: string[], j: number): string {
    if (j < 0 || j >= toks.length) return "<S>";
    return normTok(toks[j]) === "<P>" ? toks[j] : "-";
}

export interface EzafeCandidate {
    /** the word as written, and where it is in the text */
    word: string;
    start: number;
    end: number;
    /** probability that the word is in the ezafe (calibrated) */
    p: number;
}

/**
 * Every word in `text` that ends in a silent «ه» and is followed by another
 * word, with the model's ezafe probability. Words already marked («خانۀ»،
 * «خانۀ»، «خانه‌ی») are skipped: other checks own them.
 */
export function ezafeCandidates(text: string): EzafeCandidate[] {
    const raw: Array<{ tok: string; start: number }> = [];
    TOKEN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN.exec(text)) !== null) raw.push({ tok: m[0], start: m.index });
    // same folding as features.py: «خانه ی» and «خانه‌ی» are one marked token
    const toks: string[] = [];
    const info: Array<{ start: number; end: number; marked: boolean; word: string }> = [];
    for (let k = 0; k < raw.length; k++) {
        const t = normalize(raw[k].tok);
        const end = raw[k].start + raw[k].tok.length;
        if (t.endsWith("ه" + ZWNJ + "ی") && t.length > 3) {
            toks.push(t.slice(0, -2));
            info.push({ start: raw[k].start, end, marked: true, word: raw[k].tok });
        } else if (t.endsWith("ه") && k + 1 < raw.length && normalize(raw[k + 1].tok) === "ی") {
            toks.push(t);
            info.push({ start: raw[k].start, end, marked: true, word: raw[k].tok });
            k++;
        } else {
            const p = plain(t);
            toks.push(p);
            info.push({ start: raw[k].start, end, marked: p !== t, word: raw[k].tok });
        }
    }
    const out: EzafeCandidate[] = [];
    toks.forEach((w, i) => {
        if (!endsWithSilentHe(w) || NOT_EZAFE.has(w) || w.slice(-2).includes(ZWNJ)) return;
        if (i + 1 >= toks.length || !WORD.test(toks[i + 1])) return;
        if (info[i].marked) return;
        let z = 0;
        for (const f of features(toks, i)) z += WEIGHTS[f] ?? 0;
        out.push({ word: info[i].word, start: info[i].start, end: info[i].end, p: 1 / (1 + Math.exp(-(CAL.a * z + CAL.b))) });
    });
    return out;
}

/** Same as features.py candidates(), for the parity test: every candidate, marked or not; raw (uncalibrated) scores. */
export function scoresForTest(text: string): Array<[string, number]> {
    return ezafeCandidatesAll(text);
}

function ezafeCandidatesAll(text: string): Array<[string, number]> {
    const raw: string[] = text.match(TOKEN) ?? [];
    const toks: string[] = [];
    for (let k = 0; k < raw.length; k++) {
        const t = normalize(raw[k]);
        if (t.endsWith("ه" + ZWNJ + "ی") && t.length > 3) toks.push(t.slice(0, -2));
        else if (t.endsWith("ه") && k + 1 < raw.length && normalize(raw[k + 1]) === "ی") {
            toks.push(t);
            k++;
        } else toks.push(plain(t));
    }
    const out: Array<[string, number]> = [];
    toks.forEach((w, i) => {
        if (!endsWithSilentHe(w) || NOT_EZAFE.has(w) || w.slice(-2).includes(ZWNJ)) return;
        if (i + 1 >= toks.length || !WORD.test(toks[i + 1])) return;
        let z = 0;
        for (const f of features(toks, i)) z += WEIGHTS[f] ?? 0;
        out.push([w, 1 / (1 + Math.exp(-z))]);
    });
    return out;
}

// --- joined «را» («کتابرا» → «کتاب را»): mirrors ra_features() in features.py ---


const RA_WEIGHTS: Record<string, number> = raModel.weights as Record<string, number>;
const HAZM_KNOWN = new Set<string>(hazmWords.words);
const RA_SKIP_STEMS = new Set(["آن", "این", "خود", "ما", "تو", "شما", "آنها", "اینها", "او", "من", "هم", "مرا", "چه"]);

function raCandidate(t: string): boolean {
    return t.endsWith("را") && t.length >= 4 && HAZM_KNOWN.has(t.slice(0, -2)) && !RA_SKIP_STEMS.has(t.slice(0, -2)) && !t.includes(ZWNJ);
}

function raFeatures(t: string, toks: string[], i: number): string[] {
    const x = t.slice(0, -2);
    const [w1, w2] = context(toks, i, 1, 2);
    const [m1] = context(toks, i, -1, 2);
    return [
        "b",
        "x=" + x,
        "xs=" + x.slice(-3),
        "ts=" + t.slice(-4),
        "tk=" + (HAZM_KNOWN.has(t) ? "1" : "0"),
        "xt=" + tag(x),
        "xlen=" + String(Math.min(x.length, 6)),
        "w1=" + w1,
        "w1t=" + tag(w1),
        "w1p=" + w1.slice(0, 2),
        "w2t=" + tag(w2),
        "m1=" + m1,
        "m1t=" + tag(m1),
        "xw1t=" + x + "|" + tag(w1),
        "m1tw1t=" + tag(m1) + "|" + tag(w1)
    ];
}

export interface RaCandidate {
    word: string;
    start: number;
    end: number;
    /** probability that the token is X + «را» written joined */
    p: number;
}

/** Tokens that may be X + «را» written joined, with the model's probability. */
export function raCandidates(text: string): RaCandidate[] {
    const raw: Array<{ tok: string; start: number }> = [];
    TOKEN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN.exec(text)) !== null) raw.push({ tok: m[0], start: m.index });
    const toks = raw.map((r) => plain(normalize(r.tok)));
    const out: RaCandidate[] = [];
    toks.forEach((t, i) => {
        if (!raCandidate(t)) return;
        let z = 0;
        for (const f of raFeatures(t, toks, i)) z += RA_WEIGHTS[f] ?? 0;
        out.push({ word: raw[i].tok, start: raw[i].start, end: raw[i].start + raw[i].tok.length, p: 1 / (1 + Math.exp(-z)) });
    });
    return out;
}

/** For the parity test: [token, probability] for every candidate. */
export function raScoresForTest(text: string): Array<[string, number]> {
    return raCandidates(text).map((c) => [plain(normalize(c.word)), c.p]);
}
