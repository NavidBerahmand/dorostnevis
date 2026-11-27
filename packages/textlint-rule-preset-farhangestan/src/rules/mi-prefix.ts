/*
 * می- و نمی-
 *
 * دستور خط، املای بعضی از واژه‌ها و پیشوندها و پسوندها، «می و همی» (ص ۳۹):
 *   می- و همی- (پیشوندهای فعل استمراری) نسبت به جزء اصلی فعل همواره با
 *   نیم‌فاصله نوشته می‌شوند: می‌افکند، می‌رود، همی‌گوید
 *
 * - «می رود» (فاصلۀ کامل) ← «می‌رود»
 * - «میرود»، «نمیدانم»، «برمیگردد» (پیوسته) ← «می‌رود»، «نمی‌دانم»، «برمی‌گردد».
 *   فقط وقتی باقی کلمه یک صورت صرفی از فهرست فعل‌های Hazm است و خود کلمه
 *   واژۀ دیگری نیست (میدان، میز، میوه، میانجی دست نمی‌خورند).
 * - «بر می‌گردد»، «فرو می‌ریزد» (پیشوند فعل جدا) ← «برمی‌گردد»، «فرومی‌ریزد».
 *   دستور خط، ترکیب‌ها، ب-۷ (ص ۶۳–۶۴): افعال پیشوندی با نیم‌فاصله/بی‌فاصله
 *   نوشته می‌شوند: درمی‌گرفت، فرامی‌گیرد، ورمی‌آید. «در» و «باز» کنار
 *   گذاشته شده‌اند، چون «در می‌زند» و «باز می‌کند» پیشوند نیستند.
 *
 * «همی» عمداً کنار گذاشته شده: تبصرۀ همین بند می‌گوید «همی» در نقش تأکید
 * با فاصلۀ کامل نوشته می‌شود (همی نیست اندر دوزخ…) و تشخیص این دو خودکار نیست.
 */
import { isKnown } from "../util/words";
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, LETTER_RANGE, WORD_CHAR, ZWNJ } from "../util/persian";
import hazmVerbs from "../dict/hazm-verbs.json";
import { spoken } from "../util/colloquial";

const SOURCE = "دستور خط، «می و همی»، ص ۳۹";

// «می»/«نمی» + space(s) + a word that ends like a verb form
// (present: -م -ی -د -یم -ید -ند ; past stems end in -د/-ت).
// «می توان» (a bare present stem) is the one form that ends otherwise
const PATTERN = new RegExp(`${START}(ن?می) +(?=(?:${WORD_CHAR}*[مدیت]|توان)(?!${WORD_CHAR}))`, "g");
// «می شده»، «می کرده»: «می» + a past participle (past stem + «ه»)
const PARTICIPLE = new RegExp(`${START}(ن?می) +(?=(${LETTER}+)ه(?!${WORD_CHAR}))`, "g");

const PRESENT_ENDINGS = ["یم", "ید", "ند", "م", "ی", "د"];
const PAST_ENDINGS = ["یم", "ید", "ند", "م", "ی", ""];
const PRESENT = new Set(hazmVerbs.present);
const PAST = new Set(hazmVerbs.past);
/** A past participle, also negative or with «می»: «زده»، «نزده»، «نکرده»، «می‌رفته». */
export function isParticiple(word: string): boolean {
    if (!word.endsWith("ه")) return false;
    const stem = word.slice(0, -1).replace(/^(?:ن?می\u200c?|ن|ب)(?=..)/, "");
    return PAST.has(word.slice(0, -1)) || PAST.has(stem) || (stem.startsWith("ا") && PAST.has("آ" + stem.slice(1)));
}
const NOT_VERBS = new Set(hazmVerbs.notVerbs);

/**
 * If `rest` is a conjugated verb form (stem + ending), return it with the
 * stem's canonical spelling («اید» → «آید»), otherwise null.
 */
/** Present stems used bare after «می» in impersonal constructions: «می‌توان»، «نمی‌توان». */
const BARE_PRESENT = new Set(["توان"]);

export function isPresentStem(s: string): boolean {
    return PRESENT.has(s);
}

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
// (not after a separated preverb: «فرو میریزد» is handled as a whole below)
const JOINED = new RegExp(`(?<!(?:بر|فرا|فرو|ور|وا) +)${START}(بر|در|باز|فرا|فرو|ور|وا)?(ن?می)(${LETTER}+)${END}`, "g");

/**
 * Prefix verbs written apart without «می» (ب-۷، ص ۶۳): only pairs that cannot be
 * a preposition and a noun. A bare past stem is often also a noun: «در ساخت این
 * بنا»، «در گذشت زمان»؛ and «در گذشته» is «in the past». Those stay out.
 */
