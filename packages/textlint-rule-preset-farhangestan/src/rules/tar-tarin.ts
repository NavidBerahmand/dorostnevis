/*
 * -تر و -ترین
 *
 * دستور خط، «تر و ترین» (ص ۴۰):
 *   - تر و - ترین همواره با نیم‌فاصله/ بی‌فاصله از کلمۀ پیش‌از خود نوشته
 *   می‌شوند، مگر در: بهتر، کهتر، مهتر، بیشتر، کمتر، کلانتر (رئیس کلانتری)
 *
 * چه چیزهایی گرفته می‌شود:
 * - «بزرگ ترین» (فاصلهٔ کامل) ← «بزرگ‌ترین». «ترین» به‌تنهایی کلمه نیست، پس امن است.
 * - «بزرگ تر از» ← «بزرگ‌تر از». «تر» به‌تنهایی صفت هم هست (لباس تر)،
 *   برای همین فقط وقتی «از» بعدش آمده اصلاح می‌شود.
 * - استثناها با نیم‌فاصله/فاصله («بیش‌تر»، «کم تر») ← پیوسته.
 *
 * - «بزرگتر»، «سریعترین» (پیوسته) ← «بزرگ‌تر»، «سریع‌ترین»، فقط وقتی پایهٔ
 *   کلمه در فهرست صفت‌های Hazm است و «Xتر» خودش واژهٔ دیگری نیست (دفتر،
 *   دکتر، بستر، مستتر دست نمی‌خورند).
 *
 * «کلانتر» عمداً کنار گذاشته شده، چون «کلان‌تر» (بزرگ‌تر) هم درست است.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, WORD, ZWNJ, joinWithHalfSpace } from "../util/persian";
import hazmAdjectives from "../dict/hazm-adjectives.json";

const SOURCE = "دستور خط، «تر و ترین»، ص ۴۰";

const EXCEPTION_STEMS = ["به", "که", "مه", "بیش", "کم"];

/** Function words never take -تر/-ترین; seeing one means «تر» is meant literally («تر و ترین»). */
const NOT_A_STEM = new Set(["و", "یا", "از", "با", "در", "را", "تا", "هم", "نه", "که", "چه", "این", "آن"]);

const ADJECTIVES = new Set(hazmAdjectives.adjectives);
const BLOCKED = new Set([...hazmAdjectives.blocked, ...EXCEPTION_STEMS, "کلان"]);

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            // joined: «بزرگتر»، «بزرگترین»، «بزرگتری»، «بزرگترها»
            pattern: new RegExp(`${START}(${LETTER}+?)(ترین|تر)(ها|های|هایی|ی)?${END}`, "g"),
            check: (m) => {
                const stem = m[1];
                if (!ADJECTIVES.has(stem) || BLOCKED.has(stem)) return null;
                const fixed = stem + ZWNJ + m[2] + (m[3] ?? "");
                return { message: `«${m[2]}» با نیم‌فاصله به صفت می‌چسبد: «${fixed}»`, replacement: fixed };
            }
        },
        {
            pattern: new RegExp(`${START}(${EXCEPTION_STEMS.join("|")})[ ${ZWNJ}](ترین|تر)${END}`, "g"),
            check: (m) => ({
                message: `«${m[1]}${m[2]}» از استثناهای قاعده است و پیوسته نوشته می‌شود`,
                replacement: m[1] + m[2]
            })
        },
        {
            pattern: new RegExp(`${START}(${WORD}) +(ترین)${END}`, "g"),
            check: (m) => {
                if (EXCEPTION_STEMS.includes(m[1]) || NOT_A_STEM.has(m[1])) return null;
                return {
                    message: "«ترین» با نیم‌فاصله به کلمهٔ پیش از خود می‌چسبد",
                    replacement: joinWithHalfSpace(m[1], m[2])
                };
            }
        },
        {
            pattern: new RegExp(`${START}(${WORD}) +(تر)(?= +از${END})`, "g"),
            check: (m) => {
                if (EXCEPTION_STEMS.includes(m[1]) || NOT_A_STEM.has(m[1])) return null;
                return {
                    message: "«تر» با نیم‌فاصله به کلمهٔ پیش از خود می‌چسبد",
                    replacement: joinWithHalfSpace(m[1], m[2])
                };
            }
        }
    ]
}));
