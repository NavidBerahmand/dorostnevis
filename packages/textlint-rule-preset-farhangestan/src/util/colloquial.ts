/**
 * Spoken (شکسته) forms and the register of a sentence (since 1.5.0).
 *
 * - spokenFormal(word): the written form of a spoken word, or null: «چمدون‌های» → «چمدان‌های»،
 *   «میگه» → «می‌گوید»، «خانما» → «خانم‌ها»، «پامون» → «پایمان». From a closed list (the
 *   spoken words of «اصول شکسته‌نویسی»، علی صلح‌جو, and the common ones besides) and a few
 *   productive patterns: «ون» for «ان» (چمدون، گرون)، «می» + a spoken stem or ending (میرم،
 *   میکنه)، «ا» for «ها» (خانما)، «و» for «را» (کتابو)، «مون/تون/شون» for «مان/تان/شان».
 * - registerSegments(text): each sentence, and each «…» quotation, as spoken or written. Spoken:
 *   a score of at least 2 (a sure spoken word counts 2, an ambiguous one 1, a sure written one
 *   («است»، «را»، «می‌کند»، «می‌باشد») takes points off); or 1 in a dialogue (a line that starts
 *   with a dash, a quotation after «:») or next to a spoken sentence; or 0, with no written
 *   word, between two spoken sentences. One ambiguous word never makes a written sentence
 *   spoken. Everything is decided inside a line, so a line gives the same answer alone or in
 *   a longer text (the rules see one line at a time). In a line of dialogue (after a dash)
 *   with a spoken sentence, every sentence without a written word is spoken.
 */
import { KNOWN, isKnown } from "./words";
import { isPresentStem, verbForm } from "../rules/mi-prefix";
import { corpusBucket } from "./speller";
import commonNouns from "../dict/hazm-common-nouns.json";
import hazmAdjectives from "../dict/hazm-adjectives.json";

const Z = "‌";
const COMMON = new Set<string>([...commonNouns.words, ...hazmAdjectives.adjectives]);
const skel = (w: string) => w.replace(/‌/g, "");
/**
 * A written word: in Hazm or the farhang, or common in the Wikipedia corpus (512 times or
 * more: «کاملا»، «روی»). The corpus is fetched after the page opens; until then Hazm and the
 * farhang decide.
 */
const written = (w: string) => isKnown(w) || isKnown(skel(w)) || (corpusBucket(w) ?? -1) >= 9;

