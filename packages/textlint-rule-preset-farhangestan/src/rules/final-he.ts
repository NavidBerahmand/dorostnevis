/*
 * «ه»ی پایانی: ملفوظ یا غیرملفوظ
 *
 * ۱. «ه»ی ملفوظ (گره، فرمانده، مشابه، راه، دانشگاه) حرف است، نه نشانهٔ مصوّت؛
 *    هرچه به کلمه بپیوندد مثل پس از هر صامت دیگر به آن می‌چسبد
 *    (غلط ننویسیم، ابوالحسن نجفی، ص ۲۲۱، ۲۹۳، ۳۲۲، ۴۱۱؛ دستور خط هم در جدول
 *    یای نکره «گرهی» و در کسرهٔ اضافه «فرماندهِ سپاه، گرهِ کور» دارد، ص ۴۶–۴۷):
 *    - کسرهٔ اضافه «ۀ» یا «هٔ» نمی‌گیرد: «فرماندهٔ سپاه»، «فرماندۀ سپاه» ← «فرماندهِ سپاه»
 *    - یای نکره و «ـَم، ـَش، ـَت…» بی «ا» و بی نیم‌فاصله: «گره‌ای» ← «گرهی»،
 *      «مشابه‌اش» ← «مشابهش»، «مواجه‌ام» ← «مواجهم»
 *    کلمه‌ها از فهرست بستهٔ PRONOUNCED_HE_WORDS (src/util/words.ts) و کلمه‌های
 *    شناخته‌شدهٔ مختوم به «ـاه» است. «ـاند» و «ـمان، ـتان، ـشان» دست نمی‌خورند.
 *    «دانشگاه‌ای. اند ام.» (Texas A&M)، «دانشگاه‌ام آی تی» (MIT)، «آرامگاه‌ام کلثوم»:
 *    حرف‌های لاتین و نام‌ها کنار گذاشته می‌شوند.
 * ۲. جمع با «ـان» پس از «ه»ی غیرملفوظ: «ه» می‌افتد و «گ» می‌آید:
 *    «نماینده‌گان» ← «نمایندگان»، «دست‌نشانده‌گان» ← «دست‌نشاندگان»
 *    (غلط ننویسیم، ص ۱۳۷؛ دستور خط: «تشنگان، خفتگان»، ص ۶۶). «جزیره‌گان»
 *    (مجمع‌الجزایر، واژهٔ مصوّب فرهنگستان) جمع نیست و کنار می‌ماند. با فاصلهٔ
 *    کامل («نماینده گان») فقط پس از صفت فاعلی و مفعولی (ـنده، ـده، ـته)، چون
 *    نام‌های جایی مثل «کله گان» هم هست.
 */
import { createPatternRule, PatternResult } from "../util/pattern-rule";
import { END, LETTER, LETTER_RANGE, ZWNJ } from "../util/persian";
import { isKnown, endsWithSilentHe, PRONOUNCED_HE_WORDS } from "../util/words";
import hazmVerbs from "../dict/hazm-verbs.json";

/** «شده»، «رفته»: a past participle (past stem + «ه») */
const PAST_STEMS = new Set<string>(hazmVerbs.past);

const S = (page: string) => `غلط ننویسیم، ابوالحسن نجفی، ص ${page}`;
/** The book's own entry for a word; otherwise its general entry on the two «ه»s. */
const PAGE: Record<string, string> = {
    زره: "۲۲۱", فربه: "۲۹۲", فرمانده: "۲۹۳", گره: "۳۲۲", مرفه: "۳۴۵", مشابه: "۳۵۰", مواجه: "۳۷۲", واله: "۴۰۴"
};
const sourceFor = (word: string) => S(PAGE[word] ?? "۴۱۱");

/** No Persian letter before: the word starts here (a ZWNJ before it is fine: «دست‌فرمانده»). */
const WORD_START = `(?<![${LETTER_RANGE}])`;

