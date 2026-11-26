/*
 * همزه و تنوین
 *
 * دستور خط، «همزۀ پایانی»، تبصرهٔ ۲ (ص ۵۱):
 *   هرگاه همزۀ پایانی (بدون کرسی) به یای وحدت، نکره، نسبت یا مصدری متّصل
 *   شود روی کرسی دندانه (ﺋ) خواهد آمد: جزء ← جزئی، سوء ← سوئی، شیء ← شیئی
 * «تنوین»، تبصرهٔ ۱ و ۲ (ص ۵۶):
 *   کلمه‏های مختوم به همزه … با تنوین نصب … همزۀ آن‌ها روی کرسی دندانه می‏آید
 *   و تنوین روی «الفِ» پس‌از آن: ابتدائاً، استثنائاً، جزئاً
 *   «تا»ی تأنیث عربی «ة» … پیش‌از تنوین نصب، بدل به «ت» می‏شود: حقیقتاً، نسبتاً
 * «تنوین نصب: در همه‏جا به صورت «اً/ ‍اً» نوشته می‏شود» (ص ۵۶)
 *
 * - «جزءی» ← «جزئی»
 * - «جزءاً» ← «جزئاً»
 * - «حقیقةً» ← «حقیقتاً»
 * - «اصلًا» (تنوین روی حرف پیش از الف) ← «اصلاً»
 *
 * تنوین با واژهٔ فارسی یا فرنگی (غلط ننویسیم، ابوالحسن نجفی؛ دستور خط دربارهٔ آن چیزی
 * نگفته): تنوین قیدساز عربی است و با واژهٔ غیرعربی نمی‌آید. فهرست بسته، هر کدام با صفحهٔ
 * مدخلش و یک اصلاح پیش‌فرض؛ شکل‌های دیگر در پیام می‌آید:
 * «گاهاً» ← «گاهی» (گاه، احیاناً؛ ص ۳۱۹)، «دوماً» ← «دوم» (ص ۱۹۷)، «ناچاراً» ← «ناچار»
 * (ص ۳۸۱)، «تلفناً، تلگرافاً» ← «تلفنی، تلگرافی» (ص ۱۱۲)، «زباناً» ← «زبانی» (ص ۲۱۹)،
 * «جاناً (و مالاً)» ← «جانی (و مالی)» (ص ۱۳۰)، «خواهشاً» ← «لطفاً» (به قیاس «گاهاً»، ص ۳۱۹).
 * «سوماً» عمداً نیامده: هم‌شکل نام‌های خاص است؛ «دوما» بی‌تنوین هم (دومای روسیه).
 *
 * و «ة» (ص ۵۴): «ة» در آخر کلمهٔ مستقل در فارسی «ت» (برائت، رحمت) یا «ه»
 * (علاقه، معاینه) نوشته می‌شود. کدام یک، به تلفظ بستگی دارد؛ پس فقط گزارش
 * می‌شود. ترکیب‌های عربی («دایرة‌المعارف») دست نمی‌خورند.
 */
import { createPatternRule } from "../util/pattern-rule";
import { LETTER, WORD_CHAR, START, END } from "../util/persian";

const S_HAMZA = "دستور خط، «همزۀ پایانی»، تبصرهٔ ۲، ص ۵۱";
const S_TANVIN = "دستور خط، «تنوین»، ص ۵۶";
/**
 * Tanvin left out («ایضا» ← «ایضاً»; ص ۵۶: «تنوین نصب در همه‌جا به صورت «اً» نوشته می‌شود»).
 * A closed list beside the book's own (lexicon, arabic.json): the adverbs Persian Wikipedia
 * writes with «اً» at least ten times, whose bare form is no word of its own (not in the farhang
 * or Hazm's nouns and adjectives) and is rare (under half as often as the tanvin form). Left
 * out by that: «جدا»، «اسما» (اسما بنت عمیس)، «عرفا»، «آشکارا»، «محتملا»؛ and by hand «کلا»
 * (village names «… کلا»), «راسا»/«دایما» (their tanvin form has a hamza: «رأساً»، «دائماً»).
 */
const MISSING_TANVIN = ["اصطلاحا", "منحصرا", "جمعا", "علنا", "مشترکا", "نوعا", "ترجیحا", "متناوبا", "ضرورتا", "اختصاصا", "مضافا", "ندرتا", "عادتا", "منطقا", "مختصرا", "سهوا", "غیابا", "متفقا", "بدوا", "مفصلا", "ایضا", "قلبا", "قهرا", "ماهیتا"];
const S_TA = "دستور خط، «ة»، ص ۵۴";
const N = (page: string) => `غلط ننویسیم، ابوالحسن نجفی، ص ${page}`;
/** alef with or without tanvin, in either order; or only with tanvin */
const AN = "(?:اً|ًا|ا)";
const AN_ONLY = "(?:اً|ًا)";
const NOT_ARABIC = (w: string) => `«${w}» عربی نیست و تنوین عربی نمی‌گیرد`;

