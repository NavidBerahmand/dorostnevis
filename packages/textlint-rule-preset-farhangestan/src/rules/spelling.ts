/*
 * غلط تایپی (خارج از دستور خط)
 *
 * کلمه‌ای که در واژه‌نامه نیست و یک کلمهٔ پرکاربرد با یک حرف تفاوت به آن
 * نزدیک است: «طایقه» ← «طایفه»، «منثره» ← «منظره»؛ یا دو کلمهٔ چسبیده:
 * «درکانادا» ← «در کانادا». فقط پیشنهاد، بدون اصلاح خودکار: نام‌های خاص و
 * کلمه‌های تازه هم در واژه‌نامه نیستند. واژه‌نامه: شکل‌هایی که دست‌کم سه
 * بار در ویکی‌پدیای فارسی آمده‌اند، به‌اضافهٔ Hazm و فرهنگ املایی
 * (scripts/spelling/).
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../util/persian";
import { spellingSuggestions } from "../util/speller";

const SOURCE = "غلط‌یاب (واژه‌نامهٔ ساخته‌شده از ویکی‌پدیای فارسی؛ در دستور خط نیامده)";

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            // a Persian word not touching Latin letters or digits («Windows۱۰»، «ATMها»)
            pattern: new RegExp(`(?<![A-Za-z0-9۰-۹])${START}${LETTER}[${"\\u0621-\\u063A\\u0641-\\u064A\\u0671-\\u06D3\\u06CC\\u06A9\\u06AF\\u067E\\u0686\\u0698"}${ZWNJ}]{2,}${END}(?![A-Za-z0-9۰-۹])`, "g"),
            check: (m) => {
                // the same unknown word twice in a paragraph is a name or a term, not a typo
                if (m.input.split(m[0]).length > 2) return null;
                const s = spellingSuggestions(m[0]);
                if (!s) return null;
                const others = s.slice(1).map((x) => `«${x}»`).join("، ");
                return {
                    message: `«${m[0]}» در واژه‌نامه نیست؛ شاید «${s[0]}»${others ? ` (یا ${others})` : ""}`,
                    replacement: s[0],
                    fix: false
                };
            }
        }
    ]
}));
