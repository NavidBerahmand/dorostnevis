/*
 * بی-
 *
 * دستور خط، «بی» (ص ۳۹):
 *   بی- در نقش پیشوند نفی همیشه با نیم‌فاصله از کلمۀ پس‌از خود نوشته می‌شود:
 *   بی‌تردید، بی‌توجّه، بی‌حاصل، بی‌حساب، بی‌حوصله، بی‌جهت، بی‌چون‌وچرا، بی‌قرار
 *   استثنا: بیجا (بیهوده)، بیچاره، بیخود (بیهوده)، بیداد، بیدل، بیراه، بیزار،
 *   بیعار، بیکار، بینوا، بیهوش (غیرهشیار)
 *   تبصره: بی در نقش حرف اضافه همیشه با فاصلۀ کامل از کلمۀ پس‌از خود نوشته
 *   می‌شود: بی هیچ چشمداشتی کار کرد.
 *
 * - «بی X» (فاصلۀ کامل) ← «بی‌X»، مگر وقتی X نشانۀ حرف اضافه بودن «بی» است
 *   (هیچ، این، آن، ضمیرها، حروف اضافه و ربط…).
 * - استثناهای فهرست بسته ← پیوسته. سه استثنایی که معنایشان در کتاب قید شده
 *   (بیجا، بیخود، بیهوش) خودکار اصلاح نمی‌شوند، چون «بی‌هوش» و «بی‌خود»
 *   در معنای دیگر درست‌اند.
 * - «بیدلیل» (پیوسته) ← «بی‌دلیل»، فقط وقتی واژه‌نامۀ Hazm شکل پیوسته را
 *   نمی‌شناسد و شکل جدا را می‌شناسد. «بیمار»، «بیرون»، «بیگانه» دست نمی‌خورند.
 *   استثناهای کتاب بر داده‌های Hazm مقدّم‌اند (Hazm «بی‌هوش» و «بی‌عار» دارد).
 */
import { otherReading, homographMessage } from "../util/homograph";
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, WORD, ZWNJ } from "../util/persian";
import hazmBi from "../dict/hazm-bi.json";
import { isKnown } from "../util/words";

const SOURCE = "دستور خط، «بی»، ص ۳۹";

/** Closed exception list whose meaning is unambiguous → always joined. */
export const JOINED_EXCEPTIONS = ["بیچاره", "بیداد", "بیدل", "بیراه", "بیزار", "بیعار", "بیکار", "بینوا"];

/** Every exception in the book, including the three whose sense is noted: never separated. */
const ALL_EXCEPTIONS = new Set([...JOINED_EXCEPTIONS, "بیجا", "بیخود", "بیهوش"]);

const JOINED_TO_SEPARATED: Record<string, string> = hazmBi.pairs;

/** Words after which «بی» is most likely the preposition, not the prefix. */
const PREPOSITION_FOLLOWERS = new Set([
    "هیچ", "این", "آن", "اینکه", "آنکه", "اینها", "آنها", "این‌ها", "آن‌ها",
    "من", "تو", "او", "ما", "شما", "ایشان", "وی", "همه", "هر", "یک", "چند",
    "در", "با", "از", "به", "را", "و", "که", "تا", "یا", "نیز", "هم"
]);

/**
 * A plural in «ات» of a known word: «مشکلات» (مشکل)، «تبعات» (تبعه)، «جزئیات» (جزئی)، «تحصیلات» (تحصیل). Not «ثبات»،
 * «کربنات»، «مبالات»: the word without «ات» is no word, or «بی‌» + the whole is a word (the farhang, Hazm).
 */
function arabicPlural(word: string): boolean {
    if (!word.endsWith("ات") || word.length < 5) return false;
    if (isKnown("بی" + ZWNJ + word) || isKnown("بی" + word) || JOINED_TO_SEPARATED["بی" + word]) return false;
    const stem = word.slice(0, -2);
    return [stem, stem + "ه", stem + "ی", stem.replace(/ی$/, "")].some((w) => w.length >= 2 && isKnown(w) && !isKnown("بی" + ZWNJ + w + "ات"));
}

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            // exception written separately: «بی کار» / «بی‌کار» → «بیکار»
            pattern: new RegExp(`${START}بی[ ${ZWNJ}](${JOINED_EXCEPTIONS.map((w) => w.slice(2)).join("|")})${END}`, "g"),
            check: (m) => ({
                message: `«بی${m[1]}» از استثناهای قاعده است و پیوسته نوشته می‌شود`,
                replacement: "بی" + m[1]
            })
        },
        {
            // joined: «بیدلیل» → «بی‌دلیل»
            pattern: new RegExp(`${START}بی${LETTER}+(?=${ZWNJ}|${END})`, "g"),
            check: (m) => {
                const separated = JOINED_TO_SEPARATED[m[0]];
                if (!separated || ALL_EXCEPTIONS.has(m[0])) return null;
                // «بینشان»: also «بین» + «شان»
                const other = otherReading(m[0], separated);
                if (other) return { message: homographMessage(m[0], separated, other), replacement: separated, alternatives: [m[0]], fix: false };
                return {
                    message: `پیشوند «بی» با نیم‌فاصله نوشته می‌شود: «${separated}»`,
                    replacement: separated
                };
            }
        },
        {
            pattern: new RegExp(`${START}بی +(${WORD})`, "g"),
            check: (m) => {
                const next = m[1];
                if (PREPOSITION_FOLLOWERS.has(next)) return null;
                if (JOINED_EXCEPTIONS.includes("بی" + next)) return null; // handled above
                // «بی مشکلات»، «بی تبعات»، «بی جزئیات» (1.6.7): before a plural in «ات» «بی» is the preposition (the
                // book's تبصره: apart). The prefix makes adjectives, and an adjective in «بی‌» never takes «ات»
                // («بی‌گناهان»، «بی‌سوادها» do). Not a word that ends so by itself («بی ثبات»، «بی کربنات»).
                if (arabicPlural(next)) return null;
                return {
                    message: `پیشوند «بی» با نیم‌فاصله نوشته می‌شود: «بی${ZWNJ}${next}»`,
                    replacement: "بی" + ZWNJ,
                    end: m[0].length - next.length
                };
            }
        }
    ]
}));
