/*
 * فعل‌های زائد و ساخت‌های طولانی (پیشنهاد)
 *
 * - «می‌باشد، می‌باشند، نمی‌باشد…» ← «است، هستند، نیست…»
 * - «مورد بررسی قرار گرفت» ← «بررسی شد»؛ «را مورد بررسی قرار داد» ← «را بررسی کرد»
 * - «بررسی صورت گرفت / انجام شد» ← «بررسی شد»؛ «بررسی انجام داد» ← «بررسی کرد»
 *
 * شکل کوتاه فقط برای اسم‌هایی پیشنهاد می‌شود که با «کردن/شدن» طبیعی‌اند
 * (VERBAL_NOUNS). برای بقیه («مورد توجه قرار گرفت» ← «به آن توجه شد») جمله
 * باید بازنویسی شود، پس فقط توضیح می‌آید. پیش از «… انجام شد»، اگر اسم پس از
 * حرف اضافه آمده باشد («پس از بررسی انجام شد») چیزی گزارش نمی‌شود.
 */
import { createPatternRule, START, END, SOURCE, flex, squash, alternation, PatternResult } from "../shared";

const S = SOURCE("فعل زائد");

/** «می‌باشد» → «است»: [negative?, ending] → form. */
const BUDAN: Record<string, string> = {
    م: "هستم", ی: "هستی", د: "است", یم: "هستیم", ید: "هستید", ند: "هستند",
    نم: "نیستم", نی: "نیستی", ند_: "نیست", نیم: "نیستیم", نید: "نیستید", نند: "نیستند"
};

/** «… قرار گرفت / صورت گرفت / انجام شد» → «… شد». Keys without spaces or ZWNJs. */
const PASSIVE: Record<string, string> = {
    "گرفت": "شد", "گرفتند": "شدند", "گرفته است": "شده است", "گرفته‌اند": "شده‌اند", "گرفته بود": "شده بود",
    "گرفته بودند": "شده بودند", "می‌گیرد": "می‌شود", "می‌گیرند": "می‌شوند", "گیرد": "شود", "گیرند": "شوند",
    "نگرفت": "نشد", "نگرفته است": "نشده است", "نمی‌گیرد": "نمی‌شود", "نمی‌گیرند": "نمی‌شوند", "خواهد گرفت": "خواهد شد",
    "خواهند گرفت": "خواهند شد"
};
/** «… صورت پذیرفت» → «… شد». */
const PADHIRUFT: Record<string, string> = {
    "پذیرفت": "شد", "پذیرفتند": "شدند", "پذیرفته است": "شده است", "پذیرفته‌اند": "شده‌اند", "می‌پذیرد": "می‌شود",
    "می‌پذیرند": "می‌شوند", "پذیرد": "شود", "خواهد پذیرفت": "خواهد شد"
};
/** «… انجام شد» → «… شد». */
const SHOD: Record<string, string> = {
    "شد": "شد", "شدند": "شدند", "شده است": "شده است", "شده‌اند": "شده‌اند", "شده بود": "شده بود", "می‌شود": "می‌شود",
    "می‌شوند": "می‌شوند", "شود": "شود", "شوند": "شوند", "نشد": "نشد", "نمی‌شود": "نمی‌شود", "خواهد شد": "خواهد شد"
};
/** «… قرار داد / انجام داد» → «… کرد». */
const ACTIVE: Record<string, string> = {
    "داد": "کرد", "دادند": "کردند", "دادم": "کردم", "دادیم": "کردیم", "داده است": "کرده است", "داده‌اند": "کرده‌اند",
    "داده‌ایم": "کرده‌ایم", "داده بود": "کرده بود", "می‌دهد": "می‌کند", "می‌دهند": "می‌کنند", "می‌دهیم": "می‌کنیم",
    "می‌دهم": "می‌کنم", "دهد": "کند", "دهند": "کنند", "دهیم": "کنیم", "نداد": "نکرد", "ندادند": "نکردند",
    "نمی‌دهد": "نمی‌کند", "خواهد داد": "خواهد کرد", "خواهند داد": "خواهند کرد"
};
const lookup = (map: Record<string, string>) => {
    const m = new Map<string, string>();
    for (const [k, v] of Object.entries(map)) m.set(squash(k), v);
    return (form: string) => m.get(squash(form));
};
const passive = lookup(PASSIVE);
const padhiruft = lookup(PADHIRUFT);
const shod = lookup(SHOD);
const active = lookup(ACTIVE);

