/*
 * شکستن بیش از حد
 *
 * اصول شکسته‌نویسی (علی صلح‌جو، نشر مرکز)، «کاهش تعداد هجا: راهنمای
 * شکسته‌نویسی» (ص ۱۴–۱۵) و «خلاصه» (ص ۴۴–۴۵):
 *   فقط کلماتی که در گفتار کاهش هجایی پیدا می‌کنند باید شکسته شوند …
 *   واژه‌هایی با ساختار بالا، که تعداد هجاهای آن‌ها در گفتار و نوشتار یکسان
 *   است (مثلاً نان/نون، همان/همون)، نباید شکست.
 *
 * - «نون، خونه، دیگه، اگه» ← «نان، خانه، دیگر، اگر» (هجا کم نمی‌شود)
 * - «نیس، هس، ماس» ← «نیست، هست، ماست» («ت» پایانی خودبه‌خود نرم ادا می‌شود؛ ص ۱۴، ۲۴، ۴۱)
 * - «یه» ← «یک» (ص ۴۲)
 * - «منو، اینو، کتابو» ← «من را، این را، کتاب را» («را» را باید نگه داشت؛ ص ۲۵، ۲۷)
 * - «بهت، بهش، بهم، بهشون، بهتون، بهمون» (به + ضمیر) علامت نمی‌خورند (از نسخۀ ۱.۵.۲، به تصمیم
 *   کاربر): کتاب «به‌اش، به‌شون» را پیشنهاد می‌کند (ص ۲۱–۲۲)، ولی این شکل‌ها در نوشتۀ گفتاری
 *   جاافتاده‌اند و هیچ‌کس آن‌ها را غلط نمی‌خواند.
 * - «هنوزم، بازم» ← «هنوز هم، باز هم» («هم» هجا کم نمی‌کند؛ ص ۲۶)
 * - «بفرمایین، می‌کنین» ← «بفرمایید، می‌کنید» (دوم شخص جمع را کامل بنویسید؛ ص ۱۹)
 * - «خارجن، دزدن» ← «خارج‌اند، دزدند» (ص ۴۰–۴۱)
 * - «خالهم، تهش» ← «خاله‌م، ته‌ش» (شکل «خاله» حفظ شود؛ ص ۲۱ و ۴۲)
 * - «می‌خورن، می‌گن» ← «می‌خورند، می‌گند» (دال آخر خودبه‌خود تلفظ نمی‌شود؛ ص ۱۹، ۴۲)
 * - «رفته‌ان» ← «رفته‌اند» (ص ۲۰)
 * - «اومدم» ← «آمدم» (ماضی «آمدن» و «رفتن» هجا از دست نمی‌دهد؛ ص ۱۷)
 * - «دکترا، کتابا» ← «دکترها، کتاب‌ها» (نشانۀ جمع را نباید شکست؛ ص ۲۲)
 * - «بخونمش، می‌دونم، موند» ← «بخوانمش، می‌دانم، ماند» (خواندن، دانستن، ماندن… هجا از
 *   دست نمی‌دهند؛ ص ۱۹ و ۳۰). «می‌تونم» درست است، چون یک هجا کم می‌شود.
 *
 * Since 1.5.1, a replacement that changes the writer's letters («اومدم» ← «آمدم»، «خانما» ←
 * «خانم‌ها»، «یه» ← «یک») is the writer's choice, never in «درست‌کن»: the writer may keep the
 * dialogue as it is said. Since 1.6.0 it is a recommendation (blue, «پیشنهاد»; yellow in 1.5.1),
 * «رو» before a noun also offers «روی», and no verb is «completed» into a word that is not one
 * («می‌گن» ← «می‌گند»، «میشن» ← «میش‌اند»، «واقعن» ← «واقع‌اند»). One that only adds the half-space
 * and keeps the letters («خالهم» ← «خاله‌م»، «تهش» ← «ته‌ش») is the spelling of the spoken form: red.
 */
