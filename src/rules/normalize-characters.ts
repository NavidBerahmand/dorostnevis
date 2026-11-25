/*
 * یکدست‌سازی نویسه‌ها
 *
 * این قاعده در دستور خط به‌صورت یک بند جدا نیامده، ولی پیش‌شرط همهٔ قواعد
 * دیگر است: جدول ۱ و ۲ («نشانه‌های خطّ فارسی») فقط نشانه‌های فارسی را
 * فهرست می‌کند. نویسه‌های عربی، شکل‌های نمایشی، کشیده و نویسه‌های جهت‌نما
 * در میان کلمه، متن را برای جست‌وجو و پردازش خراب می‌کنند.
 *
 * - «ي» و «ى» عربی ← «ی» فارسی؛ «ك» عربی ← «ک» فارسی
 * - شکل‌های نمایشی (U+FB50–U+FDFF، U+FE70–U+FEFF) ← نویسهٔ پایه
 * - کشیده (ـ) میان حروف ← حذف
 * - RLM/LRM میان دو حرف (به‌جای نیم‌فاصله) ← نیم‌فاصله
 * - ارقام عربی (٠–٩) ← ارقام فارسی (۰–۹)
 */
import { createPatternRule, visible } from "../util/pattern-rule";
import { LETTER, ZWNJ } from "../util/persian";

export interface Options {
    /** Convert Arabic-Indic digits to Persian digits. Default: true. */
    digits?: boolean;
}

const SOURCE = "یکدست‌سازی نویسه‌ها، دستور خط: جدول ۱ و ۲";

const ARABIC_TO_PERSIAN: Record<string, string> = {
    "ي": "ی", // ي
    "ى": "ی", // ى
    "ك": "ک", // ك
    "ہ": "ه", // ہ
    "ە": "ه", // ە
    "ھ": "ه" // ھ
};

/** Map a presentation-form character to its base letter(s) via NFKC. */
function basePresentationForm(ch: string): string {
    const base = ch.normalize("NFKC");
    return base
        .split("")
        .map((c) => ARABIC_TO_PERSIAN[c] ?? c)
        .join("");
}

export default createPatternRule<Options>((options) => {
    const checks = [
        {
            pattern: /[يىكہەھ]/g,
            check: (m: RegExpExecArray) => ({
                message: `نویسهٔ عربی «${m[0]}» به‌جای «${ARABIC_TO_PERSIAN[m[0]]}» فارسی`,
                replacement: ARABIC_TO_PERSIAN[m[0]]
            })
        },
        {
            pattern: /[ﭐ-﷿ﹰ-ﻼ]/g,
            check: (m: RegExpExecArray) => {
                const base = basePresentationForm(m[0]);
                if (base === m[0]) return null;
                return {
                    message: `شکل نمایشی «${m[0]}» به‌جای نویسهٔ پایه «${base}»`,
                    replacement: base
                };
            }
        },
        {
            pattern: new RegExp(`(?<=${LETTER})\\u0640+(?=${LETTER})`, "g"),
            check: () => ({ message: "کشیده (ـ) در میان کلمه", replacement: "" })
        },
        {
            pattern: new RegExp(`(?<=${LETTER})[\\u200E\\u200F]+(?=${LETTER})`, "g"),
            check: (m: RegExpExecArray) => ({
                message: `${visible(m[0])} به‌جای نیم‌فاصله؛ در بسیاری از نرم‌افزارها حروف دو طرف به هم می‌چسبند`,
                replacement: ZWNJ
            })
        }
    ];
    if (options.digits !== false) {
        checks.push({
            pattern: /[٠-٩]/g,
            check: (m: RegExpExecArray) => {
                const persian = String.fromCharCode(m[0].charCodeAt(0) - 0x0660 + 0x06f0);
                return { message: `رقم عربی «${m[0]}» به‌جای رقم فارسی «${persian}»`, replacement: persian };
            }
        });
    }
    return { source: SOURCE, checks };
});
