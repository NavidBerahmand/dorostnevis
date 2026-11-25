/*
 * حشو (پیشنهاد)
 *
 * - «بازگشت مجدد / دوباره»، «مجدداً / دوباره بازگشت» ← «بازگشت»
 * - «تکرار مجدد / دوباره»، «مجدداً / دوباره تکرار» ← «تکرار»
 * - «سایر … دیگر» ← «سایر …»
 * - «پیشرفت رو به جلو» ← «پیشرفت»
 *
 * «بر روی» عمداً نیامده: غلط نیست و گزارشش بیشتر مزاحمت است تا کمک.
 */
import { createPatternRule, START, END, SOURCE } from "../shared";

const AGAIN = "(?:مجدد|مجدداً|مجددا|دوباره)";

export default createPatternRule(() => ({
    source: SOURCE("حشو"),
    checks: [
        {
            // «بازگشت مجدد»، «تکرار دوباره»
            pattern: new RegExp(`${START}(بازگشت|تکرار)(?:[‌ ]?(?:ها|های))? ${AGAIN}${END}`, "g"),
            check: (m) => {
                const to = m[0].replace(new RegExp(` ${AGAIN}$`), "");
                return { message: `«${m[1]}» خود معنای دوباره دارد: «${to}»`, replacement: to };
            }
        },
        {
            // «مجدداً بازگشت»، «دوباره تکرار کرد»
            pattern: new RegExp(`${START}(?:مجدداً|مجددا|دوباره) (بازگشت|تکرار)`, "g"),
            check: (m) => ({ message: `«${m[1]}» خود معنای دوباره دارد: «${m[1]}»`, replacement: m[1] })
        },
        {
            // «سایر کشورهای دیگر» ← «سایر کشورها»؛ تا سه کلمه فاصله
            pattern: new RegExp(`${START}سایر((?: [^\\s.،؛!?؟]+){1,3}) دیگر${END}`, "g"),
            check: (m) => {
                // «سایر کشورها و دیگر نهادها»: two lists, not a redundancy
                if (/ (?:و|یا|نیز|هم)(?= |$)/.test(m[1])) return null;
                const to = `سایر${m[1]}`;
                return { message: `اگر «دیگر» اینجا همان «سایر» است (نه «دیگر» به معنای «از این پس»)، یکی کافی است: «${to}»`, replacement: to };
            }
        },
        {
            pattern: new RegExp(`${START}پیشرفت رو به جلو${END}`, "g"),
            check: () => ({ message: "پیشرفت همیشه رو به جلوست: «پیشرفت»", replacement: "پیشرفت" })
        }
    ]
}));