import { createPatternRule } from "../../../textlint-rule-preset-farhangestan/src/util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../../../textlint-rule-preset-farhangestan/src/util/persian";
import { KNOWN } from "../../../textlint-rule-preset-farhangestan/src/util/words";
import { isPresentStem, verbForm, isParticiple } from "../../../textlint-rule-preset-farhangestan/src/rules/mi-prefix";
import { endsWithSilentHe } from "../../../textlint-rule-preset-farhangestan/src/util/words";
import hazmAdjectives from "../../../textlint-rule-preset-farhangestan/src/dict/hazm-adjectives.json";
import commonNouns from "../../../textlint-rule-preset-farhangestan/src/dict/hazm-common-nouns.json";
import { corpusBucket } from "../../../textlint-rule-preset-farhangestan/src/util/speller";
import arabic from "../../../textlint-rule-preset-farhangestan/src/dict/arabic.json";
import type { PatternCheck } from "../../../textlint-rule-preset-farhangestan/src/util/pattern-rule";

/** Two common words run together («ماقبلا» = «ما قبلا»): not one word with an ending (1.5.0). */
function twoWords(w: string): boolean {
    for (let i = 2; i <= w.length - 3; i++) if ((corpusBucket(w.slice(0, i)) ?? -1) >= 9 && (corpusBucket(w.slice(i)) ?? -1) >= 9) return true;
    return false;
}
/** A preposition run into a short word: «ازتو» = «از تو». */
const prepAndWord = (w: string) => /^(از|با|به|که|در|تو)/.test(w) && (corpusBucket(w.replace(/^(از|با|به|که|در|تو)/, "")) ?? -1) >= 9;

/** The book's tanvin words written without it («اصلا»، «حتما»): not «اصل» + plural «ا» (lexicon's). */
const TANVIN_BARE = new Set<string>(arabic.entries.filter((e) => e.to.endsWith("اً")).flatMap((e) => e.from));

const ADJECTIVES = new Set<string>(hazmAdjectives.adjectives);
const COMMON_NOUNS = new Set<string>(commonNouns.words);

const BOOK = "اصول شکسته‌نویسی";

