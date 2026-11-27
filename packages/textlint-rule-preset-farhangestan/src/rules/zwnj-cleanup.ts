/*
 * نیم‌فاصلۀ زائد
 *
 * دستور خط، قواعد کلّی، بند ۷ (فاصله‌گذاری در خطّ فارسی):
 *   ب) نیم‌فاصله: فاصلۀ میان اجزای ترکیب‌هایی است که حرف آخر اجزای پیشین
 *      آن‌ها قابلیّت اتّصال به حرف بعد را دارد…
 *   ج) بی‌فاصله: … جزء پیشین آن‌ها مختوم به حروف منفصلی است که قابلیّت
 *      اتّصال به جزء پس‌از خود را ندارند … و دیگر به درج نیم‌فاصله نیازی نیست.
 *
 * بنابراین:
 * - چند نیم‌فاصلۀ پشت سر هم ← یک نیم‌فاصله
 * - نیم‌فاصله کنار فاصله یا در آغاز/پایان کلمه ← حذف
 * - نیم‌فاصله پس از حرف منفصل (ا، د، ذ، ر، ز، ژ، و) ← حذف (بی‌فاصله)
 */
import { createPatternRule } from "../util/pattern-rule";
import { WORD_CHAR, ZWNJ } from "../util/persian";

const SOURCE = "دستور خط، قواعد کلّی، بند ۷: فاصله‌گذاری، ص ۲۲–۲۳";

/** Non-joining letters, without ۀ/ة/ء (ZWNJ after them is harmless but kept out of scope). */
const NON_JOINING_STRICT = "اآأإدذرزژو";

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            pattern: new RegExp(`${ZWNJ}{2,}`, "g"),
            check: () => ({ message: "چند نیم‌فاصلۀ پشت سر هم", replacement: ZWNJ })
        },
        {
            // ZWNJ that is not between two word characters
            pattern: new RegExp(`(?<!${WORD_CHAR})${ZWNJ}+|${ZWNJ}+(?!${WORD_CHAR})`, "g"),
            check: () => ({ message: "نیم‌فاصله در کنار فاصله یا نشانه", replacement: "" })
        },
        {
            pattern: new RegExp(`(?<=[${NON_JOINING_STRICT}])${ZWNJ}(?=${WORD_CHAR})`, "g"),
            check: () => ({
                message: "پس از حرف منفصل نیم‌فاصله لازم نیست (بی‌فاصله)",
                replacement: ""
            })
        }
    ]
}));
