/*
 * «سوء»، «ضدّ»، «غیر» پیش از کلمه
 *
 * دستور خط، «فاصله‌گذاری پیشوندها و پیشوندواره‌ها»، بند ۱ (ص ۳۶–۳۷):
 *   ترکیب‌های ساخته‌شده با پیشوندواره‌های مختوم به کسره که امکان اتّصال به
 *   جزء پس‌از خود را ندارند بی‌فاصله نوشته می‌شوند: سوءِ، ضدِّ، غیرِ —
 *   سوءِاستفاده، ضدِّزنگ، غیرِاصولی
 *
 * - «سوء استفاده» ← «سوءاستفاده»، «غیر قانونی» ← «غیرقانونی»، «ضد زنگ» ← «ضدزنگ»
 * - «غیر» و «ضد» حرف اضافه یا اسم هم هستند: «غیر از این»، «بر ضد او»، «ضد
 *   آن» دست نمی‌خورند.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, WORD } from "../util/persian";

const SOURCE = "دستور خط، «پیشوندها»، بند ۱، ص ۳۷";

/** After these, «غیر/ضد» is not a prefix. */
const NOT_A_PREFIX_BEFORE = new Set([
    "از", "این", "آن", "او", "من", "تو", "ما", "شما", "ایشان", "آنها", "آن‌ها", "اینها", "این‌ها",
    "وی", "خود", "خودش", "همه", "هر", "یک", "و", "که", "را", "با", "در", "به"
]);
const NOT_A_PREFIX_AFTER = new Set(["بر", "به", "در", "از"]);

/** «سوء» is also a noun («سوء» in a list); join only these common compounds. */
const SU_COMPOUNDS = new Set([
    "استفاده", "تفاهم", "ظن", "تغذیه", "نیت", "قصد", "رفتار", "مدیریت", "هاضمه", "پیشینه",
    "سابقه", "برداشت", "تدبیر", "اثر", "خلق", "عاقبت", "مصرف", "عملکرد", "تعبیر", "ادب"
]);

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            pattern: new RegExp(`(${WORD} +)?${START}(سوء|ضدّ|ضد|غیر)\\u0650? +(${WORD})${END}`, "g"),
            check: (m) => {
                const before = (m[1] ?? "").trim();
                const prefix = m[2];
                const next = m[3];
                if (prefix === "سوء" && !SU_COMPOUNDS.has(next)) return null;
                if (prefix !== "سوء") {
                    if (NOT_A_PREFIX_BEFORE.has(next)) return null;
                    if (NOT_A_PREFIX_AFTER.has(before)) return null;
                }
                const start = (m[1] ?? "").length;
                return {
                    message: `«${prefix}» بی‌فاصله به کلمهٔ بعد می‌چسبد: «${prefix}${next}»`,
                    replacement: prefix + next,
                    start
                };
            }
        }
    ]
}));