/** [broken, full, page] */
const SAME_SYLLABLES: Array<[string, string, string]> = [
    ["نون", "نان", "۱۳"], ["جون", "جان", "۱۳"], ["میدون", "میدان", "۱۳"], ["کدوم", "کدام", "۱۳"],
    ["همون", "همان", "۱۴"], ["زبون", "زبان", "۱۴"], ["جوون", "جوان", "۱۴"], ["روون", "روان", "۱۴"],
    ["دووم", "دوام", "۱۴"], ["رون", "ران", "۱۴"], ["دیگه", "دیگر", "۱۴"], ["اگه", "اگر", "۱۴"],
    ["مث", "مثل", "۱۴"], ["وخ", "وقت", "۲۸"], ["خونه", "خانه", "۴۵"], ["لونه", "لانه", "۸"],
    ["گرون", "گران", "۴۵"], ["نادون", "نادان", "۴۵"], ["قندون", "قندان", "۴۵"], ["لیوون", "لیوان", "۴۵"],
    ["حیوون", "حیوان", "۴۵"], ["ایوون", "ایوان", "۴۵"], ["جوونه", "جوانه", "۴۵"], ["کمونه", "کمانه", "۴۵"],
    ["شبونه", "شبانه", "۴۵"], ["روونه", "روانه", "۴۵"], ["زمونه", "زمانه", "۴۵"], ["پیمونه", "پیمانه", "۴۵"],
    ["آشیونه", "آشیانه", "۴۵"], ["اصفهون", "اصفهان", "۴۵"], ["کرمون", "کرمان", "۱۳"], ["رفسنجون", "رفسنجان", "۴۵"],
    ["لویزون", "لویزان", "۴۵"], ["تهرون", "تهران", "۱۲"], ["همدون", "همدان", "۱۳"], ["خیابون", "خیابان", "۱۱"],
    ["آسمون", "آسمان", "۱۴"], ["بارون", "باران", "۱۴"], ["ارزون", "ارزان", "۱۴"], ["سوهون", "سوهان", "۱۲"],
    ["نیس", "نیست", "۲۴"], ["هس", "هست", "۴۱"], ["ماس", "ماست", "۹"], ["گف", "گفت", "۱۴"], ["رف", "رفت", "۱۴"],
    ["یه", "یک", "۴۲"], ["منو", "من را", "۲۷"], ["اینو", "این را", "۲۵"],
    ["تش", "ته‌ش", "۴۲"],
    ["هنوزم", "هنوز هم", "۲۶"], ["بازم", "باز هم", "۲۶"],
    ["اومدم", "آمدم", "۱۷"], ["اومدی", "آمدی", "۱۷"], ["اومد", "آمد", "۱۷"], ["اومدیم", "آمدیم", "۱۷"],
    ["اومدید", "آمدید", "۱۷"], ["اومدن", "آمدند", "۱۷"], ["اومدند", "آمدند", "۱۷"], ["اومده", "آمده", "۱۷"]
];
// a word ending in «ه» also appears with the ezafe sign: «خونۀ خاله» → «خانۀ خاله»
for (const [b, f, p] of [...SAME_SYLLABLES]) {
    if (b.endsWith("ه") && f.endsWith("ه")) SAME_SYLLABLES.push([b.slice(0, -1) + "ۀ", f.slice(0, -1) + "ۀ", p]);
}
const MAP = new Map(SAME_SYLLABLES.map(([b, f, p]) => [b, { full: f, page: p }]));

/** Spoken past stems that keep their syllable count, so they should be written in full. */
const SPOKEN_PAST: Record<string, string> = {
    "خوند": "خواند", "موند": "ماند", "رسوند": "رساند", "کشوند": "کشاند", "ترسوند": "ترساند",
    "سوزوند": "سوزاند", "پوشوند": "پوشاند", "چرخوند": "چرخاند", "خوابوند": "خواباند", "دونست": "دانست",
    "رسوندید": "رساندید"
};

/**
 * Present stems as people say them, besides Hazm's list, whose written plural is the spoken stem +
 * «ند» («می‌تونن» → «می‌تونند»، «می‌ذارن» → «می‌ذارند»). Not «گ، ر، ش، د، آ، خوا» (1.6.0): «می‌گند»،
 * «می‌رند»، «می‌شند»، «می‌دند»، «می‌آند»، «می‌خواند» are not words (the written forms are «می‌گویند،
 * می‌روند…», another verb form, not the spoken one kept in full).
 */
const SPOKEN_STEMS = new Set(["تون", "ذار", "کن", "خور", "خواب"]);

/** Letters only, without the half-space. */
const letters = (s: string) => s.replace(/‌/g, "");
/**
 * A replacement that writes the spoken word in another form (the formal one, or the book's
 * fuller one) is the writer's choice: in dialogue it is not an error, a recommendation (blue,
 * since 1.6.0; yellow in 1.5.1). Only the half-space added: red (1.5.1).
 */
