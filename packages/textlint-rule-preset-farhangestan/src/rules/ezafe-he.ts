/*
 * کسرهٔ اضافه پس از «ه»ی غیرملفوظ
 *
 * دستور خط، «کسرۀ اضافه» (ص ۴۷):
 *   برای کلمه‌های مختوم به «ها»ی غیرملفوظ، در حالت اضافه، از علامت «ۀ/ ‍ۀ»
 *   استفاده می‌شود: برنامۀ روزانه، بندۀ خدا، به‌مثابۀ، خانۀ او، رانندۀ ماهر
 *   … کلمه‌های مختوم به «ها»ی ملفوظ، در حالت اضافه، کسره می‌گیرند:
 *   بازدهِ تولید، گرهِ کور، فرماندهِ سپاه
 *
 * - «خانه ی من»، «خانه‌ی من»، «خانه‌یِ من» ← «خانۀ من»
 * - «خانهٔ من» (ه + همزهٔ بالا U+0654) ← «خانۀ من» (U+06C0)، مگر با گزینهٔ
 *   { "style": "he-hamza" } که برعکس عمل می‌کند.
 *
 * «ه»ی ملفوظ (راه، کوه، فقیه، گره…) کنار گذاشته می‌شود: کلمه‌ای که پیش از
 * «ه» مصوّت بلند (ا، و، ی) دارد یا در فهرست زیر است.
 *
 * کسرهٔ اضافه‌ای که «ه» نوشته شده: «کتابه من» ← «کتاب من». کسرهٔ اضافه پس
 * از حرف بی‌صدا نوشته نمی‌شود (یا با ـِ نشان داده می‌شود). فقط وقتی که
 * «کتابه» خودش کلمهٔ شناخته‌شده‌ای نیست و «کتاب» هست:
 * - پیش از ضمیر (من، تو، او…) اصلاح خودکار؛
 * - پیش از کلمه‌های دیگر فقط پیشنهاد، و فقط در متن رسمی، چون در گفتار
 *   «کتابه» نشانهٔ معرفه هم هست («این کتابه خوبه»).
 * شکل‌های گفتاری مثل «خونه» (خانه) و «نشونه» (نشانه) کنار گذاشته می‌شوند.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../util/persian";
import { isKnown } from "../util/words";

export interface Options {
    /** "he-yeh" → ۀ (U+06C0, the book's form); "he-hamza" → هٔ (ه + U+0654). */
    style?: "he-yeh" | "he-hamza";
    /** false in story dialogue, where «کتابه» may be the definite marker. Default true. */
    formal?: boolean;
}

const SOURCE = "دستور خط، «کسرۀ اضافه»، ص ۴۷";

/** Short words ending in a pronounced «ه» (ملفوظ). */
const PRONOUNCED_HE = new Set([
    "به", "مه", "ده", "ره", "شه", "که", "گره", "زره", "بزه", "فربه", "توجه", "متوجه",
    "منزه", "مشتبه", "مشبه", "تنبه", "متنبه", "فرمانده", "بازده", "سپهبد"
]);

function isPronouncedHe(word: string): boolean {
    if (PRONOUNCED_HE.has(word)) return true;
    const before = word[word.length - 2];
    // long vowel before ه → pronounced: راه، کوه، فقیه، شبیه، گناه
    return before === "ا" || before === "و" || before === "ی" || before === "آ";
}

const PRONOUNS = new Set([
    "من", "تو", "او", "ما", "شما", "آنها", "آن‌ها", "ایشان", "اون", "اونا", "اونها", "اون‌ها",
    "خودم", "خودت", "خودش", "خودمان", "خودتان", "خودشان", "خودمون", "خودتون", "خودشون"
]);
/** Words after which «Xه» is more likely the definite marker or copula than an ezafe. */
const NOT_EZAFE_NEXT = new Set([
    "که", "را", "رو", "و", "هم", "از", "به", "با", "در", "تا", "یا", "اگه", "اگر", "چی", "کو",
    "است", "هست", "نیست", "بود", "شد", "می", "نمی", "خیلی", "دیگه", "دیگر", "اینجا", "اونجا"
]);

/** «کتابه» written for «کتابِ»: the stem, if this is that mistake. */
function ezafeWrittenAsHe(word: string): string | null {
    const stem = word.slice(0, -1);
    if (stem.length < 2 || isKnown(word) || !isKnown(stem)) return null;
    if ("اآوهة".includes(stem[stem.length - 1])) return null;
    // spoken forms of known words: «خونه» (خانه)، «نشونه» (نشانه)
    const i = word.lastIndexOf("ون");
    if (i >= 0 && isKnown(word.slice(0, i) + "ان" + word.slice(i + 2))) return null;
    return stem;
}

export default createPatternRule<Options>((options) => {
    const target = options.style === "he-hamza" ? "هٔ" : "ۀ";
    return {
        source: SOURCE,
        checks: [
            {
                // word ending in ه + (space|ZWNJ) + ی (optionally with kasra) as a separate token
                pattern: new RegExp(`${START}(${LETTER}*ه)[ ${ZWNJ}]ی\\u0650?${END}`, "g"),
                check: (m) => {
                    if (isPronouncedHe(m[1])) return null;
                    return {
                        message: `نشانهٔ اضافه پس از «ه»ی غیرملفوظ «${target}» است، نه «ی» جدا`,
                        replacement: m[1].slice(0, -1) + target
                    };
                }
            },
            {
                // «کتابه من»: the next word is looked at but not consumed
                pattern: new RegExp(`${START}(${LETTER}{3,}ه)(?= (${LETTER}+)${END})`, "g"),
                check: (m) => {
                    const stem = ezafeWrittenAsHe(m[1]);
                    if (!stem) return null;
                    const next = m[2];
                    const pronoun = PRONOUNS.has(next);
                    if (!pronoun && (options.formal === false || NOT_EZAFE_NEXT.has(next) || !isKnown(next))) return null;
                    return {
                        message: `کسرهٔ اضافه با «ه» نوشته نمی‌شود؛ باید «${stem} ${next}» (یا «${stem}ِ ${next}») نوشته شود`,
                        replacement: stem,
                        fix: pronoun ? undefined : false
                    };
                }
            },
            {
                pattern: options.style === "he-hamza" ? /ۀ/g : /هٔ/g,
                check: () => ({ message: `شکل یکدستِ نشانهٔ اضافه «${target}» است`, replacement: target })
            }
        ]
    };
});
