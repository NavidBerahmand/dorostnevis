/*
 * نوشتار شتاب‌زده (1.5.2): what chat-style typing leaves out.
 *
 * - «ک» و «ب» تنها میان دو کلمه، به جای «که» و «به»: «کاری ک ادما میتونن»، «بسپار ب خدا». در
 *   جملۀ گفتاری قطعی (قرمز)؛ در جملۀ نوشتاری پیشنهاد (زرد)، چون آن‌جا «ک» و «ب» نام حرف یا
 *   شمارۀ بند هم هستند («حرف ک»، «بند ب»، «الف و ب»، «ب.ظ»).
 * - «ی» تنها پس از کلمه‌ای که به حرف بی‌صدا ختم می‌شود، به جای «یه/یک»: «ی ادم» (زرد، «یه» اول در
 *   جملۀ گفتاری و «یک» در نوشتاری). «خانه ی من» (کسرۀ اضافه) قاعدۀ «کسرۀ اضافه» است.
 * - «اگ» به جای «اگه/اگر» (زرد).
 * - «ک» چسبیده به آخر کلمۀ شناخته‌شده پیش از جمله‌واره: «همونقدرک لبخند» ← «همونقدر که» (زرد).
 * - «آ»ی افتاده: «ادم»، «ادما»، «ازارش»، «اینده» ← «آدم»، «آدما»، «آزارش»، «آینده»: فهرست بستۀ
 *   کلمه‌هایی که فقط با «آ» رایج‌اند و شکل «ا»یشان کلمه نیست (dict/alef-madd.json).
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../util/persian";
import { isKnown, isDictionaryWord } from "../util/words";
import { registerSegments, spokenAt, spoken } from "../util/colloquial";
import alef from "../dict/alef-madd.json";

const SOURCE = "قراردادهای رایج نوشتار (در دستور خط نیامده)";
const ALEF = new Set<string>((alef as { words: string }).words.split(" "));
/** Endings a word may carry after the missing «آ»: «ادما»، «ادمها»، «ازارش»، «امدند». */
const ENDINGS = ["", "ها", "های", "هایی", "ا", "ی", "ای", "م", "ت", "ش", "مان", "تان", "شان", "مون", "تون", "شون", "ند", "ید", "یم", "ن", "ین", "ه", "هایش", "هام", "هات", "هاش"];

/** Words «که» follows and «ک» is glued to in chat typing: «همونقدرک»، «وقتیک». */
const CLAUSE_HEADS = new Set([
    "همونقدر", "همینقدر", "اونقدر", "اینقدر", "انقدر", "همانقدر", "آنقدر", "اینطور", "اونطور", "همونطور", "همینطور",
    "طوری", "جوری", "وقتی", "کسی", "چیزی", "جایی", "یعنی", "مگه", "همونجا", "همینجا", "اونجا", "اینجا", "درحالی", "بطوری", "بهطوری"
]);
/** Words before a letter's name or a list item: «حرف ک»، «بند ب»، «الف و ب». */
const LETTER_CONTEXT = new Set(["یعنی", "حرف", "حروف", "نویسه", "بند", "ردیف", "گروه", "تبصره", "قسمت", "بخش", "مورد", "الف", "پ", "ت", "ج", "د", "حرفِ"]);
const spokenHere = (text: string, index: number) => spokenAt(registerSegments(text), index);

