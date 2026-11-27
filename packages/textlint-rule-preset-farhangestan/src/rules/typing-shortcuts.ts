/*
 * نوشتار شتاب‌زده (1.5.2): what chat-style typing leaves out.
 *
 * - «ک» و «ب» تنها میان دو کلمه، به جای «که» و «به»: «کاری ک ادما میتونن»، «بسپار ب خدا». در
 *   جملۀ گفتاری قطعی (قرمز)؛ در جملۀ نوشتاری پیشنهاد (زرد)، چون آن‌جا «ک» و «ب» نام حرف یا
 *   شمارۀ بند هم هستند («حرف ک»، «بند ب»، «الف و ب»، «ب.ظ»).
 * - «ی» تنها پس از کلمه‌ای که به حرف بی‌صدا ختم می‌شود، به جای «یه/یک»: «ی ادم» (زرد، «یه» اول در
 *   جملۀ گفتاری و «یک» در نوشتاری). «خانه ی من» (کسرۀ اضافه) قاعدۀ «کسرۀ اضافه» است.
 * - «اگ» به جای «اگه/اگر» (زرد).
 * - «ک» چسبیده به آخر کلمۀ شناخته‌شده پیش از جمله‌واره: «همونقدرک لبخند» ← «همونقدر که» (زرد).
 * - «آ»ی افتاده: «ادم»، «ادما»، «ازارش»، «اینده» ← «آدم»، «آدما»، «آزارش»، «آینده»: فهرست بستۀ
 *   کلمه‌هایی که فقط با «آ» رایج‌اند و شکل «ا»یشان کلمه نیست (dict/alef-madd.json، util/madd.ts).
 *   از ۱.۶.۰ «ان» و «اب» هم («آن»، «آب»)، جز در «سی ان ان»، «دی ان ای»، «ان شاء الله» و عبارت عربی؛
 *   «اره» زرد («آره» یا «اره»ی درودگری).
 * از ۱.۶.۰:
 * - «بزار، میزارم، نزاشتم» ← «بذار، می‌ذارم، نذاشتم»: شکستۀ «گذاشتن» با «ذ» (قرمز).
 * - «میخام، نمیخاد، بخای، خاهش، خابیدم» ← «می‌خوام، نمی‌خواد، بخوای، خواهش، خوابیدم» (قرمز).
 * - «چ» و «بش/بم/بت» میان دو کلمه ← «چه»، «بهش/بهم/بهت» (زرد).
 * - «یبار، یجوری، یدونه» ← «یه بار، یه‌جوری، یه دونه» (زرد).
 * - حرف تکرارشده برای تأکید («خیلیییی»، «سلاااام») ← «خیلی»، «سلام» (آبی، پیشنهاد؛ خندۀ «خخخ» نه).
 * - «ئی» پس از مصوّت («پائین»، «خدائی») ← «پایین»، «خدایی» (آبی: کتاب هر دو را درست می‌داند و
 *   «ی» را برای یکدستی برگزیده است؛ دستور خط، پانوشت ۱۸).
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../util/persian";
import { isKnown, FARHANG } from "../util/words";
import { registerSegments, spokenAt, spoken } from "../util/colloquial";
import { missingMadd } from "../util/madd";
import { verbForm } from "./mi-prefix";
import { corpusBucket } from "../util/speller";
import compounds from "../dict/compounds.json";

const SOURCE = "قراردادهای رایج نوشتار (در دستور خط نیامده)";
const Z = ZWNJ;
/** Not inside a word broken up by kashidas or written in presentation forms («هـمـان»، «وﺟﺪان»). */
const NS_B = "(?<![ـ\\uFB50-\\uFEFF])";
const NS_A = "(?![ـ\\uFB50-\\uFEFF])";
/** Words around «ان» that make it a letter of an abbreviation or part of «ان شاء الله»: «سی ان ان»، «دی ان ای». */
const AN_PREV = new Set(["سی", "دی", "ان", "بی", "آی", "ای", "اف", "جی", "آر", "ام", "اس", "تی", "وی", "پی", "کی", "گانز", "اشهد", "علی", "ال"]);
const AN_NEXT = /^(ان|ای|شاء|شا|شالله|شاالله|شاءالله|شاءلله|اس|جی|آی|اچ|سی|دی|ال)$/;
/** Arabic around a word («لا تزوّجه ان كان»، «علمت ان رامیا»): an Arabic «ان». */
const ARABIC_NEAR = /[كيةىإ]|(?:^|\s)(?:کان|فی|في|علمت|قال|انه|انما|لم|لن|الذی|اللهم|بان|لان|ولا|الا)(?=[\s.،؛:!؟]|$)/;
/** The book's compounds with «به»: «به دلیل» → «به‌دلیل». */
const BE_COMPOUND = new Map<string, string>(
    (compounds.entries as Array<{ from: string[]; to: string; fix?: boolean }>).filter((e) => e.fix !== false && e.to.startsWith("به")).flatMap((e) => e.from.filter((f) => /^به [^ ]+$/.test(f)).map((f) => [f, e.to] as [string, string]))
);
/** «بزار»، «میزارم»، «نزاشتم»: the spoken «گذاشتن» is written with «ذ». */
const ZAL = new RegExp(`${START}(ن?می[${ZWNJ} ]?|ب|ن)(زار|زاشت)(م|ی|ه|یم|ید|ین|ن|ند|مش|یش|ش|ت|تش|یمش|ینش|نش|ه${ZWNJ}?ش)?${END}`, "g");
/** «میخام»، «بخاد»، «میخاستم»: «خواستن» without its «و»; «خاهش»، «خاهر»، «خابیدم». */
const KHA = new RegExp(`${START}(?:(ن?می[${ZWNJ} ]?|ب|ن)خا(م|ی|د|یم|ید|ین|ن|ند|مش|یش|ه)|(ن?می[${ZWNJ} ]?|ن)خاست(م|ی|یم|ید|ین|ند|ن)?|(خاه)(ش|شا|شاً|ر|رم|رت|رش|ری|ران|رها|ر${ZWNJ}ها)|(ن?می[${ZWNJ} ]?|ب|ن)?(خاب)(یدم|یدی|ید|یدیم|یدید|یدند|یدن|م|ی|ه|ید|یم|ین|ن|ش|مون|یده))${END}`, "g");
/** «یبار»، «یجوری»: «یه» run into a short word. */
const YE_JOINED: Record<string, string> = {
    بار: "یه بار", جوری: "یه‌جوری", دونه: "یه دونه", دفعه: "یه‌دفعه", روز: "یه روز", سری: "یه سری", ذره: "یه ذره", نفر: "یه نفر",
    عالمه: "یه عالمه", کاری: "یه کاری", چیزی: "یه چیزی", طوری: "یه طوری", کمی: "یه کمی", جایی: "یه جایی", وقت: "یه وقت", بارم: "یه بارم",
    لحظه: "یه لحظه", مدت: "یه مدت", شب: "یه شب", ساعت: "یه ساعت", سال: "یه سال", ماه: "یه ماه"
};
/** Spoken forms whose «آ»-less spelling is also a word: «اره» (a saw). */
const LAUGH = /^(?:خ+|ه+|ع+|ا+|و+|ی+|ن+|م+)$/;

