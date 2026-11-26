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
    /** the 2nd edition of دستور خط overrides the farhang's form */
    book?: boolean;
}


// «انگلیسی زبان» ← «انگلیسی‌زبان»: the farhang has «انگلیسی‌زبان» (ص ۷۸)، «فارسی‌زبان» (ص ۴۶۵)،
// «آذری‌زبان» (ص ۳۵); other languages by the same pattern. «X زبان» is also «X» + «زبان»
// («زبان فارسی زبان رسمی است»), so only «X زبانان» and «X زبان» after a plural or a
// people-noun («کشورهای انگلیسی زبان»، «مردم فارسی زبان») are taken.
const LANG_PAGE: Record<string, number> = { انگلیسی: 78, فارسی: 465, آذری: 35 };
const LANGS = [
    "انگلیسی", "فارسی", "آذری", "عربی", "ترکی", "فرانسوی", "آلمانی", "روسی", "اسپانیایی", "کردی", "ایتالیایی",
    "چینی", "ژاپنی", "پرتغالی", "هلندی", "ارمنی", "یونانی", "لاتین", "عبری", "هندی", "اردو", "پشتو", "بلوچی", "ترکمنی", "گرجی", "تاجیکی"
];
const PEOPLE = /(?:ها|های|مردم|جوامع|ملل|اقوام|جمعیت|جامعه|جامعهٔ|جامعۀ|کشور|مناطق|منطقه|منطقهٔ|منطقۀ|افراد|نویسندگان|شاعران|کاربران|خانواده|خانواده‌های)$/;
// «X زبان» of a language is left to the check below, which looks at the context
const ENTRIES = new Map<string, Entry>(
    (data.entries as Entry[]).filter((e) => !(e.spaced.endsWith(" زبان") && LANGS.includes(e.spaced.split(" ")[0]))).map((e) => [e.spaced, e])
);
const SUFFIX = "(?:ی|ها|های|ان|ات|ش|شان|ای|یی|م|ت|مان|تان)?";
const ALT = [...ENTRIES.keys()].sort((a, b) => b.length - a.length).map((s) => escapeRegExp(s).replace(/ /g, " +")).join("|");

export default createPatternRule(() => ({
    source: "فرهنگ املایی خطّ فارسی",
    checks: [
        {
            pattern: new RegExp(`${START}((?:غیر${ZWNJ}?)?(${LANGS.join("|")})) زبان(ان)?${END}`, "g"),
            check: (m) => {
                if (!m[3]) {
                    const prev = m.input.slice(0, m.index).trimEnd().split(/\s+/).pop() ?? "";
                    if (!PEOPLE.test(prev)) return null;
                }
                const page = LANG_PAGE[m[2]];
                return {
                    message: `«زبان» در این ترکیب صفت می‌سازد و با نیم‌فاصله نوشته می‌شود: «${m[1]}${ZWNJ}زبان${m[3] ?? ""}»`,
                    replacement: `${m[1]}${ZWNJ}زبان${m[3] ?? ""}`,
                    source: page
                        ? `فرهنگ املایی، ص ${toPersianDigits(page)}`
                        : `فرهنگ املایی، ص ${toPersianDigits(78)}، به قیاس «انگلیسی‌زبان»`
                };
            }
        },
        {
            pattern: new RegExp(`${START}(${ALT})(${SUFFIX})(?=${ZWNJ}|${END})`, "g"),
            check: (m) => {
                const e = ENTRIES.get(m[1].replace(/ +/g, " "));
                if (!e) return null;
                const how = e.to.includes(ZWNJ) ? "با نیم‌فاصله" : "پیوسته";
                return {
                    message: `این ترکیب یک کلمه است و ${how} نوشته می‌شود: «${e.to}»`,
                    replacement: e.to + m[2],
                    source: e.book
                        ? `دستور خط (ویراست جدید)؛ فرهنگ املایی، ص ${toPersianDigits(e.page)}، «${e.spaced.replace(" ", ZWNJ)}» دارد`
                        : `فرهنگ املایی، ص ${toPersianDigits(e.page)}`
                };
            }
        }
    ]
}));
