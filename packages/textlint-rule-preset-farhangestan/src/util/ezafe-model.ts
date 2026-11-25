/**
 * The ezafe model: is a word ending in a silent «ه», followed by another word,
 * in the ezafe («خانهٔ قبلی») or not («خانه بزرگ است»)?
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
    // determiners and numbers: «این‌گونه واژه‌ها»، «سه کتاب»
    "اینگونه", "این‌گونه", "آنگونه", "آن‌گونه", "همین‌گونه", "همان‌گونه", "همینگونه", "همانگونه", "هرگونه", "هیچ‌گونه", "هیچگونه", "چگونه", "بدین‌گونه", "بدینگونه", "سه", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "هیجده", "نوزده"
]);

function normalize(text: string): string {
    return text.replace(/ي/g, "ی").replace(/ى/g, "ی").replace(/ك/g, "ک").replace(MARKS, "");
}

function endsWithSilentHe(word: string): boolean {
    if (!word.endsWith("ه") || word.length < 2 || PRONOUNCED_HE.has(word)) return false;
    return !"اویآ".includes(word[word.length - 2]);
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
        "w0t=" + tag(w0),
        "w1t=" + tag(w1),
        "w2t=" + tag(w2),
        "m1t=" + tag(m1),
        "w1tw2t=" + tag(w1) + "|" + tag(w2),
        "m1tw1t=" + tag(m1) + "|" + tag(w1),
        "w0w1t=" + w0 + "|" + tag(w1)
    ];
}

export interface EzafeCandidate {
    /** the word as written, and where it is in the text */
    word: string;
    start: number;
    end: number;
    /** probability that the word is in the ezafe */
    p: number;
}

/**
 * Every word in `text` that ends in a silent «ه» and is followed by another
 * word, with the model's ezafe probability. Words already marked («خانهٔ»،
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
        out.push({ word: info[i].word, start: info[i].start, end: info[i].end, p: 1 / (1 + Math.exp(-z)) });
    });
    return out;
}

/** Same as features.py candidates(), for the parity test: every candidate, marked or not. */
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