/** Words «که» follows and «ک» is glued to in chat typing: «همونقدرک»، «وقتیک». */
const CLAUSE_HEADS = new Set([
    "همونقدر", "همینقدر", "اونقدر", "اینقدر", "انقدر", "همانقدر", "آنقدر", "اینطور", "اونطور", "همونطور", "همینطور",
    "طوری", "جوری", "وقتی", "کسی", "چیزی", "جایی", "یعنی", "مگه", "همونجا", "همینجا", "اونجا", "اینجا", "درحالی", "بطوری", "بهطوری"
]);
/** Words before a letter's name or a list item: «حرف ک»، «بند ب»، «الف و ب». */
const LETTER_CONTEXT = new Set(["یعنی", "حرف", "حروف", "نویسه", "بند", "ردیف", "گروه", "تبصره", "قسمت", "بخش", "مورد", "الف", "پ", "ت", "ج", "د", "حرفِ",
    // an initial or a name's letter (1.6.0): «خانم ب»، «ویتامین ک»، «هپاتیت ب»
    "خانم", "آقای", "آقا", "دکتر", "مهندس", "استاد", "ویتامین", "هپاتیت", "گزینه", "نوع", "طرح", "فرم", "کلاس", "شرکت", "تیپ"]);
const spokenHere = (text: string, index: number) => spokenAt(registerSegments(text), index);

