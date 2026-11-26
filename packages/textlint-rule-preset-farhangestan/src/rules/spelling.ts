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
import { gozarCorrection } from "./gozar";
import { MISSPELLED } from "./misspellings";
import { FARHANG, FARHANG_OVERRIDES } from "../util/words";
import { verbForm } from "./mi-prefix";
import compounds from "../dict/compounds.json";
import hamza from "../dict/hamza.json";
import arabic from "../dict/arabic.json";
import multiSpelling from "../dict/multi-spelling.json";

/** The book's lists, wrong form → right form: a suggestion is offered in its right form. */
const LISTED = new Map<string, string>(
    [compounds, hamza, arabic, multiSpelling].flatMap((d) => (d.entries as Array<{ from: string[]; to: string; fix?: boolean }>).filter((e) => e.fix !== false).flatMap((e) => e.from.map((f) => [f, e.to] as [string, string])))
);
const NUMBER = /^(یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده|بیست|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود|صد|یکصد|دویست|سیصد|چهارصد|پانصد|ششصد|هفتصد|هشتصد|نهصد|هزار|میلیون|میلیارد)$/;
/** A suggestion as the other rules want it written («زبانشناس» → «زبان‌شناس»، «میرود» → «می‌رود»); null: not one to offer. */
function written(s: string): string | null {
    // «هشتاد هزار»: the numbers rule joins the parts of a number
    if (s.includes(" ") && s.split(" ").every((p) => NUMBER.test(p))) return null;
    const listed = LISTED.get(s);
    if (listed) return listed;
    const key = s.replace(new RegExp(ZWNJ, "g"), "");
    const f = FARHANG_OVERRIDES[key] ?? FARHANG[key]?.[0];
    if (f && f.replace(new RegExp(ZWNJ, "g"), "") === key) return f.replace(/ۀ/g, "هٔ");
    const mi = s.match(/^(ن?می)([^\u200c].+)$/);
    if (mi && verbForm(mi[2])) return mi[1] + ZWNJ + mi[2];
    return s;
}

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
                // the gozar and misspellings rules correct these with the book's page
                if (gozarCorrection(m[0]) || MISSPELLED.has(m[0])) return null;
                const raw = spellingSuggestions(m[0]);
                const s = raw ? [...new Set(raw.map(written).filter((x): x is string => !!x && x !== m[0]))] : null;
                if (!s || !s.length) return null;
                const others = s.slice(1).map((x) => `«${x}»`).join("، ");
                return {
                    message: `«${m[0]}» در واژه‌نامه نیست؛ شاید «${s[0]}»${others ? ` (یا ${others})` : ""}`,
                    replacement: s[0],
                    alternatives: s.slice(1),
                    fix: false
                };
            }
        }
    ]
}));