/** Sure spoken words: spoken → written. */
const SURE: Record<string, string> = {
    خونه: "خانه", گرون: "گران", ارزون: "ارزان", آسمون: "آسمان", خیابون: "خیابان", تهرون: "تهران",
    زبون: "زبان", همون: "همان", کدوم: "کدام", میدون: "میدان", حیوون: "حیوان", جوون: "جوان", لیوون: "لیوان",
     قندون: "قندان", نادون: "نادان", زمونه: "زمانه", شبونه: "شبانه", دیگه: "دیگر", اگه: "اگر",
    اینو: "این را",  اونا: "آن‌ها", اینا: "این‌ها",
    اونجا: "آنجا", اونجوری: "آن‌طور", اینجوری: "این‌طور", چجوری: "چطور", چطوری: "چطور", اینطوری: "این‌طور",
    // «همتون»: «همه» + «تون» as said («هم» + «تان» is no word; 1.6.1)
    همتون: "همه‌تان", همشون: "همه‌شان", هممون: "همه‌مان",
    ایشون: "ایشان", آره: "بله", آهان: "بله", چیه: "چیست", کیه: "کیست", کجان: "کجا هستند", 
    بهش: "به او", بهشون: "به آن‌ها", بهتون: "به شما", ازش: "از او",
    ازم: "از من", باهاش: "با او", باهات: "با تو", باهام: "با من", واسه: "برای", واسش: "برایش", واسم: "برایم",
    واست: "برایت", برات: "برایت", براش: "برایش", بازم: "باز هم", هنوزم: "هنوز هم",
    اومدم: "آمدم", اومدی: "آمدی", اومد: "آمد", اومدیم: "آمدیم", اومدین: "آمدید", اومدن: "آمدند", اومده: "آمده",
    نیومد: "نیامد", نیومده: "نیامده", نیومدیم: "نیامدیم", نیومدم: "نیامدم", نیومدی: "نیامدی", نیومدن: "نیامدند",
    باشه: "باشد", نباشه: "نباشد", بشه: "بشود", نشه: "نشود", داره: "دارد", نداره: "ندارد",
    ندارن: "ندارند", هستن: "هستند", نیستن: "نیستند", هستین: "هستید", نیستین: "نیستید",
     بیام: "بیایم", بیای: "بیایی", نیاد: "نیاید", بیاین: "بیایید",
    هیچی: "هیچ", خوبه: "خوب است", چطوره: "چطور است",
    بفرمایین: "بفرمایید", ببخشین: "ببخشید", بشین: "بنشین",
    بگه: "بگوید", بگم: "بگویم", نگم: "نگویم",
    بریم: "برویم",
    میاد: "می‌آید", نمیاد: "نمی‌آید", میام: "می‌آیم", نمیام: "نمی‌آیم", میای: "می‌آیی", نمیای: "نمی‌آیی",
    میشه: "می‌شود", نمیشه: "نمی‌شود", میشم: "می‌شوم", میشن: "می‌شوند", میگه: "می‌گوید", میگم: "می‌گویم",
    میگی: "می‌گویی", میگن: "می‌گویند", نمیگه: "نمی‌گوید", میرم: "می‌روم", میره: "می‌رود", میرن: "می‌روند",
    میدم: "می‌دهم", میده: "می‌دهد", میدن: "می‌دهند", میکنه: "می‌کند", میکنن: "می‌کنند", نمیکنه: "نمی‌کند",
    اینجام: "اینجا هستم", اینجان: "اینجا هستند", کجاس: "کجاست", اونجور: "آن‌جور", اونوقت: "آن‌وقت", همونطور: "همان‌طور",
    همونطوری: "همان‌طور", همینجوری: "همین‌طور", چجوریه: "چطور است", وایستا: "بایست", وایسا: "بایست", وایستاد: "ایستاد", یخورده: "یک خرده",
    میدونم: "می‌دانم", نمیدونم: "نمی‌دانم", میدونی: "می‌دانی", نمیدونی: "نمی‌دانی", میتونم: "می‌توانم", نمیتونم: "نمی‌توانم",
    میخوام: "می‌خواهم", میخوای: "می‌خواهی", میخواد: "می‌خواهد", میخوایم: "می‌خواهیم", میخواین: "می‌خواهید", میخوان: "می‌خواهند",
    نمیخوام: "نمی‌خواهم", نمیخوای: "نمی‌خواهی", نمیخواد: "نمی‌خواهد", بخوام: "بخواهم", بخوای: "بخواهی", بخواد: "بخواهد"
};
/** Spoken words that are also written words or names («نون» the letter, «جون» a name, «رو» face): count 1. */
const AMBIGUOUS: Record<string, string> = {
    نون: "نان", جون: "جان", رون: "ران", مث: "مثل", گف: "گفت", رف: "رفت", هس: "هست", ماس: "ماست", کی: "کی",
    رو: "را", خب: "خوب", یه: "یک", اونو: "آن را", ایوون: "ایوان", نیس: "نیست", بیاد: "بیاید", ازت: "از تو", بگین: "بگویید", بهت: "به تو", اون: "آن", بارون: "باران", بهم: "به من", تورو: "تو را", منو: "من را", برام: "برایم", چی: "چه", دارین: "دارید", دارن: "دارند", برین: "بروید", کو: "کجاست"
};
/** Spoken present stems («میرم»، «میگه»، «میدم») → the written stem. */
const SPOKEN_STEMS: Record<string, string> = {
    گ: "گوی", ر: "رو", د: "ده", ش: "شو", تون: "توان", خوا: "خواه", دون: "دان", خون: "خوان", مون: "مان",
    رسون: "رسان", ذار: "گذار", زار: "گذار", آ: "آی", یا: "آی", گیر: "گیر", کن: "کن", زن: "زن",
    بین: "بین", خور: "خور", دو: "دو", پوش: "پوش", بر: "بر", گرد: "گرد", شکن: "شکن", کش: "کش", سوز: "سوز",
    ترس: "ترس", پرس: "پرس", فهم: "فهم", ریز: "ریز", خند: "خند", شین: "نشین", پلک: "پلک", گرد‌ون: "گردان", چرخون: "چرخان"
};
/** Is `s` a present stem as people say it («گ» of «میگه»، «ر» of «میره»، «تون» of «میتونه»)? */
export const isSpokenStem = (s: string) => s in SPOKEN_STEMS;
/** Spoken personal endings → written («ه» → «د»، «ن» → «ند»، «ین» → «ید»). */
const ENDS: Array<[string, string]> = [["یم", "یم"], ["ین", "ید"], ["ید", "ید"], ["ند", "ند"], ["م", "م"], ["ی", "ی"], ["ه", "د"], ["ن", "ند"]];
const SPOKEN_ENDS = new Set(["ه", "ن", "ین"]);