/** The words around index (same line), letters only. */
function around(text: string, start: number, end: number): [string, string] {
    const prev = text.slice(0, start).match(/(?:^|[^\p{L}‌])([\p{L}‌]+) $/u)?.[1] ?? "";
    const next = text.slice(end).match(/^ ([\p{L}‌]+)(?:$|[^\p{L}‌])/u)?.[1] ?? "";
    return [prev, next];
}

/** Words this rule corrects: the spelling checker leaves them to it (no «یبار» → «تبار»). */
export function handledByShortcuts(w: string): boolean {
    if (missingMadd(w) || w === "ان" || w === "اب" || w === "اره") return true;
    if (new RegExp(`^${ZAL.source.slice(START.length, -END.length)}$`).test(w) || new RegExp(`^${KHA.source.slice(START.length, -END.length)}$`).test(w)) return true;
    if (w.startsWith("ی") && w.slice(1) in YE_JOINED) return true;
    return /(.)\1{2,}/.test(w);
}

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            // «کاری ک ادما»، «بسپار ب خدا»: a word on both sides, not a letter's name or a list item
            pattern: new RegExp(`${START}(ک|ب)${END}`, "g"),
            check: (m) => {
                const [prev, next] = around(m.input, m.index, m.index + 1);
                if (!prev || !next || LETTER_CONTEXT.has(prev) || LETTER_CONTEXT.has(next) || next === "و" || prev === "و" && next.length <= 2) return null;
                if (next.length === 1 || next === "به" || next === "که") return null;
                if (prev.length <= 2 && next.length <= 2) return null; // letters spelled out: «ای ک جی» // «ک ر ی ن» spelled out; «دربند ب به»
                const full = m[1] === "ک" ? "که" : "به";
                const spoken = spokenHere(m.input, m.index);
                // «ب دلیل»: «به» + the next word is one of the book's compounds («به‌دلیل»): both at once (1.6.0)
                const compound = full === "به" ? BE_COMPOUND.get("به " + next) : undefined;
                if (compound && m.input.slice(m.index + 1, m.index + 2 + next.length) === " " + next) {
                    return { message: `«ب» به جای «به»: «${compound}»`, replacement: compound, end: 2 + next.length, fix: spoken ? undefined : false };
                }
                return { message: `«${m[1]}» به جای «${full}»: «${full}» را کامل بنویسید`, replacement: full, fix: spoken ? undefined : false };
            }
        },
        {
            // «ی ادم»: «یه/یک»; not after a word in a vowel («خانه ی»، «دانشجو ی»: the ezafe or «ی» written apart)
            pattern: new RegExp(`${START}ی${END}`, "g"),
            check: (m) => {
                const [prev, next] = around(m.input, m.index, m.index + 1);
                // after a space only: «همه‏ی»، «پنجره-ی» are the ezafe or «ی» written apart
                if (m.index > 0 && m.input[m.index - 1] !== " ") return null;
                if (!next || next.length < 2 || LETTER_CONTEXT.has(prev) || /[اوهیۀءأ]$/.test(prev)) return null;
                if (prev && !/[\p{L}]$/u.test(prev)) return null;
                const spoken = spokenHere(m.input, m.index);
                const [first, second] = spoken ? ["یه", "یک"] : ["یک", "یه"];
                return { message: `«ی» به جای «${first}» (یا «${second}»)`, replacement: first, alternatives: [second], fix: false };
            }
        },
        {
            // «اگ درگیرش بشی»: «اگه/اگر»
            pattern: new RegExp(`${START}اگ${END}`, "g"),
            check: (m) => {
                const [, next] = around(m.input, m.index, m.index + 2);
                if (!next) return null;
                const spoken = spokenHere(m.input, m.index);
                const [first, second] = spoken ? ["اگه", "اگر"] : ["اگر", "اگه"];
                return { message: `«اگ» به جای «${first}» (یا «${second}»)`, replacement: first, alternatives: [second], fix: false };
            }
        },
        {
            // «همونقدرک لبخند»: «که» glued as «ک» to a word that introduces a clause (a closed list: «پارک»،
            // «مارک»، «کوچیک» are words of their own)
            pattern: new RegExp(`${START}(${[...CLAUSE_HEADS].join("|")})ک(?= ${LETTER})`, "g"),
            check: (m) => ({ message: `«ک» به جای «که»: «${m[1]} که»`, replacement: m[1] + " که", fix: false })
        },
        {
            // «ادم»، «ادما»، «ازارش» → «آدم»، «آدما»، «آزارش»
            pattern: new RegExp(`${NS_B}${START}ا(${LETTER}+)${END}${NS_A}`, "g"),
            check: (m) => {
                const fixed = missingMadd(m[0]);
                if (!fixed) return null;
                return { message: `«آ» با مد نوشته می‌شود: «${fixed}»`, replacement: "آ", end: 1, source: "فرهنگ املایی خطّ فارسی" };
            }
        },
        {
            // «ان روز»، «اب خوردن» → «آن روز»، «آب خوردن» (1.6.0); not «سی ان ان»، «دی ان ای»، «ان شاء الله»، Arabic
            pattern: new RegExp(`${NS_B}${START}(ان|اب)${END}${NS_A}`, "g"),
            check: (m) => {
                const [prev, next] = around(m.input, m.index, m.index + 2);
                // a word on its own: not «آ.ا.ن.»، «ها/ان»، «"ان"»، «(ان)»
                const before = m.input[m.index - 1] ?? " ";
                const after = m.input[m.index + 2] ?? " ";
                if (!/[\s]/.test(before) && m.index > 0 || !/[\s.،؛:!؟]/.test(after) && m.index + 2 < m.input.length || after === "." && /^\.?[^\s]/.test(m.input.slice(m.index + 3, m.index + 4))) return null;
                // the next word Persian and known: not a name («چانگ ان»، «کومار ان پاتل»)
                if (next && !(isKnown(next) || (corpusBucket(next) ?? -1) >= 4 || spoken(next) || verbForm(next))) return null;
                if (m[1] === "ان") {
                    if (AN_PREV.has(prev) || AN_NEXT.test(next) || prev.endsWith("اشهد")) return null;
                    if (/^ *[0-9۰-۹A-Za-z]/.test(m.input.slice(m.index + 2))) return null; // «ان 95»
                    if (/[A-Za-z0-9]/.test(m.input.slice(Math.max(0, m.index - 12), m.index))) return null;
                    // initials: «بی. ان. پی»، «وی. ان.»
                    if (/(?:^|[^\p{L}])[\p{L}]{1,3}\. ?$/u.test(m.input.slice(Math.max(0, m.index - 6), m.index)) || /^\. ?[\p{L}]{1,3}(?:\.|$)/u.test(m.input.slice(m.index + 2, m.index + 8)) || /^\.$/.test(m.input.slice(m.index + 2)) && /[\p{L}]{1,3}\. ?$/u.test(m.input.slice(0, m.index))) return null;
                    const near = m.input.slice(Math.max(0, m.index - 40), m.index + 42);
                    if (ARABIC_NEAR.test(near.replace(/(^|\s)ان(?=\s|$)/, "$1"))) return null;
                } else if (/^[A-Za-z]/.test(m.input.slice(m.index + 3, m.index + 4))) return null;
                // a single letter around it: spelled out («ب ا ب»)
                if ((prev.length === 1 && prev !== "و") || (next.length === 1 && next !== "و")) return null;
                const fixed = "آ" + m[1].slice(1);
                // «ان» in a written sentence may still be a name or an initial («چانگ ان»، «کومار ان پاتل»: 92% right on
                // Wikipedia, 97% in blogs): asked there (yellow), red in a spoken one (1.6.0)
                const ask = m[1] === "ان" && !spokenHere(m.input, m.index);
                return { message: `«آ» با مد نوشته می‌شود: «${fixed}»`, replacement: "آ", end: 1, fix: ask ? false : undefined, source: "فرهنگ املایی خطّ فارسی" };
            }
        },
        {
            // «اره» is «آره» (yes) in chat, but also a saw: asked (1.6.0)
            pattern: new RegExp(`${NS_B}${START}اره${END}${NS_A}`, "g"),
            check: (m) => {
                const [prev, next] = around(m.input, m.index, m.index + 3);
                if (/^(برقی|برش|دستی|فارسی|موتوری|کمانی|نواری|زنجیری|ماهی|گرد|عمود|مویی)$/.test(next) || /^(با|دستگاه|تیغه|تیغ|دندانه)$/.test(prev)) return null;
                return { message: "اگر به معنای «بله» است، با مد نوشته می‌شود: «آره»", replacement: "آره", fix: false, source: "فرهنگ املایی خطّ فارسی" };
            }
        },
        {
            // «بزار، میزارم، نزاشتم» → «بذار، می‌ذارم، نذاشتم» (1.6.0)
            pattern: ZAL,
            check: (m) => {
                const [prev, next] = around(m.input, m.index, m.index + m[0].length);
                if (m[0] === "نزار" && (/^(قبانی|قبانى)$/.test(next) || prev === "تن")) return null; // the poet; «تن نزار» (gaunt)
                // «نزار»، «نزاری» are also a name and the Nizari Ismailis: only in a spoken sentence
                if (/^نزاری?$/.test(m[0]) && !spokenHere(m.input, m.index)) return null;
                const pre = m[1].replace(/^(ن?می)[ \u200c]?$/, "$1" + Z);
                const fixed = pre + m[2].replace("ز", "ذ") + (m[3] ?? "");
                return {
                    message: `شکستۀ «گذاشتن» با «ذ» نوشته می‌شود: «${fixed}»`,
                    replacement: fixed,
                    source: "اصول شکسته‌نویسی؛ فرهنگ املایی خطّ فارسی («گذاشتن»)"
                };
            }
        },
        {
            // «میخام، نمیخاد، بخای، خاهش، خابیدم» → «می‌خوام…» (1.6.0)
            pattern: KHA,
            check: (m) => {
                const fixed = m[0].replace(/^(ن?می)[ \u200c]?(?=خ)/, "$1" + Z).replace(/خا(?=ست|ه|ب|م$|ی$|د$|یم$|ید$|ین$|ن$|ند$|مش$|یش$|ه$)/, "خوا");
                if (fixed === m[0]) return null;
                const verb = /خواب/.test(fixed) ? "«خوابیدن»" : /خواه(?!ش)/.test(fixed) && !/خواهر/.test(fixed) ? "«خواستن»" : /خواهر/.test(fixed) ? "«خواهر»" : /خواهش/.test(fixed) ? "«خواهش»" : "«خواستن»";
                return { message: `«خوا» در ${verb} با «و» نوشته می‌شود: «${fixed}»`, replacement: fixed, source: `فرهنگ املایی خطّ فارسی (${verb})` };
            }
        },
        {
            // «چ» and «بش/بم/بت» between two words: «چه»، «بهش/بهم/بهت» (1.6.0)
            // (not «بت» (idol) or «بم» (bass, the city): words of their own)
            pattern: new RegExp(`${NS_B}${START}(چ|بش)${END}${NS_A}`, "g"),
            check: (m) => {
                const [prev, next] = around(m.input, m.index, m.index + m[0].length);
                if (!prev || !next || LETTER_CONTEXT.has(prev) || LETTER_CONTEXT.has(next) || prev.length === 1 || next.length === 1) return null;
                const full = ({ چ: "چه", بش: "بهش" } as Record<string, string>)[m[1]];
                return { message: `«${m[1]}» به جای «${full}»: «${full}» را کامل بنویسید`, replacement: full, fix: false };
            }
        },
        {
            // «یبار، یجوری» → «یه بار، یه‌جوری» (1.6.0)
            pattern: new RegExp(`${NS_B}${START}ی(${Object.keys(YE_JOINED).join("|")})${END}${NS_A}`, "g"),
            check: (m) => {
                if (isKnown(m[0]) || (corpusBucket(m[0]) ?? -1) >= 6) return null;
                const fixed = YE_JOINED[m[1]];
                return { message: `«یه» جدا از کلمۀ بعد نوشته می‌شود: «${fixed}»`, replacement: fixed, fix: false };
            }
        },
        {
            // «خیلیییی، سلاااام» → «خیلی، سلام» (1.6.0): a recommendation; laughter («خخخ»، «هههه») is left alone
            pattern: new RegExp(`${NS_B}${START}${LETTER}*(${LETTER})\\1{2,}${LETTER}*${END}${NS_A}`, "g"),
            check: (m) => {
                const w = m[0];
                if (LAUGH.test(w) || /^(?:خ|ه){3,}/.test(w) || /(?:خ|ه)(?:خ|ه)(?:خ|ه)$/.test(w.replace(/[^خه]/g, "").slice(-3)) && /^[خه]+$/.test(w)) return null;
                const one = w.replace(/(.)\1{2,}/g, "$1");
                const two = w.replace(/(.)\1{2,}/g, "$1$1");
                const base = [one, two].find((x) => isKnown(x) || (corpusBucket(x) ?? -1) >= 8);
                if (!base) return null;
                return { message: `حرف تکرارشده برای تأکید در نوشتار رسمی نمی‌آید: «${base}»`, replacement: base, fix: false, kind: "suggestion" };
            }
        },
        {
            // «پائین، خدائی، آئین» → «پایین، خدایی، آیین»: both right, the book chose «ی» (1.6.0, blue)
            // inside the word only: «خدائی» (the ending «ی») is copula-attachment's recommendation
            pattern: new RegExp(`${START}${LETTER}*[اوآ]ئی${LETTER}+${END}`, "g"),
            check: (m) => {
                const fixed = m[0].replace(/([اوآ])ئی/g, "$1یی");
                // only where the farhang gives both, the «ی» form first («پایین/پائین»، «آیین/آئین»); the book's
                // hamza words keep their «ئ» («اسرائیل»، «پروتئین»: جدول ۳)
                const row = FARHANG[fixed.replace(/\u200c/g, "")];
                if (!row || row[0] !== fixed || !row[1].includes(m[0])) return null;
                return {
                    message: `میان دو مصوّت صامت میانجی «ی» و «ء» هر دو درست‌اند؛ کتاب برای یکدستی «ی» را برگزیده است: «${fixed}»`,
                    replacement: fixed,
                    fix: false,
                    kind: "suggestion",
                    source: "دستور خط، «صامت میانجی»، پانوشت ۱۸"
                };
            }
        }
    ]
}));
