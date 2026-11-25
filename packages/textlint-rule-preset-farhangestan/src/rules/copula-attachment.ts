/*
 * ام، ای، ایم، اید، اند و ضمیرهای ـَم، ـَت، ـَش پس از «ه» و «ی»
 *
 * دستور خط، «مجموعۀ ام، ای، است، ایم، اید، اند» (ص ۴۲) و «ضمایر ملکی و
 * مفعولی» (ص ۴۴):
 *   خسته‌ام، خسته‌ای، خسته است، خسته‌ایم، خسته‌اید، خسته‌اند
 *   ایرانی‌ام، ایرانی‌ای، ایرانی است/ ایرانی‌ست، ایرانی‌ایم، ایرانی‌اید، ایرانی‌اند
 *   خانه‌ام، خانه‌ات، خانه‌اش؛ کشتی‌ام، کشتی‌ات، کشتی‌اش
 *
 * - «خسته ام» (فاصلهٔ کامل) ← «خسته‌ام»
 * - «است» عمداً گرفته نمی‌شود: «خسته است» با فاصله درست است.
 * - «ای» پس از کلمهٔ مختوم به «ی» گرفته نمی‌شود، چون ممکن است «ای»ِ ندا
 *   باشد («گفتی ای دوست»).
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../util/persian";

const SOURCE = "دستور خط، «مجموعۀ ام، ای، است…» ص ۴۲ و «ضمایر ملکی» ص ۴۴";

const AFTER_HE = "ام|ای|ایم|اید|اند|ات|اش";
const AFTER_YEH = "ام|ایم|اید|اند|ات|اش";

/** Short words whose final «ه» is pronounced: «کوه ام» is not «کوه‌ام». */
function isPronouncedHe(word: string): boolean {
    const before = word[word.length - 2];
    return before === "ا" || before === "و" || before === "ی" || before === "آ" || word.length <= 2;
}

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            pattern: new RegExp(`${START}(${LETTER}+ه) +(${AFTER_HE})${END}`, "g"),
            check: (m) => {
                if (isPronouncedHe(m[1])) return null;
                return {
                    message: `«${m[2]}» پس از «ه»ی غیرملفوظ با نیم‌فاصله نوشته می‌شود`,
                    replacement: m[1] + ZWNJ + m[2]
                };
            }
        },
        {
            pattern: new RegExp(`${START}(${LETTER}+ی) +(${AFTER_YEH})${END}`, "g"),
            check: (m) => ({
                message: `«${m[2]}» پس از کلمهٔ مختوم به «ی» با نیم‌فاصله نوشته می‌شود`,
                replacement: m[1] + ZWNJ + m[2]
            })
        }
    ]
}));