const PREFIX_VERBS: Record<string, string[]> = {
    در: ["آمد", "آمدند", "آمده", "آمده‌اند", "آید", "آیند", "نیامد", "نیامدند", "آورد", "آوردند", "آورده", "آورده‌اند", "نیاورد",
        "گرفت", "گرفتند", "نگرفت", "افتاد", "افتادند", "ربود", "ربودند"],
    بر: ["آمد", "آمدند", "آمده", "آورد", "آوردند", "آورده", "خاست", "خاستند", "خیزد", "انگیخت", "انگیزد", "افراشت", "افروخت",
        "شمرد", "شمردند", "گزید", "گزیدند", "نهاد"],
    فرا: ["گرفت", "گرفتند", "رسید", "رسیدند", "خواند", "خواندند"],
    فرو: ["ریخت", "ریختند", "رفت", "رفتند", "پاشید", "نشست", "نشستند", "افتاد"]
};
/** Could be the prefix verb or a preposition/adverb and a verb: report only. */
const MAYBE_PREFIX: Record<string, string[]> = { در: ["گذشت", "گذشتند"] };
const S_PREFIX = "دستور خط، ترکیب‌ها، ب-۷، ص ۶۳–۶۴";
/** «در» + «می»: verbs that take «در» as a prefix (not «در می‌زند», knocks on the door). */
const DAR_STEMS = /^(?:آی|آور|گیر|افت|رو|ربا|ماند|مان)/;
/** «باز» as a verb prefix («بازمی‌گردد»، «بازمی‌دارد»), not the adjective of «باز می‌کند» (opens). */
const BAZ_STEMS = /^(?:ن?می)?(?:گرد|گشت|دار|داشت|گو|گفت|یاب|یافت|ستان|ستاند|مان|ماند|شناس|شناخت)/;

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            // «در می‌آورد» → «درمی‌آورد»؛ «باز می‌گردد»: «باز» is also «again», so a suggestion
            pattern: new RegExp(`${START}(در|باز) +(ن?می)[ ${ZWNJ}]?(${LETTER}+)${END}`, "g"),
            check: (m) => {
                const form = verbForm(m[3]);
                if (!form) return null;
                if (m[1] === "باز" && !BAZ_STEMS.test(form)) return null;
                // «در» is also «door»: «در می‌زند» (knocks). Only prefix verbs: «درمی‌آید، درمی‌آورد، درمی‌گیرد…»
                if (m[1] === "در" && !DAR_STEMS.test(form)) return null;
                const fixed = m[1] + m[2] + ZWNJ + form;
                if (m[1] === "باز") {
                    return { message: `اگر «باز» پیشوند فعل است (نه «دوباره»)، به فعل می‌چسبد: «${fixed}»`, replacement: fixed, fix: false, source: S_PREFIX };
                }
                return { message: `پیشوند فعل «${m[1]}» به «${m[2]}» می‌چسبد: «${fixed}»`, replacement: fixed, source: S_PREFIX };
            }
        },
        {
            // «در آمد» → «درآمد»، «بر خاست» → «برخاست»
            pattern: new RegExp(`${START}(در|بر|فرا|فرو|باز) +(${LETTER}[${LETTER_RANGE}${ZWNJ}]*)${END}`, "g"),
            check: (m) => {
                const [, pre, verb] = m;
                const fixed = pre + verb;
                if (PREFIX_VERBS[pre]?.includes(verb)) {
                    return { message: `فعل پیشوندی پیوسته نوشته می‌شود: «${fixed}»`, replacement: fixed, source: S_PREFIX };
                }
                if (MAYBE_PREFIX[pre]?.includes(verb) || (pre === "باز" && verbForm(verb) && BAZ_STEMS.test(verb) && !verb.startsWith("می"))) {
                    return { message: `اگر فعل پیشوندی است، پیوسته نوشته می‌شود: «${fixed}»`, replacement: fixed, fix: false, source: S_PREFIX };
                }
                return null;
            }
        },
        {
            // preverb written separately: «بر می‌گردد» → «برمی‌گردد»
            pattern: new RegExp(`${START}(بر|فرا|فرو|ور|وا) +(ن?می[ ${ZWNJ}]?)(${LETTER}+)${END}`, "g"),
            check: (m) => {
                const form = verbForm(m[3]);
                if (!form) return null;
                const fixed = m[1] + m[2].replace(/[ \u200C]/g, "") + ZWNJ + form;
                return {
                    message: `پیشوند فعل «${m[1]}» به «${m[2].trim()}» می‌چسبد: «${fixed}»`,
                    replacement: fixed,
                    source: "دستور خط، ترکیب‌ها، ب-۷، ص ۶۳–۶۴"
                };
            }
        },
        {
            pattern: JOINED,
            check: (m) => {
                if (NOT_VERBS.has(m[0])) return null;
                // «میگوی» is «میگو» (shrimp) + «ی»
                if (m[0].endsWith("ی") && isKnown(m[0].slice(0, -1)) && !m[1]) return null;
                const form = verbForm(m[3]);
                if (!form) return null;
                const fixed = (m[1] ?? "") + m[2] + ZWNJ + form;
                return { message: `«${m[2]}» با نیم‌فاصله به فعل می‌چسبد: «${fixed}»`, replacement: fixed };
            }
        },
        {
            // spoken forms with a space (1.6.0): «می کنه»، «نمی شه»، «می تونن» → «می‌کنه»، «نمی‌شه»، «می‌تونن»
            pattern: new RegExp(`${START}(ن?می) +(?=(${LETTER}{1,}(?:ه|ن|ین))(?!${WORD_CHAR}))`, "g"),
            check: (m) => {
                const s = spoken(m[1] + ZWNJ + m[2]);
                if (!s || !/^ن?می‌/.test(s.formal)) return null;
                return { message: `«${m[1]}» با نیم‌فاصله به فعل می‌چسبد`, replacement: m[1] + ZWNJ };
            }
        },
        {
            pattern: PARTICIPLE,
            check: (m) => (PAST.has(m[2]) ? { message: `«${m[1]}» با نیم‌فاصله به فعل می‌چسبد`, replacement: m[1] + ZWNJ } : null)
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
