/*
 * «ام، ای، است، ایم، اید، اند»، ضمایر ملکی و یای نکره در جای درست
 *
 * دستور خط، سه جدول پشت سر هم (ص ۴۲–۴۶):
 *   «مجموعۀ ام، ای، است، ایم، اید، اند»، «ضمایر ملکی و مفعولی» و
 *   «یای نکره و مصدری و نسبت». شکل نوشتن به حرف آخر کلمه بستگی دارد:
 *
 *   صامت:            خشنودم، پاکم، پاک‌اند؛ کتابم، کتابش، کتابشان؛ کتابی
 *   «ا» و «و»ی بلند:  دانایم، دانایی؛ پایم، عمویش؛ دانایی، دانشجویی، رادیویی
 *   «ه»ی غیرملفوظ:   خسته‌ام، خسته‌اند؛ خانه‌ام، خانه‌شان؛ خانه‌ای
 *   «ی»:              ایرانی‌ام، ایرانی‌اند؛ کشتی‌ام، کشتی‌شان؛ کشتی‌ای
 *
 * چه چیزهایی گرفته می‌شود (همه وقتی جزء دوم با فاصلهٔ کامل جدا افتاده):
 * - پس از «ه»ی غیرملفوظ و «ی»: «خسته ام» ← «خسته‌ام»، «خانه شان» ← «خانه‌شان»،
 *   «کشتی ای» ← «کشتی‌ای».
 * - پس از صامت: «کتاب اش» ← «کتابش»، «برادر ام» ← «برادرم»، «پاک اند» ← «پاک‌اند».
 * - پس از «ا»: «پا ام» ← «پایم»؛ و «یم، یش…» جداافتاده: «پا یم» ← «پایم»، «عمو یش» ← «عمویش».
 * - یای نکره پس از «ه» و «ی» به شکل «یی»: «خانه یی»، «خانه‌یی» ← «خانه‌ای»؛ «کشتی‌یی» ← «کشتی‌ای».
 * - «ئی» پس از «ا» و «و»: «جائی» ← «جایی»، «دانشجوئی» ← «دانشجویی»، «رادیوئی» ← «رادیویی».
 *
 * چه چیزهایی کنار گذاشته می‌شود:
 * - «است» با فاصله درست است («خسته است»).
 * - «ای» پس از فعل و پس از صامت، چون ممکن است «ای»ِ ندا باشد («گفتی ای دوست»، «گفت ای خدا»).
 * - «شان» پس از صامت فقط پیشنهاد می‌شود، چون «شأن» هم گاهی «شان» نوشته می‌شود.
 * - «ه»ی ملفوظ (کوه، راه) و کلمه‌های ناشناخته.
 */
import { createPatternRule, PatternResult } from "../util/pattern-rule";
import { START, END, LETTER, LETTER_RANGE, ZWNJ, isNonJoining } from "../util/persian";
import { isKnown, endsWithSilentHe } from "../util/words";
import { verbForm } from "./mi-prefix";

const S_COPULA = "دستور خط، «مجموعۀ ام، ای، است، ایم، اید، اند»، ص ۴۲";
const S_POSSESSIVE = "دستور خط، «ضمایر ملکی و مفعولی»، ص ۴۴";
const S_INDEFINITE = "دستور خط، «یای نکره و مصدری و نسبت»، ص ۴۵";

/** Hamza words in جدول ۳ that end in «ائی/وئی». */
const HAMZA_WORDS = new Set(["لوئی", "سوئی", "استثنائی", "اسرائیل", "میکائیل", "عزرائیل", "جبرئیل"]);
/** Words with a final hamza without a seat (جدول ۳): + «ی» gives «ئی». */
const FINAL_HAMZA = new Set([
    "استثنا", "اشقیا", "اشیا", "اعدا", "اعضا", "امضا", "املا", "انبیا", "انشا", "اولیا", "ایما", "جزا", "سو", "علما",
    "ما", "وضو", "سما", "اجزا", "ابتدا", "انتها", "اقتضا", "استغنا", "استیفا", "اغوا", "ابدا"
]);

/** Short words whose final «ه» is pronounced: «کوه ام» is not «کوه‌ام». */
function isPronouncedHe(word: string): boolean {
    const before = word[word.length - 2];
    return before === "ا" || before === "و" || before === "ی" || before === "آ" || word.length <= 2;
}

const POSSESSIVE_PLURAL = ["مان", "تان", "شان"];

function sourceOf(ending: string): string {
    if (ending === "ات" || ending === "اش" || POSSESSIVE_PLURAL.includes(ending)) return S_POSSESSIVE;
    return S_COPULA;
}

/** Known word, or a known word plus the adjective/nisba «ی» («ایرانی» ← «ایران»). */
function known(word: string): boolean {
    return isKnown(word) || (word.endsWith("ی") && isKnown(word.slice(0, -1)));
}

function afterHeOrYeh(word: string, ending: string): PatternResult | null {
    if (word.endsWith("ه")) {
        if (isPronouncedHe(word)) return null;
    } else if (ending === "ای" && verbForm(word) && !isKnown(word)) {
        // «گفتی ای دوست»: vocative after a verb («کشتی» is also a noun, so it is checked)
        return null;
    }
    const fixed = word + ZWNJ + ending;
    const where = word.endsWith("ه") ? "«ه»ی غیرملفوظ" : "کلمهٔ مختوم به «ی»";
    return { message: `«${ending}» پس از ${where} با نیم‌فاصله نوشته می‌شود: «${fixed}»`, replacement: fixed, source: sourceOf(ending) };
}