export default createPatternRule(() => ({
    source: S_TANVIN,
    checks: [
        {
            pattern: new RegExp(`(?<=${LETTER})ء(?=ی)`, "g"),
            check: () => ({ message: "همزهٔ پایانی پیش از «ی» روی کرسی می‌نشیند: «ئی»", replacement: "ئ", source: S_HAMZA })
        },
        {
            pattern: new RegExp(`(?<=${LETTER})ءاً`, "g"),
            check: () => ({ message: "پیش از تنوین نصب، همزه روی کرسی می‌نشیند: «ئاً»", replacement: "ئاً" })
        },
        {
            // «ابتداءً»، «استثناءً»: tanvin on the bare hamza → «ابتدائاً»
            pattern: new RegExp(`(?<=${LETTER})ء\\u064Bا?`, "g"),
            check: () => ({ message: "پیش از تنوین نصب، همزه روی کرسی می‌نشیند و تنوین روی الف: «ئاً»", replacement: "ئاً" })
        },
        {
            pattern: new RegExp(`(?<=${LETTER})ة\\u064B`, "g"),
            check: () => ({ message: "«ة» پیش از تنوین نصب «ت» می‌شود: «تاً»", replacement: "تاً" })
        },
        {
            // «ة» ending a standalone word (not «…ة‌ال…», not before tanvin)
            pattern: new RegExp(`(?<=${LETTER})ة(?!${WORD_CHAR})`, "g"),
            check: () => ({
                message: "در فارسی «ة» پایانی به‌صورت «ت» (اگر تلفظ شود) یا «ه» (اگر تلفظ نشود) نوشته می‌شود",
                replacement: "ت",
                alternatives: ["ه"],
                fix: false,
                source: S_TA
            })
        },
        {
            pattern: new RegExp(`${START}گاه${AN}${END}`, "g"),
            check: () => ({ message: `${NOT_ARABIC("گاه")}؛ بسته به معنا «گاهی»، «گاه» یا «احیاناً»`, replacement: "گاهی", alternatives: ["گاه", "احیاناً"], source: N("۳۱۹") })
        },
        {
            // not «دوما» without tanvin: the Russian Duma
            pattern: new RegExp(`${START}دوم${AN_ONLY}${END}`, "g"),
            check: () => ({ message: `${NOT_ARABIC("دوم")}؛ «دوم» خود قید است (یا «دوم آنکه»، «ثانیاً»)`, replacement: "دوم", alternatives: ["ثانیاً"], source: N("۱۹۷") })
        },
        {
            pattern: new RegExp(`${START}ناچار${AN}${END}`, "g"),
            check: () => ({ message: `${NOT_ARABIC("ناچار")}؛ «ناچار» خود قید است (یا «به‌ناچار»)`, replacement: "ناچار", alternatives: ["به‌ناچار"], source: N("۳۸۱") })
        },
        {
            pattern: new RegExp(`${START}(تلفن|تلگراف)${AN}${END}`, "g"),
            check: (m) => ({ message: `«${m[1]}» فرانسوی است و تنوین عربی نمی‌گیرد: «${m[1]}ی» یا «با ${m[1]}»`, replacement: `${m[1]}ی`, source: N("۱۱۲") })
        },
        {
            pattern: new RegExp(`${START}زبان${AN_ONLY}${END}`, "g"),
            check: () => ({ message: `${NOT_ARABIC("زبان")}: «زبانی»، «شفاهی» یا «به زبان»`, replacement: "زبانی", source: N("۲۱۹") })
        },
        {
            // «جانا» without tanvin is the vocative «ای جان»
            pattern: new RegExp(`${START}جان${AN_ONLY}(?: و مال${AN_ONLY})?${END}`, "g"),
            check: (m) => m[0].includes("مال")
                ? { message: `${NOT_ARABIC("جان")}: «جانی و مالی» (یا «از لحاظ جانی و مالی»)`, replacement: "جانی و مالی", source: N("۱۳۰") }
                : { message: `${NOT_ARABIC("جان")}: «جانی»`, replacement: "جانی", source: N("۱۳۰") }
        },
        {
            pattern: new RegExp(`${START}خواهش${AN}${END}`, "g"),
            check: () => ({ message: `${NOT_ARABIC("خواهش")}: «لطفاً» یا «خواهش می‌کنم …»`, replacement: "لطفاً", source: `${N("۳۱۹")}، به قیاس «گاهاً»` })
        },
        {
            pattern: new RegExp(`${START}(${MISSING_TANVIN.join("|")})${END}`, "g"),
            check: (m) => ({ message: `تنوین نصب «اً» نوشته می‌شود: «${m[1].slice(0, -1)}اً»`, replacement: m[1].slice(0, -1) + "اً", source: S_TANVIN })
        },
        {
            pattern: new RegExp(`(?<=${LETTER})\\u064Bا`, "g"),
            check: () => ({ message: "تنوین نصب روی الف می‌آید: «اً»", replacement: "اً" })
        }
    ]
}));
