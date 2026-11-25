/*
 * می- و نمی-
 *
 * دستور خط، املای بعضی از واژه‌ها و پیشوندها و پسوندها، «می و همی» (ص ۳۹):
 *   می- و همی- (پیشوندهای فعل استمراری) نسبت به جزء اصلی فعل همواره با
 *   نیم‌فاصله نوشته می‌شوند: می‌افکند، می‌رود، همی‌گوید
 *
 * - «می رود» (فاصلهٔ کامل) ← «می‌رود»
 * - «میرود»، «نمیدانم»، «برمیگردد» (پیوسته) ← «می‌رود»، «نمی‌دانم»، «برمی‌گردد».
 *   فقط وقتی باقی کلمه یک صورت صرفی از فهرست فعل‌های Hazm است و خود کلمه
 *   واژهٔ دیگری نیست (میدان، میز، میوه، میانجی دست نمی‌خورند).
 *
 * «همی» عمداً کنار گذاشته شده: تبصرهٔ همین بند می‌گوید «همی» در نقش تأکید
 * با فاصلهٔ کامل نوشته می‌شود (همی نیست اندر دوزخ…) و تشخیص این دو خودکار نیست.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, WORD_CHAR, ZWNJ } from "../util/persian";
import hazmVerbs from "../dict/hazm-verbs.json";

const SOURCE = "دستور خط، «می و همی»، ص ۳۹";

// «می»/«نمی» + space(s) + a word that ends like a verb form
// (present: -م -ی -د -یم -ید -ند ; past stems end in -د/-ت).
const PATTERN = new RegExp(`${START}(ن?می) +(?=${WORD_CHAR}*[مدیت](?!${WORD_CHAR}))`, "g");

const PRESENT_ENDINGS = ["یم", "ید", "ند", "م", "ی", "د"];
const PAST_ENDINGS = ["یم", "ید", "ند", "م", "ی", ""];
const PRESENT = new Set(hazmVerbs.present);
const PAST = new Set(hazmVerbs.past);
const NOT_VERBS = new Set(hazmVerbs.notVerbs);

/**
 * If `rest` is a conjugated verb form (stem + ending), return it with the
 * stem's canonical spelling («اید» → «آید»), otherwise null.
 */
/** Present stems used bare after «می» in impersonal constructions: «می‌توان»، «نمی‌توان». */
const BARE_PRESENT = new Set(["توان"]);

export function verbForm(rest: string): string | null {
    const candidates = rest.startsWith("ا") ? [rest, "آ" + rest.slice(1)] : [rest];
    for (const form of candidates) {
        if (BARE_PRESENT.has(form)) return form;
        for (const e of PRESENT_ENDINGS) {
            if (form.endsWith(e) && PRESENT.has(form.slice(0, form.length - e.length))) return form;
        }
        for (const e of PAST_ENDINGS) {
            if (form.endsWith(e) && PAST.has(form.slice(0, form.length - e.length))) return form;
        }
    }
    return null;
}

// optional preverb (برمی‌گردد، درمی‌گرفت…), then می/نمی, then the verb, all joined
const JOINED = new RegExp(`${START}(بر|در|باز|فرا|فرو|ور|وا)?(ن?می)(${LETTER}+)${END}`, "g");

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            pattern: JOINED,
            check: (m) => {
                if (NOT_VERBS.has(m[0])) return null;
                const form = verbForm(m[3]);
                if (!form) return null;
                const fixed = (m[1] ?? "") + m[2] + ZWNJ + form;
                return { message: `«${m[2]}» با نیم‌فاصله به فعل می‌چسبد: «${fixed}»`, replacement: fixed };
            }
        },
        {
            pattern: PATTERN,
            check: (m) => ({
                message: `«${m[1]}» با نیم‌فاصله به فعل می‌چسبد`,
                replacement: m[1] + ZWNJ
            })
        }
    ]
}));