/** «می» + a spoken stem or a spoken ending: «میگه»، «می‌رم»، «میکنن» → «می‌گوید»، «می‌روم»، «می‌کنند». */
function spokenVerb(w: string): string | null {
    // a preverb may come first: «برمی‌گرده»، «درمیاد»
    const pv = w.match(/^(بر|در|باز|ور|وا)(?=ن?می)/)?.[1] ?? "";
    const m = w.slice(pv.length).match(/^(ن?می)‌?(.+)$/);
    if (!m || verbForm(m[2])) return null; // «می‌آیم»، «می‌دهم»: a written verb
    // «می‌اومد» ← «می‌آمد»: a spoken past stem
    if (SURE[m[2]] && /^(اومد|نیومد)/.test(m[2])) return `${pv}${m[1]}‌${SURE[m[2]]}`;
    const r = spokenVerbWith(m);
    return r ? pv + r : null;
}
function spokenVerbWith(m: RegExpMatchArray): string | null {
    for (const [end, written] of ENDS) {
        if (!m[2].endsWith(end) || m[2].length <= end.length) continue;
        const stem = m[2].slice(0, -end.length);
        const spoken = SPOKEN_STEMS[stem];
        // a spoken stem, or a written stem with a spoken ending («میکنه»)
        // a spoken stem with a spoken ending (not «ند/ید»: «می‌خواند»، «می‌دید» are written verbs)
        if (spoken && (end === "ند" || end === "ید")) continue;
        if (spoken && (spoken !== stem || SPOKEN_ENDS.has(end))) return `${m[1]}${Z}${spoken}${written}`;
        // a written stem with a spoken ending («میکنه»), if the corpus hardly has it («میوسن» is a name)
        if (!spoken && isPresentStem(stem) && SPOKEN_ENDS.has(end) && stem.length >= 2 && (corpusBucket(m.input ?? "") ?? -1) < 6) return `${m[1]}${Z}${stem}${written}`;
    }
    return null;
}

/** «بفهمن»، «بذارم»، «نشینن» → «بفهمند»، «بگذارم»، «ننشینند»: «ب/ن» + a stem + a spoken ending. */
function spokenSubjunctive(w: string): string | null {
    const m = w.match(/^(ب|ن)(.{2,})$/);
    if (!m || (corpusBucket(w) ?? -1) >= 6) return null;
    for (const end of ["ه", "ن", "ین", "یم", "م"]) {
        if (!m[2].endsWith(end) || m[2].length <= end.length) continue;
        const stem = m[2].slice(0, -end.length);
        // only stems that are spoken forms themselves; «ر»، «د»، «یا» make written words («نره»، «بده»، «نیای»)
        if (!SUBJUNCTIVE_STEMS.has(stem)) continue;
        return m[1] + SPOKEN_STEMS[stem] + (ENDS.find(([e]) => e === end)?.[1] ?? end);
    }
    return null;
}
const SUBJUNCTIVE_STEMS = new Set(["گ", "ش", "تون", "ذار", "زار", "شین", "دون", "خون", "رسون", "مون"]);