/** Nouns whose «… کردن / … شدن» is natural: «بررسی شد»، «تصویب کرد». */
export const VERBAL_NOUNS = [
    "بررسی", "مطالعه", "ارزیابی", "تأیید", "تایید", "تصویب", "آزمایش", "تحلیل", "اصلاح", "بازبینی", "سنجش",
    "شناسایی", "تعریف", "تفسیر", "ترجمه", "معرفی", "ویرایش", "بازسازی", "تعمیر", "نصب", "ثبت", "پیگیری",
    "کنترل", "بازرسی", "تمدید", "تکمیل", "تدوین", "تنظیم", "تهیه", "اجرا", "پرداخت", "دریافت", "ارسال",
    "تحویل", "توزیع", "انتخاب", "استخدام", "آموزش", "تشویق", "ستایش", "تقدیر", "محاسبه", "اندازه‌گیری",
    "طراحی", "تولید", "مقایسه", "بازنگری", "رسیدگی", "تجزیه‌وتحلیل", "نظارت", "حمایت"
];
const NOUN_SET = new Set(VERBAL_NOUNS);
/** «پس از بررسی انجام شد»: the noun belongs to the preposition, not to «انجام شد». */
const PREPOSITIONS = new Set(["از", "با", "به", "برای", "در", "تا", "بدون", "بی", "جز", "مانند", "مثل", "پس", "پیش", "بعد", "قبل", "هنگام", "حین"]);

const N = `(?:${VERBAL_NOUNS.map(flex).join("|")})`;
const WORD_BEFORE = /(\S+)\s+$/;

function previousWord(input: string, index: number): string {
    return input.slice(Math.max(0, index - 30), index).match(WORD_BEFORE)?.[1] ?? "";
}

export default createPatternRule(() => ({
    source: S,
    checks: [
        {
            // «می‌باشد»، «نمی‌باشند»، «میباشد»
            pattern: new RegExp(`${START}(ن?)می[‌ ]?باش(م|ی|د|یم|ید|ند)${END}`, "g"),
            check: (m): PatternResult => {
                const key = m[1] ? (m[2] === "د" ? "ند_" : "ن" + m[2]) : m[2];
                const to = BUDAN[key];
                return {
                    message: `«${m[0]}» در نثر امروز جای «${to}» را گرفته؛ «${to}» ساده‌تر و رایج‌تر است`,
                    replacement: to
                };
            }
        },
        {
            // «مورد بررسی قرار گرفت» ← «بررسی شد»؛ «مورد بررسی قرار داد» ← «بررسی کرد»
            pattern: new RegExp(`${START}مورد (\\S+) قرار (${alternation(Object.keys(PASSIVE))}|${alternation(Object.keys(ACTIVE))})${END}`, "g"),
            check: (m) => {
                const before = previousWord(m.input, m.index);
                if (["در", "این", "آن", "هر", "یک", "چند", "همین", "همان"].includes(before)) return null; // «در مورد …»
                const isPassive = passive(m[2]) !== undefined;
                const verb = isPassive ? passive(m[2])! : active(m[2]);
                if (!verb) return null;
                if (!NOUN_SET.has(m[1])) {
                    return {
                        message: `«مورد ${m[1]} قرار ${m[2]}» ساختی طولانی است؛ بهتر است جمله با فعل «${m[1]} ${isPassive ? "شدن" : "کردن"}» یا فعلی ساده بازنویسی شود`,
                        fix: false
                    };
                }
                const to = `${m[1]} ${verb}`;
                return { message: `«مورد … قرار ${isPassive ? "گرفتن" : "دادن"}» را می‌شود کوتاه کرد: «${to}»`, replacement: to };
            }
        },
        {
            // «بررسی صورت گرفت / صورت پذیرفت / انجام شد / انجام گرفت / انجام داد»
            pattern: new RegExp(
                `${START}(${N}) (صورت|انجام) (${alternation(Object.keys(PASSIVE))}|${alternation(Object.keys(PADHIRUFT))}|${alternation(Object.keys(SHOD))}|${alternation(Object.keys(ACTIVE))})${END}`,
                "g"
            ),
            check: (m) => {
                if (PREPOSITIONS.has(previousWord(m.input, m.index))) return null;
                const [, noun, light, form] = m;
                let verb: string | undefined;
                let kind = "شدن";
                if (light === "صورت") verb = passive(form) ?? padhiruft(form);
                else {
                    verb = passive(form) ?? shod(form);
                    if (!verb && (verb = active(form))) kind = "کردن";
                }
                if (!verb) return null;
                const to = `${noun} ${verb}`;
                return { message: `«${light}» در «${m[0]}» زائد است: «${to}» (${noun} ${kind})`, replacement: to };
            }
        }
    ]
}));
