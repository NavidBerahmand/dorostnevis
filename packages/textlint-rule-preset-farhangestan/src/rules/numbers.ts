/*
 * عددها
 *
 * دستور خط، ترکیب‌ها، ب-۱۰ (ص ۶۵–۶۶):
 *   اعداد بدون واو: اجزای این اعداد با نیم‌فاصله/ بی‌فاصله نوشته می‌شود:
 *   یک‌صد، چهارصد، شش‌صد، هفت‌صد، هشت‌صد، دوهزار، یازده‌هزار، یک‌میلیون،
 *   صدمیلیارد — استثنا: نهصد
 *   اعداد واودار: اجزای این اعداد با فاصلۀ کامل نوشته می‌شود: بیست و یک …
 *   اعداد کسری: … با نیم‌فاصله/ بی‌فاصله: یک‌چهارم، دوپنجم، چهارششم، هفت‌دهم
 * و ترکیب‌ها، الف-۱-ب (ص ۵۹): پسوند «-گانه» با اعداد و «-اُم، -اُمی، -اُمین»
 *   با عدد سی: پنج‌گانه، ده‌گانه، سی‌ام، سی‌امی، سی‌امین
 * و ترکیب‌ها، الف-۴ (ص ۶۱): سیصد (پیوسته).
 *
 * - «دو هزار» ← «دوهزار»، «یک میلیون» ← «یک‌میلیون»، «نه صد» ← «نهصد»
 * - «یک چهارم» ← «یک‌چهارم» (کسر)
 * - «پنج گانه»، «پنجگانه» ← «پنج‌گانه»؛ «سی ام» ← «سی‌ام»
 * - «بیست و یک» (عدد واودار) دست نمی‌خورد.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, ZWNJ, joinWithHalfSpace } from "../util/persian";

const S_CARDINAL = "دستور خط، ترکیب‌ها، ب-۱۰، ص ۶۵";
const S_GANE = "دستور خط، ترکیب‌ها، الف-۱-ب، ص ۵۹";

const UNITS = ["یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "هیجده", "نوزده"];
const TENS = ["بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const NUMBER_WORDS = [...UNITS, ...TEENS, ...TENS, ...HUNDREDS];
const BIG = ["هزار", "میلیون", "میلیارد", "تریلیون"];
const ORDINAL_DENOMINATORS = ["دوم", "سوم", "چهارم", "پنجم", "ششم", "هفتم", "هشتم", "نهم", "دهم", "صدم", "هزارم"];

/** The book writes these joined (الف-۴ and ب-۱۰). */
const JOINED_HUNDREDS: Record<string, string> = { "نه": "نهصد", "سی": "سیصد", "سه": "سیصد" };

const NUM = `(${NUMBER_WORDS.sort((a, b) => b.length - a.length).join("|")}|[۰-۹0-9]+)`;

export default createPatternRule(() => ({
    source: S_CARDINAL,
    checks: [
        {
            // «نه صد» → «نهصد»، «سی صد» → «سیصد»
            pattern: new RegExp(`${START}(نه|سی|سه)[ ${ZWNJ}]صد${END}`, "g"),
            check: (m) => ({ message: `«${JOINED_HUNDREDS[m[1]]}» پیوسته نوشته می‌شود`, replacement: JOINED_HUNDREDS[m[1]] })
        },
        {
            // «یک صد»، «دو هزار»، «یک میلیون» → نیم‌فاصله/بی‌فاصله
            pattern: new RegExp(`${START}${NUM} +(صد|${BIG.join("|")})${END}`, "g"),
            check: (m) => {
                if (m[2] === "صد" && JOINED_HUNDREDS[m[1]]) return null; // handled above
                if (/^[۰-۹0-9]+$/.test(m[1])) return null; // «۲ هزار» is fine with a space
                const fixed = joinWithHalfSpace(m[1], m[2]);
                return { message: `اجزای عدد بدون «و» به هم می‌چسبند: «${fixed}»`, replacement: fixed };
            }
        },
        {
            // fractions: «یک چهارم» → «یک‌چهارم»
            pattern: new RegExp(`${START}(${UNITS.join("|")}|ده) +(${ORDINAL_DENOMINATORS.join("|")})${END}`, "g"),
            check: (m) => {
                const fixed = joinWithHalfSpace(m[1], m[2]);
                return { message: `اجزای عدد کسری به هم می‌چسبند: «${fixed}»`, replacement: fixed };
            }
        },
        {
            // «-گانه» with numbers: «پنج گانه»، «پنجگانه» → «پنج‌گانه»
            pattern: new RegExp(`${START}${NUM}[ ${ZWNJ}]?گانه${END}`, "g"),
            check: (m) => {
                const fixed = joinWithHalfSpace(m[1], "گانه");
                if (m[0] === fixed) return null;
                return { message: `«-گانه» با عدد، نیم‌فاصله می‌گیرد: «${fixed}»`, replacement: fixed, source: S_GANE };
            }
        },
        {
            // «سی ام»، «سی امین» → «سی‌ام»
            pattern: new RegExp(`${START}سی +(ام|امی|امین)${END}`, "g"),
            check: (m) => {
                const fixed = "سی" + ZWNJ + m[1];
                return { message: `«${fixed}» با نیم‌فاصله نوشته می‌شود`, replacement: fixed, source: S_GANE };
            }
        }
    ]
}));