/** Endings a spoken word can carry («چمدون‌های»، «خونه‌مون»): spoken → written. */
const SUFFIXES: Array<[string, string]> = [
    ["‌هامون", "‌هایمان"], ["‌هاتون", "‌هایتان"], ["‌هاشون", "‌هایشان"], ["هامون", "هایمان"], ["هاتون", "هایتان"], ["هاشون", "هایشان"],
    ["‌های", "‌های"], ["‌ها", "‌ها"], ["های", "های"], ["ها", "ها"], ["مون", "مان"], ["تون", "تان"], ["شون", "شان"],
    ["‌مون", "‌مان"], ["‌تون", "‌تان"], ["‌شون", "‌شان"], ["‌ی", "‌ی"], ["ی", "ی"], ["‌م", "‌ام"], ["م", "م"], ["ت", "ت"], ["ش", "ش"], ["و", " را"]
];

/**
 * `sure`: surely spoken (2 points); else 1 point, and `hint`: a pattern that also fits names
 * («سالو»، «بورا»، «ایمون»), which counts only next to spoken sentences or in a dialogue.
 */
type Spoken = { formal: string; sure: boolean; hint?: "von" | "pron" | "plural" | "copula" | "ra" };

/**
 * «به» + a pronoun («بهش، بهت، بهم، بهشون، بهتون، بهمون»): never marked, in any register (1.5.2,
 * the user's decision). They still count as spoken words for the register.
 */
export const BE_PRONOUN = /^به‌?(ش|ت|م|اش|ات|ام|شون|تون|مون|شان|تان|مان)$/;

/**
 * The written form to offer for a spoken word in a written sentence (blue), or null: a sure
 * spoken word; one that only fits «-ون»، «-مون»، «-ا» (plural) when the corpus has never seen it
 * (names: «ایمون»، «سالو»); never «-ن» for «اند» or «-و» for «را» («چرمن»، «پدرو»).
 */
export function writtenForm(word: string): string | null {
    if (BE_PRONOUN.test(word)) return null;
    const s = spoken(word);
    if (!s) return null;
    if (s.sure) return s.formal;
    if (!s.hint || s.hint === "copula" || s.hint === "ra") return null;
    return (corpusBucket(word) ?? 0) < 0 ? s.formal : null;
}
const memo = new Map<string, Spoken | null>();

/** The written form of a spoken word, and whether the word is surely spoken; null: not a spoken word. */
export function spoken(word: string): Spoken | null {
    const w = word.replace(/[ي]/g, "ی").replace(/ك/g, "ک");
    const hit = memo.get(w);
    if (hit !== undefined) return hit;
    const r = findSpoken(w);
    if (memo.size > 20000) memo.clear();
    memo.set(w, r);
    return r;
}

function base(w: string): Spoken | null {
    const k = skel(w);
    // the list is looked up without a half-space only after «می» («می‌گه»), not in «بی‌ام»
    const key = SURE[w] || AMBIGUOUS[w] ? w : /^ن?می‌[^‌]+$/.test(w) ? k : w;
    if (SURE[key]) return { formal: SURE[key], sure: true };
    if (AMBIGUOUS[key]) return { formal: AMBIGUOUS[key], sure: false };
    if (written(w)) return null; // a written word («میانه»، «سیمون»، «بره»، «روی»)
    const v = spokenVerb(w) ?? spokenSubjunctive(w);
    // a one-letter stem with «ی» is also a name or a written word: «میری»، «نمیری»
    // a one-letter stem with «ی» is also a name or a written word («میری»، «نمیری»، «میدی»)، and
    // «می‌مونه» is also «میمونه» (a name)
    if (v) return { formal: v, sure: !/^ن?می‌?(.ی|مون.*)$/.test(w) };
    // «ون» for «ان»: «چمدون» → «چمدان»، «گرون» → «گران» (not at the start: «ونک»)
    const i = k.lastIndexOf("ون");
    if (i >= 1 && k.length >= 4) {
        // «ون» for «ان» or «وان»: «چمدون» → «چمدان»، «استخون» → «استخوان»
        for (const f of [k.slice(0, i) + "ان" + k.slice(i + 2), k.slice(0, i) + "وان" + k.slice(i + 2)]) {
            // «می‌دونست» → «می‌دانست»: the half-space after «می» stays
            if (KNOWN.has(f) || (corpusBucket(f) ?? -1) >= 8) return { formal: /^ن?می‌/.test(w) ? f.replace(/^(ن?می)/, "$1‌") : f, sure: false, hint: "von" };
        }
    }
    return null;
}