const choiceUnlessSpelling = ({ pattern, check }: PatternCheck): PatternCheck => ({
    pattern,
    check: (m) => {
        const r = check(m);
        if (!r || r.replacement === undefined) return r;
        const from = m[0].slice(r.start ?? 0, r.end ?? m[0].length);
        if (r.fix !== false && letters(from) === letters(r.replacement)) return r;
        return { ...r, fix: false, kind: "suggestion" };
    }
});
/** «ارزو»، «ادما»: a word whose «آ» was left out, not a spoken form (typing-shortcuts' «آ»). */
const maddLeftOut = (w: string) => w.startsWith("ا") && KNOWN.has("آ" + w.slice(1)) && !KNOWN.has(w);
/** «بدنیا» = «به دنیا»، «بخونه» = «به خونه»: «به» run into a common word. */
const beRunIn = (w: string) => w.startsWith("ب") && !w.startsWith("به") && (corpusBucket(w.slice(1)) ?? -1) >= 9 && !KNOWN.has(w);
/** Tanvin written with «ن» («واقعن»، «اصلن»): the lexicon's «واقعاً»، never «واقع‌اند» (1.6.0). */
const TANVIN_N = new Set<string>(arabic.entries.filter((e) => e.to.endsWith("اً")).flatMap((e) => e.from).filter((f) => f.endsWith("ن")));

