/*
 * می- و نمی-
 *
 * دستور خط، املای بعضی از واژه‌ها و پیشوندها و پسوندها، «می و همی» (ص ۳۹):
 *   می- و همی- (پیشوندهای فعل استمراری) نسبت به جزء اصلی فعل همواره با
 *   نیم‌فاصله نوشته می‌شوند: می‌افکند، می‌رود، همی‌گوید
 *
 * این قاعده فقط حالت «می رود» (با فاصلهٔ کامل) را می‌گیرد. حالت پیوسته
 * («میرود») به فهرست فعل‌ها نیاز دارد (میز، میدان، میوه…) و بعداً اضافه می‌شود.
 *
 * «همی» عمداً کنار گذاشته شده: تبصرهٔ همین بند می‌گوید «همی» در نقش تأکید
 * با فاصلهٔ کامل نوشته می‌شود (همی نیست اندر دوزخ…) و تشخیص این دو خودکار نیست.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, WORD_CHAR, ZWNJ } from "../util/persian";

const SOURCE = "دستور خط، «می و همی»، ص ۳۹";

// «می»/«نمی» + space(s) + a word that ends like a verb form
// (present: -م -ی -د -یم -ید -ند ; past stems end in -د/-ت).
const PATTERN = new RegExp(`${START}(ن?می) +(?=${WORD_CHAR}*[مدیت](?!${WORD_CHAR}))`, "g");

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            pattern: PATTERN,
            check: (m) => ({
                message: `«${m[1]}» با نیم‌فاصله به فعل می‌چسبد`,
                replacement: m[1] + ZWNJ
            })
        }
    ]
}));