function findSpoken(w: string): Spoken | null {
    const b = base(w);
    if (b) return b;
    if (written(w)) return null;
    for (const [suf, written] of SUFFIXES) {
        if (!w.endsWith(suf) || w.length - suf.length < 2) continue;
        const stem = w.slice(0, -suf.length);
        const s = base(stem);
        // endings of nouns and adjectives only («چمدون‌های»، «خونه‌مون»), not of verbs («بیای» + «م»)
        if (s && !s.formal.includes(" ") && (COMMON.has(s.formal) || s.hint)) return { formal: s.formal + joinSuffix(s.formal, written), sure: s.sure, hint: written === " را" && !s.sure ? "ra" : s.hint };
        // «پامون» → «پایمان»، «خونه‌مون»: a written stem with a spoken pronoun
        if ((suf.endsWith("مون") || suf.endsWith("تون") || suf.endsWith("شون")) && isKnown(skel(stem)) && stem.length >= 2) {
            const st = skel(stem);
            const glue = /[او]$/.test(st) ? "ی" : st.endsWith("ه") ? Z : "";
            return { formal: st + glue + written.replace(/^‌/, ""), sure: false, hint: "pron" };
        }
    }
    const k = skel(w);
    // «خانما» → «خانم‌ها»: «ا» for the plural «ها» after a known word
    if (k.endsWith("ا") && k.length >= 4) {
        const st = k.slice(0, -1);
        if (isKnown(st) && COMMON.has(st) && !/[اوهی]$/.test(st)) return { formal: st + ("دذرزژو".includes(st.slice(-1)) ? "" : Z) + "ها", sure: false, hint: "plural" };
    }
    // «منتظرن» → «منتظرند»، «خارجن» → «خارج‌اند» (the copula «اند» as «ن»)
    if (k.endsWith("ن") && k.length >= 4) {
        const st = k.slice(0, -1);
        if ((isKnown(st) || (corpusBucket(st) ?? -1) >= 9) && !/[اوهی]$/.test(st)) return { formal: st + ("دذرزژو".includes(st.slice(-1)) ? "ند" : Z + "اند"), sure: false, hint: "copula" };
    }
    // «کتابو» → «کتاب را»
    if (k.endsWith("و") && k.length >= 4) {
        const st = k.slice(0, -1);
        if (isKnown(st) && COMMON.has(st) && !/[اوی]$/.test(st)) return { formal: st + " را", sure: false, hint: "ra" };
        // «کلاهتو»، «حالمو»، «اونارو»: a word with a pronoun, or a spoken word, then «و/رو»
        const st2 = k.endsWith("رو") && /[اوی]$/.test(k.slice(0, -2)) ? k.slice(0, -2) : st;
        const sp = st2 !== k ? spoken(st2) : null;
        if (!/[اوی]$/.test(st) || st2 !== st) {
            if (sp && !sp.formal.includes(" ")) return { formal: sp.formal + " را", sure: false, hint: "ra" };
            if (knownish(st2) && st2.length >= 3) return { formal: st2 + " را", sure: false, hint: "ra" };
        }
    }
    // «دانشجوئه»، «ساختمونه»: «است» as «ه»
    if (/(ئه|ونه)$/.test(k) && k.length >= 5) {
        const st = k.endsWith("ئه") ? k.slice(0, -2) : k.slice(0, -1);
        const sp = spoken(st);
        if (isKnown(st) || sp) return { formal: (sp ? sp.formal : st) + " است", sure: false, hint: "copula" };
    }
    return null;
}