/** A word whose final «ه» is pronounced: the closed list, or a known word in «ـاه». */
function pronounced(word: string): boolean {
    return PRONOUNCED_HE_WORDS.has(word) || (word.length >= 3 && word.endsWith("اه") && isKnown(word));
}

/** Words that never take the gan-plural this way. */
const NOT_GAN_PLURAL = new Set(["جزیره"]);

/** «دانشگاه‌ای. اند ام»، «دانشگاه‌ام آی تی»، «آرامگاه‌ام کلثوم»: Latin letters spelled out, or a name. */
const SPELLED_OUT = new RegExp(`^(?:[-‐–]|\\.?\\s*(?:آی|اند|ای|ام|کلثوم|آر|اس|تی)(?![${LETTER_RANGE}]))`);

export default createPatternRule(() => ({
    source: S("۴۱۱"),
    checks: [
        {
            // «فرماندهٔ»: ezafe hamza on a pronounced «ه»
            pattern: new RegExp(`${WORD_START}(${LETTER}+ه)ٔ(?![${LETTER_RANGE}])`, "g"),
            check: (m): PatternResult | null => {
                if (!pronounced(m[1])) return null;
                return {
                    message: `«ه»ی «${m[1]}» ملفوظ است و در حالت اضافه کسره می‌گیرد، نه «ۀ»: «${m[1]}ِ»`,
                    replacement: "ِ",
                    start: m[1].length,
                    source: sourceFor(m[1])
                };
            }
        },
        {
            // «فرماندۀ»: the same with the one-letter «ۀ»
            pattern: new RegExp(`${WORD_START}(${LETTER}+)ۀ(?![${LETTER_RANGE}])`, "g"),
            check: (m): PatternResult | null => {
                const word = m[1] + "ه";
                if (!pronounced(word)) return null;
                return {
                    message: `«ه»ی «${word}» ملفوظ است و در حالت اضافه کسره می‌گیرد، نه «ۀ»: «${word}ِ»`,
                    replacement: "هِ",
                    start: m[1].length,
                    source: sourceFor(word)
                };
            }
        },
        {
            // «گره‌ای»، «مشابه‌اش»، «مواجه‌ام»: joined like after any consonant
            pattern: new RegExp(`${WORD_START}(${LETTER}+ه)${ZWNJ}(ای|ام|اش|ات|ایم|اید)${END}`, "g"),
            check: (m): PatternResult | null => {
                if (!pronounced(m[1])) return null;
                if (SPELLED_OUT.test(m.input.slice(m.index + m[0].length))) return null;
                const fixed = m[1] + m[2].slice(1);
                return {
                    message: `«ه»ی «${m[1]}» ملفوظ است و «${m[2].slice(1)}» مثل پس از هر صامت دیگر بی «ا» و بی نیم‌فاصله به آن می‌چسبد: «${fixed}»`,
                    replacement: m[2].slice(1),
                    start: m[1].length,
                    source: sourceFor(m[1])
                };
            }
        },
        {
            // «نماینده‌گان»، «نماینده گان» → «نمایندگان»
            pattern: new RegExp(`${WORD_START}(${LETTER}{2,}ه)(${ZWNJ}| )گان${END}`, "g"),
            check: (m): PatternResult | null => {
                const stem = m[1];
                if (!endsWithSilentHe(stem) || !(isKnown(stem) || PAST_STEMS.has(stem.slice(0, -1))) || NOT_GAN_PLURAL.has(stem)) return null;
                if (m[2] === " " && !/(نده|ده|ته)$/.test(stem)) return null;
                const fixed = stem.slice(0, -1) + "گان";
                return {
                    message: `در جمع با «ـان»، «ه»ی غیرملفوظ می‌افتد و «گ» می‌آید: «${fixed}»`,
                    replacement: fixed,
                    source: S("۱۳۷")
                };
            }
        }
    ]
}));
