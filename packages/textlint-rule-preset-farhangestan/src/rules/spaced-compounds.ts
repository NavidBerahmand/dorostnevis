/*
 * ترکیب‌های فاصله‌دار: «جامعه شناس» ← «جامعه‌شناس»
 *
 * فرهنگ املایی این ترکیب‌ها را با نیم‌فاصله آورده است. فهرست از آن میان
 * فقط ترکیب‌هایی را دارد که در ویکی‌پدیای فارسی تقریباً همیشه یکجا نوشته
 * می‌شوند (دست‌کم ۵۰ بار؛ با فاصله حداکثر ۲۰٪؛ کسرهٔ اضافه کمتر از ۱٪)، تا
 * «X Y» به معنای دو کلمهٔ جدا در آن نیاید. ساخته‌شده با scripts/lists.
 * پسوند پیوسته پس از جزء دوم هم پذیرفته است: «رئیس جمهوری»، «جمع آوری‌ها».
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, ZWNJ, escapeRegExp, toPersianDigits } from "../util/persian";
import data from "../dict/spaced-compounds.json";

interface Entry {
    spaced: string;
    to: string;
    page: number;
}
const ENTRIES = new Map<string, Entry>((data.entries as Entry[]).map((e) => [e.spaced, e]));
const SUFFIX = "(?:ی|ها|های|ان|ات|ش|شان|ای|یی|م|ت|مان|تان)?";
const ALT = [...ENTRIES.keys()].sort((a, b) => b.length - a.length).map((s) => escapeRegExp(s).replace(/ /g, " +")).join("|");

export default createPatternRule(() => ({
    source: "فرهنگ املایی خطّ فارسی",
    checks: [
        {
            pattern: new RegExp(`${START}(${ALT})(${SUFFIX})(?=${ZWNJ}|${END})`, "g"),
            check: (m) => {
                const e = ENTRIES.get(m[1].replace(/ +/g, " "));
                if (!e) return null;
                return {
                    message: `این ترکیب یک کلمه است و با نیم‌فاصله نوشته می‌شود: «${e.to}»`,
                    replacement: e.to + m[2],
                    source: `فرهنگ املایی، ص ${toPersianDigits(e.page)}`
                };
            }
        }
    ]
}));