/** How a written ending joins a word: «چمدان» + «‌های»، «خانه» + «‌ام». */
function joinSuffix(word: string, suf: string): string {
    if (suf.startsWith(" ")) return suf;
    const s = suf.replace(/^‌/, "");
    if (word.endsWith("ه") && /^[امتشی]/.test(s)) return Z + (s === "م" ? "ام" : s === "ت" ? "ات" : s === "ش" ? "اش" : s);
    if (/^ها/.test(s) && !"اآدذرزژو".includes(word.slice(-1))) return Z + s;
    return s;
}

/** Sure written words: they take points off a sentence. */
const WRITTEN: Record<string, number> = {
    است: 2, می‌باشد: 3, میباشد: 3, می‌باشند: 3, میباشند: 3, را: 1, آنها: 1, آن‌ها: 1, ایشان: 1, نیز: 1, همچنین: 1,
    زیرا: 1, گردید: 1, گردیده: 1, گردیدند: 1, باشد: 1, شود: 1, نماید: 1, می‌گردد: 1, اند: 1, بوده‌است: 1, شده‌است: 1,
    توسط: 1, وی: 1, چنانچه: 1, لذا: 1, بنابراین: 1, می‌شود: 1, نمی‌شود: 1, دارد: 1, ندارد: 1
};
/** A written verb with a written ending: «می‌کند»، «می‌گویند». */
const WRITTEN_VERB = /^ن?می‌?(.+?)(د|ند|ید)$/;

/** A known word, maybe with a pronoun ending: «صورتم»، «دستش». */
export function knownish(w: string): boolean {
    if (isKnown(w)) return true;
    const m = w.match(/^(.{2,}?)(م|ت|ش|مان|تان|شان|مون|تون|شون)$/);
    return !!m && isKnown(m[1]);
}

/** Points: `sure` spoken words (2 each), `weak` ones (1 each), `written` ones to take off; `why`: the words. */
export type Score = { spoken: number; sure: number; hints: number; written: number; why: string[] };
const WORD_RE = /[\u0621-\u063A\u0641-\u0652\u0670-\u06D3\u06CC\u06A9\u06AF\u067E\u0686\u0698\u200c]+/g;

/** The spoken and written points of a stretch of text. */
export function scoreOf(s: string): Score {
    let sp = 0;
    let sure = 0;
    let hints = 0;
    let wr = 0;
    const why: string[] = [];
    const words = s.match(WORD_RE) ?? [];
    for (let i = 0; i < words.length; i++) {
        const w = words[i].replace(/^‌+|‌+$/g, "");
        if (!w || /[\u064B-\u0652]/.test(w)) continue; // «کاملاً»: a written word
        if (WRITTEN[w] !== undefined) {
            wr += WRITTEN[w];
            why.push("-" + w);
            continue;
        }
        if (/‌?است$/.test(w) && w.length > 4 && !isKnown(w)) {
            wr += 1; // «شده‌است»، «گفته‌است»
            why.push("-" + w);
            continue;
        }
        const vm = w.match(WRITTEN_VERB);
        if (vm && isPresentStem(vm[1])) {
            wr += 1;
            why.push("-" + w);
            continue;
        }
        if (w === "رو") {
            // «را» as «رو»; not «رو به»، «روبه‌رو»
            const next = words[i + 1] ?? "";
            if (!/^(به|در|بر)$/.test(next) && i > 0) {
                sp += 1;
                why.push("+رو");
            }
            continue;
        }
        if (w.startsWith("تو") && w.length >= 5 && !isKnown(w) && !isKnown(skel(w)) && (knownish(w.slice(2)) || spoken(w.slice(2)))) {
            sp += 1; // «توصورتم»: «تو» (in) run into the next word
            hints++;
            why.push("+" + w);
            continue;
        }
        const s1 = spoken(w);
        if (s1) {
            sp += s1.sure ? 2 : 1;
            if (s1.sure) sure++;
            if (s1.hint) hints++;
            why.push((s1.sure ? "++" : "+") + w);
        }
    }
    return { spoken: sp, sure, hints, written: wr, why };
}

