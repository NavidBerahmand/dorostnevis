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
 * - «بهت، بهش، بهشون» ← «به‌ات، به‌اش، به‌شون» («به» شکل خود را نگه می‌دارد؛ ص ۲۱–۲۲)
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
 * «خانم‌ها»، «یه» ← «یک») is a suggestion (yellow, with its button, never in «درست‌کن»): the
 * writer may keep the dialogue as it is said. One that only adds the half-space and keeps the
 * letters («خالهم» ← «خاله‌م»، «بهشون» ← «به‌شون») is the spelling of the spoken form: red.
 */
import { createPatternRule } from "../../../textlint-rule-preset-farhangestan/src/util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../../../textlint-rule-preset-farhangestan/src/util/persian";
import { KNOWN } from "../../../textlint-rule-preset-farhangestan/src/util/words";
import { isPresentStem, verbForm } from "../../../textlint-rule-preset-farhangestan/src/rules/mi-prefix";
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
    ["بهت", "به‌ات", "۲۱"], ["بهش", "به‌اش", "۲۱"], ["بهاش", "به‌اش", "۲۱"], ["بهات", "به‌ات", "۲۱"],
    ["بهشون", "به‌شون", "۲۲"], ["بهتون", "به‌تون", "۲۲"], ["تش", "ته‌ش", "۴۲"],
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

/** Present stems as people say them («می‌گن» from گفتن), besides Hazm's list. */
const SPOKEN_STEMS = new Set(["گ", "ر", "آ", "ش", "د", "تون", "خوا", "ذار", "زار", "کن", "خور", "خواب"]);

/** Letters only, without the half-space. */
const letters = (s: string) => s.replace(/‌/g, "");
/**
 * A replacement that writes the spoken word in another form (the formal one, or the book's
 * fuller one) is the writer's choice: yellow. Only the half-space added: red (1.5.1).
 */
const choiceUnlessSpelling = ({ pattern, check }: PatternCheck): PatternCheck => ({
    pattern,
    check: (m) => {
        const r = check(m);
        if (!r || r.fix === false || r.replacement === undefined) return r;
        const from = m[0].slice(r.start ?? 0, r.end ?? m[0].length);
        return letters(from) === letters(r.replacement) ? r : { ...r, fix: false };
    }
});

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
                if (KNOWN.has(word) || !KNOWN.has(stem) || prepAndWord(word)) return null; // «ازتو» = «از تو»
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
                    return {
                        message: `ماضی یا مصدر این فعل در گفتار هجا از دست نمی‌دهد؛ کامل بنویسید: «${fixed}» یا «${neg + SPOKEN_PAST[stem]}ن»`,
                        replacement: fixed,
                        alternatives: [neg + SPOKEN_PAST[stem] + "ن"],
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
            // ambiguous: report only
            pattern: new RegExp(`${START}(اونو|اون|رو|صب)${END}`, "g"),
            check: (m) => {
                const hints: Record<string, string> = {
                    "اونو": "«آن را» یا «او را»",
                    "اون": "«آن» یا «او» (برای «او» صورت شکسته لازم نیست؛ ص ۲۹)",
                    "رو": "اگر «را»ست، «را» بنویسید (ص ۲۵)",
                    "صب": "اگر «صبر» است، کامل بنویسید (ص ۴۲)"
                };
                const choices: Record<string, string[]> = { "اونو": ["آن را", "او را"], "اون": ["آن", "او"], "رو": ["را"], "صب": ["صبر"] };
                const [first, ...rest] = choices[m[1]];
                return { message: hints[m[1]], replacement: first, alternatives: rest, fix: false, source: BOOK };
            }
        }
    ] as PatternCheck[]).map(choiceUnlessSpelling)
}));