export default createPatternRule(() => ({
    source: BOOK,
    checks: ([
        {
            // the word may continue after a ZWNJ («خونه‌ی»، «خونه‌ها»)
            pattern: new RegExp(`${START}(${[...MAP.keys()].sort((a, b) => b.length - a.length).join("|")})(?=${ZWNJ}|${END})`, "g"),
            check: (m) => {
                const e = MAP.get(m[0])!;
                return {
                    message: `«${m[0]}» در گفتار هم همان‌قدر هجا دارد؛ کامل بنویسید تا شکسته خوانده شود: «${e.full}»`,
                    replacement: e.full,
                    source: `${BOOK}، ص ${e.page}`
                };
            }
        },
        {
            // «می‌خورن» → «می‌خورند»، «نمی‌تونن» → «نمی‌تونند»، «باشن» → «باشند»
            pattern: new RegExp(`${START}((?:ن?می${ZWNJ}?)?)(${LETTER}+?)ن${END}`, "g"),
            check: (m) => {
                const [, mi, stem] = m;
                // «نیستن، هستن» → «نیستند، هستند» (1.6.0: not «نیست‌اند»)
                if (!mi && (stem === "نیست" || stem === "هست")) {
                    return { message: `«ند» را کامل بنویسید: «${stem}ند»`, replacement: stem + "ند", source: `${BOOK}، ص ۴۰–۴۱` };
                }
                const isVerb = (mi && (isPresentStem(stem) || SPOKEN_STEMS.has(stem))) || stem === "باش";
                if (!isVerb) return null;
                const fixed = (mi ? mi.replace(/^(ن?می)(?!‌)/, "$1‌") : "") + stem + "ند";
                return {
                    message: `دال آخر در گفتار خودبه‌خود نرم ادا می‌شود؛ «ند» را نگه دارید: «${fixed}»`,
                    replacement: fixed,
                    source: `${BOOK}، ص ۱۹ و ۴۲`
                };
            }
        },
        {
            // «رفته‌ان» → «رفته‌اند»
            pattern: new RegExp(`${START}(${LETTER}+ه)[${ZWNJ} ]?ان${END}`, "g"),
            check: (m) => {
                if (KNOWN.has(m[0]) || KNOWN.has(m[0].replace(/[‌ ]/g, ""))) return null;
                if (!KNOWN.has(m[1])) return null;
                const fixed = m[1] + ZWNJ + "اند";
                return { message: `«${fixed}» را کامل بنویسید`, replacement: fixed, source: `${BOOK}، ص ۲۰` };
            }
        },
        {
            // «کتابو» → «کتاب را» (را را نباید به «و» تبدیل کرد)
            pattern: new RegExp(`${START}(${LETTER}{2,})و${END}`, "g"),
            check: (m) => {
                const word = m[0];
                const stem = m[1];
                if (KNOWN.has(word) || !KNOWN.has(stem) || prepAndWord(word) || MAP.has(word)) return null; // «ازتو» = «از تو»; «منو»: the list's
                // «هارو»، «کتابارو»: «ها/ا» + «رو» run together, not «هار» + «را»; «ارزو» is «آرزو» (1.6.0)
                if (/(ها|ا)رو$/.test(word) || maddLeftOut(word) || beRunIn(word)) return null;
                if ("اوی".includes(stem[stem.length - 1])) return null; // «دریا رو»: here «را» keeps its «ر» anyway
                // «روشو» is «رویش را» as much as «روش را»: a stem that is also a word ending in a vowel + a pronoun
                if (/[شتم]$/.test(stem) && /[اوی]$/.test(stem.slice(0, -1)) && KNOWN.has(stem.slice(0, -1))) return null;
                return {
                    message: `«را» را کامل بنویسید: «${stem} را»`,
                    replacement: `${stem} را`,
                    source: `${BOOK}، ص ۲۵`
                };
            }
        },
        {
            // «دکترا، کتابا» → «دکترها، کتاب‌ها»
            pattern: new RegExp(`${START}(${LETTER}{2,})ا${END}`, "g"),
            check: (m) => {
                const stem = m[1];
                // «بیا» is a verb, not «بی» + «ا»: short stems are too ambiguous
                if (KNOWN.has(m[0]) || !KNOWN.has(stem) || stem.endsWith("ه") || stem.length < 3 || twoWords(m[0]) || TANVIN_BARE.has(m[0])) return null;
                // «انصافا»: a tanvin left out («انصافاً»), not «انصاف» + «ها», nor a name («روزا»): a word the
                // corpus has as it is (1.6.1)
                if (KNOWN.has(m[0] + "ً") || (corpusBucket(m[0]) ?? -1) >= 7) return null;
                if (maddLeftOut(m[0]) || beRunIn(m[0])) return null; // «ادما» = «آدما»، «بدنیا» = «به دنیا» (1.6.0)
                const fixed = "اآدذرزژو".includes(stem[stem.length - 1]) ? stem + "ها" : stem + ZWNJ + "ها";
                return {
                    message: `نشانۀ جمع را کامل بنویسید؛ «${fixed}» خودبه‌خود «${m[0]}» خوانده می‌شود`,
                    replacement: fixed,
                    source: `${BOOK}، ص ۲۲`
                };
            }
        },
        {
            // present with a prefix: «بخونمش، می‌دونم، نمی‌خونه» → «بخوانمش، می‌دانم، نمی‌خواند».
            // «-ون» stands for «-ان» (دان) or «-وان» (خوان); a bare form («خونی») is left alone.
            pattern: new RegExp(`${START}(ن?می${ZWNJ}?|ب|ن)(${LETTER}*?)ون(م|ی|ه|یم|ید|ند|ن)(ش|ت|م|شان|تان|مان)?${END}`, "g"),
            check: (m) => {
                const [, prefix, head, ending, pronoun = ""] = m;
                // «تون» (توان) loses a syllable in speech, so «می‌تونم» is a correct broken form
                if (isPresentStem(head + "ون") || SPOKEN_STEMS.has(head + "ون")) return null;
                const formal = [head + "ان", head + "وان"].find(isPresentStem);
                if (!formal) return null;
                const end = ({ ه: "د", ن: "ند" } as Record<string, string>)[ending] ?? ending; // «می‌دونه» → «می‌داند»
                const fixed = prefix.replace(/^(ن?می)(?!‌)/, "$1‌") + formal + end + pronoun;
                return {
                    message: `این فعل در گفتار هجا از دست نمی‌دهد؛ کامل بنویسید: «${fixed}»`,
                    replacement: fixed,
                    source: `${BOOK}، ص ۱۹ و ۳۰`
                };
            }
        },
        {
            // past, from a closed list (a pattern would also catch «روند»): «موند، خوندم» → «ماند، خواندم»
            pattern: new RegExp(`${START}(ن?)(${Object.keys(SPOKEN_PAST).join("|")})(م|ی|یم|ید|ند|ن|ه)?${END}`, "g"),
            check: (m) => {
                const [, neg, stem, ending = ""] = m;
                const fixed = neg + SPOKEN_PAST[stem] + (ending === "ن" ? "ند" : ending);
                // «دونستن» is also the infinitive «دانستن»: both, to choose
                if (ending === "ن") {
                    // after a preposition («با خوندن مطالب»، «برای خوندن») the infinitive first (1.6.1)
                    const prev = m.input.slice(0, m.index).match(/([\p{L}‌]+)\s+$/u)?.[1] ?? "";
                    const infinitive = neg + SPOKEN_PAST[stem] + "ن";
                    const infFirst = /^(با|از|به|برای|واسه|بعد|قبل|موقع|حین|مشغول)$/.test(prev);
                    return {
                        message: `ماضی یا مصدر این فعل در گفتار هجا از دست نمی‌دهد؛ کامل بنویسید: «${fixed}» یا «${infinitive}»`,
                        replacement: infFirst ? infinitive : fixed,
                        alternatives: [infFirst ? fixed : infinitive],
                        fix: false,
                        source: `${BOOK}، ص ۱۹ و ۳۰`
                    };
                }
                return {
                    message: `ماضی این فعل در گفتار هجا از دست نمی‌دهد؛ کامل بنویسید: «${fixed}»`,
                    replacement: fixed,
                    source: `${BOOK}، ص ۱۹ و ۳۰`
                };
            }
        },
        {
            // 2nd person plural: «بفرمایین، می‌کنین، بنویسین» → «بفرمایید…» (ص ۱۹)
            pattern: new RegExp(`${START}(ن?می${ZWNJ}?|ب|ن)(${LETTER}+?)ین${END}`, "g"),
            check: (m) => {
                const [, prefix, stem] = m;
                if (!isPresentStem(stem) || KNOWN.has(m[0])) return null;
                const fixed = (prefix.startsWith("می") || prefix.startsWith("نمی") ? prefix.replace(/^(ن?می)(?!‌)/, "$1‌") : prefix) + stem + "ید";
                return {
                    message: `دوم شخص جمع را کامل بنویسید: «${fixed}»`,
                    replacement: fixed,
                    source: `${BOOK}، ص ۱۹`
                };
            }
        },
        {
            // copula «-ن» after a noun or adjective: «خارجن» → «خارج‌اند»، «دزدن» → «دزدند» (ص ۴۰–۴۱)
            pattern: new RegExp(`${START}(${LETTER}{2,})ن${END}`, "g"),
            check: (m) => {
                const stem = m[1];
                // «حفظ کنن» is «کنند», a verb: not «کن» + «اند»
                if (KNOWN.has(m[0]) || verbForm(m[0]) || isPresentStem(stem) || !(ADJECTIVES.has(stem) || COMMON_NOUNS.has(stem))) return null;
                // «میشن»، «میخوان»: a spoken verb, not «میش» + «اند»; «واقعن»: the tanvin; «نیستن»: «نیستند» (1.6.0)
                // «بتونن»، «نرن»: a subjunctive, not «بتون» + «اند»
                if (/^[بن]/.test(m[0]) && (isPresentStem(stem.slice(1)) || /^(تون|گ|ش|ذار|ر|د|خوا|دون|خون)$/.test(stem.slice(1)))) return null;
                if (/^ن?می/.test(m[0]) || stem === "نیست" || stem === "هست" || TANVIN_N.has(m[0]) || maddLeftOut(m[0]) || beRunIn(m[0])) return null;
                if (stem.endsWith("ه") || stem.endsWith("ا") || stem.endsWith("و") || stem.endsWith("ی")) return null;
                const fixed = "اآدذرزژو".includes(stem[stem.length - 1]) ? stem + "ند" : stem + ZWNJ + "اند";
                return { message: `«اند» را کامل بنویسید: «${fixed}»`, replacement: fixed, source: `${BOOK}، ص ۴۰–۴۱` };
            }
        },
        {
            // «خالهم، تهش» → «خاله‌م، ته‌ش»: the word keeps its shape (ص ۲۱ و ۴۲)
            pattern: new RegExp(`${START}(${LETTER}+ه)(م|ت|ش)${END}`, "g"),
            check: (m) => {
                const stem = m[1];
                if (KNOWN.has(m[0]) || !KNOWN.has(stem) || !endsWithSilentHe(stem)) return null;
                const fixed = stem + ZWNJ + m[2];
                return { message: `شکل کلمه حفظ شود: «${fixed}»`, replacement: fixed, source: `${BOOK}، ص ۲۱ و ۴۲` };
            }
        },
        {
            // ambiguous: report only. Since 1.6.1 only «صب» (not a word): «رو» (را، روی، رو) and «اون، اونو» (آن، او)
            // are what every spoken sentence is made of, and a card on each, with two readings to pick from, was
            // a third of all the blue cards in the blog study (5,000 per 8,000 paragraphs); the other spoken
            // words keep their one clear written form («یه» ← «یک»، «خونه» ← «خانه»)
            pattern: new RegExp(`${START}(صب)${END}`, "g"),
            check: (m) => {
                const hints: Record<string, string> = {
                    "اونو": "«آن را» یا «او را»",
                    "اون": "«آن» یا «او» (برای «او» صورت شکسته لازم نیست؛ ص ۲۹)",
                    "رو": "اگر «را»ست، «را» بنویسید (ص ۲۵)",
                    "صب": "اگر «صبر» است، کامل بنویسید (ص ۴۲)؛ اگر «صبح» است، «صبح»"
                };
                const choices: Record<string, string[]> = { "اونو": ["آن را", "او را"], "اون": ["آن", "او"], "رو": ["را"], "صب": ["صبر", "صبح"] };
                // «تا صب»، «ساعت ۸ صب»: «صبح» (1.6.0)
                if (m[1] === "صب" && /(?:^|\s)(تا|از|هر|امروز|فردا|دیروز|ساعت|[0-9۰-۹]+)\s+$/.test(m.input.slice(Math.max(0, m.index - 12), m.index))) choices.صب = ["صبح", "صبر"];
                // about one «رو» in ten is «روی» (1.6.0): before a noun («رو میز»), «روی» as a second answer,
                // first at the start of a sentence or after a preposition or a verb («نشست رو صندلی»)
                if (m[1] === "رو") {
                    const next = m.input.slice(m.index + 2).match(/^ +([\p{L}‌]+)/u)?.[1] ?? "";
                    const prev = m.input.slice(0, m.index).match(/([\p{L}‌]+) +$/u)?.[1] ?? "";
                    // not after a pronoun («ما رو»، «اون رو»: the object) nor before a participle («رو برآورده»)
                    const pronounBefore = /^(من|تو|او|ما|شما|اون|این|اونا|اینا|آن|آنها|ایشون|خودم|خودت|خودش|همه|همشون)$/.test(prev);
                    if (next && COMMON_NOUNS.has(next) && !verbForm(next) && !isParticiple(next) && !pronounBefore) {
                        const roy = !prev || /^(و|از|به|تو|که|برو|بذار|بذارش|بشین|نشست|افتاد|گذاشت|گذاشتم|بود|هست|نشستم)$/.test(prev) || !!verbForm(prev);
                        choices.رو = roy ? ["روی", "را"] : ["را", "روی"];
                    }
                }
                const [first, ...rest] = choices[m[1]];
                const hint = rest.includes("روی") || first === "روی" ? "اگر «را»ست، «را» بنویسید (ص ۲۵)؛ اگر «روی» است، «روی»" : hints[m[1]];
                return { message: hint, replacement: first, alternatives: rest, fix: false, source: BOOK };
            }
        }
    ] as PatternCheck[]).map(choiceUnlessSpelling)
}));