export type Segment = { start: number; end: number; spoken: boolean; why?: string[] };
const segMemo = new Map<string, Segment[]>();

/** The text's sentences and quotations, each spoken or written, in order (offsets into `text`). */
export function registerSegments(text: string): Segment[] {
    const hit = segMemo.get(text);
    if (hit) return hit;
    const out: Segment[] = [];
    let at = 0;
    for (const line of text.split("\n")) {
        out.push(...lineSegments(line, at));
        at += line.length + 1;
    }
    if (segMemo.size > 2000) segMemo.clear();
    segMemo.set(text, out);
    return out;
}

type Unit = { start: number; end: number; quote: boolean; afterColon: boolean; score: Score; spoken: boolean };

function lineSegments(line: string, offset: number): Segment[] {
    const units: Unit[] = [];
    const dialogue = /^\s*[-‐–—ـ]/.test(line);
    const push = (s: number, e: number, quote: boolean) => {
        if (!/[؀-ۿ]/.test(line.slice(s, e))) return;
        const afterColon = quote && /:\s*$/.test(line.slice(0, s));
        units.push({ start: s, end: e, quote, afterColon, score: scoreOf(line.slice(s, e)), spoken: false });
    };
    const sentences = (s: number, e: number) => {
        let a = s;
        const re = /[.!?؟؛…]+(?=\s|$)/g;
        re.lastIndex = s;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line)) && m.index < e) {
            const b = Math.min(m.index + m[0].length, e);
            push(a, b, false);
            a = b;
        }
        if (a < e) push(a, e, false);
    };
    // «…» quotations (closed on the same line) are units of their own
    let pos = 0;
    const qre = /«[^«»]*»/g;
    let q: RegExpExecArray | null;
    while ((q = qre.exec(line))) {
        sentences(pos, q.index);
        push(q.index, q.index + q[0].length, true);
        pos = q.index + q[0].length;
    }
    sentences(pos, line.length);
    const net = (u: Unit) => u.score.spoken - u.score.written;
    for (const u of units) {
        // a short quotation (a title, a term: «خونه»، «دیگه چه خبر») is spoken only as dialogue
        const titleLike = u.quote && !u.afterColon && (line.slice(u.start, u.end).match(WORD_RE)?.length ?? 0) <= 4;
        // a sure spoken word and 2 points, or 3 points of weaker ones (names: «بورا»، «ایمون»)
        u.spoken = !titleLike && ((u.score.sure >= 1 && net(u) >= 2) || net(u) - u.score.hints >= 3 || (net(u) >= 1 && (dialogue || u.afterColon)));
    }
    // next to a spoken sentence, one spoken word is enough; between two, none (if nothing written)
    for (let pass = 0; pass < 2; pass++) {
        units.forEach((u, i) => {
            if (u.spoken) return;
            const prev = units[i - 1]?.spoken ?? false;
            const next = units[i + 1]?.spoken ?? false;
            if (net(u) >= 1 && u.score.spoken >= 1 && (prev || next)) u.spoken = true;
            else if (u.score.written === 0 && prev && next) u.spoken = true;
        });
    }
    // a line of dialogue (after a dash) with a spoken sentence: all of it, but what is written
    if (dialogue && units.some((u) => u.spoken)) for (const u of units) if (u.score.written === 0) u.spoken = true;
    return units.map((u) => ({ start: offset + u.start, end: offset + u.end, spoken: u.spoken, why: u.score.why }));
}

/** Is the text at `pos` in a spoken stretch? (between units: the unit before it) */
export function spokenAt(segments: Segment[], pos: number): boolean {
    let lo = 0;
    let hi = segments.length - 1;
    let best = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (segments[mid].start <= pos) {
            best = mid;
            lo = mid + 1;
        } else hi = mid - 1;
    }
    if (best < 0) return segments[0]?.spoken ?? false;
    return segments[best].spoken;
}
