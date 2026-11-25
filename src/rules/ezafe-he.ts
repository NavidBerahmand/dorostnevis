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
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../util/persian";

export interface Options {
    /** "he-yeh" → ۀ (U+06C0, the book's form); "he-hamza" → هٔ (ه + U+0654). */
    style?: "he-yeh" | "he-hamza";
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
                pattern: options.style === "he-hamza" ? /ۀ/g : /هٔ/g,
                check: () => ({ message: `شکل یکدستِ نشانهٔ اضافه «${target}» است`, replacement: target })
            }
        ]
    };
});
