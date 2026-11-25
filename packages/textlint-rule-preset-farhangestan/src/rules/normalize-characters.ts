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
 * - «ی» + همزهٔ بالا (یٔ) ← «ئ»
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
    "ھ": "ه", // ھ
    "ے": "ی", // ے Urdu yeh barree
    "ۍ": "ی", // ۍ Pashto yeh
    "ڪ": "ک", // ڪ swash kaf
    "ۃ": "ة" // ۃ teh marbuta goal
};

/** Map a presentation-form character to its base letter(s) via NFKC. */
function basePresentationForm(ch: string): string {
    const base = ch.normalize("NFKC");
    return base
        .split("")
        .map((c) => ARABIC_TO_PERSIAN[c] ?? c)
        .join("");
}

/** What each foreign letter is, for the message. */
const FOREIGN: Record<string, string> = {
    "ي": "حرف عربی",
    "ى": "حرف عربی (الف مقصوره)",
    "ك": "حرف عربی",
    "ہ": "حرف اردو",
    "ە": "حرف کردی",
    "ھ": "حرف عربی (هاء دوچشم)",
    "ے": "حرف اردو",
    "ۍ": "حرف پشتو",
    "ڪ": "شکل دیگری از «ک»",
    "ۃ": "حرف اردو"
};

export default createPatternRule<Options>((options) => {
    const checks = [
        {
            pattern: /[يىكہەھےۍڪۃ]/g,
            check: (m: RegExpExecArray) => ({
                message: `«${m[0]}» ${FOREIGN[m[0]]} است؛ باید «${ARABIC_TO_PERSIAN[m[0]]}» فارسی نوشته شود`,
                replacement: ARABIC_TO_PERSIAN[m[0]]
            })
        },
        {
            pattern: /[ﭐ-﷿ﹰ-ﻼ]/g,
            check: (m: RegExpExecArray) => {
                const base = basePresentationForm(m[0]);
                if (base === m[0]) return null;
                return {
                    message: `«${m[0]}» شکل نمایشیِ حرف است و در جست‌وجو پیدا نمی‌شود؛ باید «${base}» نوشته شود`,
                    replacement: base
                };
            }
        },
        {
            pattern: new RegExp(`(?<=${LETTER})\\u0640+(?=${LETTER})`, "g"),
            check: () => ({ message: "کشیده (ـ) در میان کلمه آمده است؛ باید حذف شود", replacement: "" })
        },
        {
            // the same diacritic twice: «لطفاًً»
            pattern: /([\u064B-\u0652])\1+/g,
            check: (m: RegExpExecArray) => ({ message: "یک نشانه دو بار آمده است؛ یکی کافی است", replacement: m[1] })
        },
        {
            // soft hyphen (U+00AD) between letters, from Word: «حرف­ها»
            pattern: new RegExp(`(?<=${LETTER})\\u00AD+(?=${LETTER})`, "g"),
            check: () => ({ message: "اینجا «خط تیرهٔ نرم» آمده است؛ باید نیم‌فاصله باشد", replacement: ZWNJ })
        },
        {
            pattern: new RegExp(`(?<=${LETTER})[\\u200E\\u200F]+(?=${LETTER})`, "g"),
            check: (m: RegExpExecArray) => ({
                message: `اینجا ${visible(m[0])} آمده است که در بسیاری از نرم‌افزارها حروف دو طرفش را به هم می‌چسباند؛ باید نیم‌فاصله باشد`,
                replacement: ZWNJ
            })
        }
    ];
    checks.push({
        pattern: /[\u06CC\u064A]\u0654/g,
        check: () => ({ message: "«ی» و همزه جدا تایپ شده است؛ باید «ئ» نوشته شود", replacement: "ئ" })
    });
    if (options.digits !== false) {
        checks.push({
            pattern: /[٠-٩]/g,
            check: (m: RegExpExecArray) => {
                const persian = String.fromCharCode(m[0].charCodeAt(0) - 0x0660 + 0x06f0);
                return { message: `«${m[0]}» رقم عربی است؛ باید رقم فارسی «${persian}» نوشته شود`, replacement: persian };
            }
        });
    }
    return { source: SOURCE, checks };
});
