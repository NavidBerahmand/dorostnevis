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
 * - «بی X» (فاصلهٔ کامل) ← «بی‌X»، مگر وقتی X نشانهٔ حرف اضافه بودن «بی» است
 *   (هیچ، این، آن، ضمیرها، حروف اضافه و ربط…).
 * - استثناهای فهرست بسته ← پیوسته. سه استثنایی که معنایشان در کتاب قید شده
 *   (بیجا، بیخود، بیهوش) خودکار اصلاح نمی‌شوند، چون «بی‌هوش» و «بی‌خود»
 *   در معنای دیگر درست‌اند.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, WORD, ZWNJ } from "../util/persian";

const SOURCE = "دستور خط، «بی»، ص ۳۹";

/** Closed exception list whose meaning is unambiguous → always joined. */
export const JOINED_EXCEPTIONS = ["بیچاره", "بیداد", "بیدل", "بیراه", "بیزار", "بیعار", "بیکار", "بینوا"];

/** Words after which «بی» is most likely the preposition, not the prefix. */
const PREPOSITION_FOLLOWERS = new Set([
    "هیچ", "این", "آن", "اینکه", "آنکه", "اینها", "آنها", "این‌ها", "آن‌ها",
    "من", "تو", "او", "ما", "شما", "ایشان", "وی", "همه", "هر", "یک", "چند",
    "در", "با", "از", "به", "را", "و", "که", "تا", "یا", "نیز", "هم"
]);

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
            pattern: new RegExp(`${START}بی +(${WORD})`, "g"),
            check: (m) => {
                const next = m[1];
                if (PREPOSITION_FOLLOWERS.has(next)) return null;
                if (JOINED_EXCEPTIONS.includes("بی" + next)) return null; // handled above
                return {
                    message: `پیشوند «بی» با نیم‌فاصله نوشته می‌شود: «بی${ZWNJ}${next}»`,
                    replacement: "بی" + ZWNJ,
                    end: m[0].length - next.length
                };
            }
        }
    ]
}));