/** The words around index (same line), letters only. */
function around(text: string, start: number, end: number): [string, string] {
    const prev = text.slice(0, start).match(/(?:^|[^\p{L}‌])([\p{L}‌]+) $/u)?.[1] ?? "";
    const next = text.slice(end).match(/^ ([\p{L}‌]+)(?:$|[^\p{L}‌])/u)?.[1] ?? "";
    return [prev, next];
}

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            // «کاری ک ادما»، «بسپار ب خدا»: a word on both sides, not a letter's name or a list item
            pattern: new RegExp(`${START}(ک|ب)${END}`, "g"),
            check: (m) => {
                const [prev, next] = around(m.input, m.index, m.index + 1);
                if (!prev || !next || LETTER_CONTEXT.has(prev) || LETTER_CONTEXT.has(next) || next === "و" || prev === "و" && next.length <= 2) return null;
                if (next.length === 1 || next === "به" || next === "که") return null;
                if (prev.length <= 2 && next.length <= 2) return null; // letters spelled out: «ای ک جی» // «ک ر ی ن» spelled out; «دربند ب به»
                const full = m[1] === "ک" ? "که" : "به";
                const spoken = spokenHere(m.input, m.index);
                return { message: `«${m[1]}» به جای «${full}»: «${full}» را کامل بنویسید`, replacement: full, fix: spoken ? undefined : false };
            }
        },
        {
            // «ی ادم»: «یه/یک»; not after a word in a vowel («خانه ی»، «دانشجو ی»: the ezafe or «ی» written apart)
            pattern: new RegExp(`${START}ی${END}`, "g"),
            check: (m) => {
                const [prev, next] = around(m.input, m.index, m.index + 1);
                // after a space only: «همه‏ی»، «پنجره-ی» are the ezafe or «ی» written apart
                if (m.index > 0 && m.input[m.index - 1] !== " ") return null;
                if (!next || next.length < 2 || LETTER_CONTEXT.has(prev) || /[اوهیۀءأ]$/.test(prev)) return null;
                if (prev && !/[\p{L}]$/u.test(prev)) return null;
                const spoken = spokenHere(m.input, m.index);
                const [first, second] = spoken ? ["یه", "یک"] : ["یک", "یه"];
                return { message: `«ی» به جای «${first}» (یا «${second}»)`, replacement: first, alternatives: [second], fix: false };
            }
        },
        {
            // «اگ درگیرش بشی»: «اگه/اگر»
            pattern: new RegExp(`${START}اگ${END}`, "g"),
            check: (m) => {
                const [, next] = around(m.input, m.index, m.index + 2);
                if (!next) return null;
                const spoken = spokenHere(m.input, m.index);
                const [first, second] = spoken ? ["اگه", "اگر"] : ["اگر", "اگه"];
                return { message: `«اگ» به جای «${first}» (یا «${second}»)`, replacement: first, alternatives: [second], fix: false };
            }
        },
        {
            // «همونقدرک لبخند»: «که» glued as «ک» to a word that introduces a clause (a closed list: «پارک»،
            // «مارک»، «کوچیک» are words of their own)
            pattern: new RegExp(`${START}(${[...CLAUSE_HEADS].join("|")})ک(?= ${LETTER})`, "g"),
            check: (m) => ({ message: `«ک» به جای «که»: «${m[1]} که»`, replacement: m[1] + " که", fix: false })
        },
        {
            // «ادم»، «ادما»، «ازارش» → «آدم»، «آدما»، «آزارش»
            pattern: new RegExp(`${START}ا(${LETTER}+)${END}`, "g"),
            check: (m) => {
                const word = m[0];
                if (isKnown(word) || isDictionaryWord(word)) return null;
                // «اینه»، «اونه»: «این است» in speech, not «آینه»; «ارزون»: a spoken word («ارزان»), not «آرزو» + «ن»
                if (word.endsWith("ه") && isKnown(word.slice(0, -1))) return null;
                if (spoken(word)) return null;
                // a known word with an ending («استانهای» = «استان» + «های»)
                if (ENDINGS.some((e) => e && word.endsWith(e) && isKnown(word.slice(0, -e.length)))) return null;
                for (const e of ENDINGS) {
                    if (e && !word.endsWith(e)) continue;
                    const stem = word.slice(0, word.length - e.length);
                    if (stem.length < 3 || !ALEF.has("آ" + stem.slice(1))) continue;
                    const fixed = "آ" + word.slice(1);
                    return { message: `«آ» با مد نوشته می‌شود: «${fixed}»`, replacement: "آ", end: 1, source: "فرهنگ املایی خطّ فارسی" };
                }
                return null;
            }
        }
    ]
}));