/** Words that never take these endings as a separate token: «این ام» is not «اینم». */
const FUNCTION_WORDS = new Set(["این", "آن", "او", "من", "تو", "ما", "شما", "از", "به", "با", "در", "بر", "تا", "یک", "هر", "چند", "هم", "نیز", "اگر", "مگر", "ولی", "اما", "پس", "چون"]);

function afterConsonant(word: string, ending: string, next?: string): PatternResult | null {
    if (!known(word) || verbForm(word) || FUNCTION_WORDS.has(word)) return null;
    // «راک اند رول»: «اند» followed by an unknown word is probably English «and»
    if (ending === "اند" && next !== undefined && !isKnown(next)) return null;
    // «اند» after a joining letter keeps its alef: «پاک‌اند»; after a non-joining one: «خشنودند»
    let fixed: string;
    if (ending === "اند") fixed = isNonJoining(word[word.length - 1]) ? word + "ند" : word + ZWNJ + "اند";
    else if (ending.startsWith("ا")) fixed = word + ending.slice(1);
    else fixed = word + ending;
    return {
        message: `«${ending}» پس از صامت به کلمه می‌چسبد: «${fixed}»`,
        replacement: fixed,
        fix: ending === "شان" ? false : undefined,
        source: sourceOf(ending)
    };
}

function afterAlef(word: string, ending: string): PatternResult | null {
    if (!known(word)) return null;
    // «ا» takes a «ی»: «پایم»، «دانایم»، «دانایند»
    const fixed = word + "ی" + ending.slice(1);
    return { message: `پس از «ا»، صامت میانجی «ی» می‌آید: «${fixed}»`, replacement: fixed, source: sourceOf(ending) };
}

export default createPatternRule(() => ({
    source: S_COPULA,
    checks: [
        {
            // «خسته ام»، «کشتی ای»، «کتاب اش»، «پاک اند»، «پا ام»
            // (the word may contain a ZWNJ: «خواب‌های تان» → «خواب‌های‌تان»)
            pattern: new RegExp(`${START}([${LETTER_RANGE}${ZWNJ}]*${LETTER}) +(ایم|اید|اند|ام|ای|ات|اش|مان|تان|شان)${END}(?= +(${LETTER}+))?`, "g"),
            check: (m) => {
                const [word, ending] = [m[1], m[2]];
                const last = word[word.length - 1];
                if (last === "ه" || last === "ی") return afterHeOrYeh(word, ending);
                if (last === "ا") return ending === "ای" || POSSESSIVE_PLURAL.includes(ending) ? null : afterAlef(word, ending);
                // «و» (دانشجو، رهرو، رادیو) and hamza endings vary: left alone
                if ("آوءأؤئ".includes(last) || ending === "ای") return null;
                return afterConsonant(word, ending, m[3]);
            }
        },
        {
            // «پا یم»، «عمو یش»: the mediating «ی» typed as its own word
            pattern: new RegExp(`${START}(${LETTER}+[اوآ]) +(یم|یت|یش|یمان|یتان|یشان|یی|ییم|یید|یند)${END}`, "g"),
            check: (m) => {
                if (!known(m[1])) return null;
                const fixed = m[1] + m[2];
                return { message: `«${m[2]}» به کلمهٔ پیش از خود می‌چسبد: «${fixed}»`, replacement: fixed, source: sourceOf(m[2]) };
            }
        },
        {
            // indefinite «یی» after silent ه or ی: «خانه یی»، «خانه‌یی»، «کشتی‌یی» → «‌ای»
            pattern: new RegExp(`${START}(${LETTER}+[هی])[ ${ZWNJ}]+(?:یی|ئی)${END}`, "g"),
            check: (m) => {
                if (m[1].endsWith("ه") && (isPronouncedHe(m[1]) || !endsWithSilentHe(m[1]))) return null;
                const fixed = m[1] + ZWNJ + "ای";
                return { message: `یای نکره پس از «${m[1].slice(-1)}» به شکل «ای» و با نیم‌فاصله نوشته می‌شود: «${fixed}»`, replacement: fixed, source: S_INDEFINITE };
            }
        },
        {
            // «جائی»، «دانشجوئی»، «رادیوئی» → «یی». The book allows both mediators
            // (پانویس ۱۸) and picks «ی» for consistency, so this is a suggestion. After a
            // final hamza «ئ» is the rule (تبصرۀ ۲: «اجزائی»، «سمائی»، «سوئی»): left alone.
            pattern: new RegExp(`${START}(${LETTER}+[اوآ])ئ(ی|یم|ید)${END}`, "g"),
            check: (m) => {
                const fixed = m[1] + "ی" + m[2];
                if (HAMZA_WORDS.has(m[0]) || FINAL_HAMZA.has(m[1]) || isKnown(m[1] + "ء") || (!known(m[1]) && !isKnown(fixed))) return null;
                return {
                    message: `برای یکدستی، صامت میانجی «ی» توصیه می‌شود: «${fixed}»`,
                    replacement: fixed,
                    fix: false,
                    source: S_INDEFINITE + " و پانویس ۱۸"
                };
            }
        }
    ]
}));
