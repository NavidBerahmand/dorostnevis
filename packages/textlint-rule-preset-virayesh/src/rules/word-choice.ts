/*
 * واژه‌گزینی (پیشنهاد؛ نکته‌های ویرایش، علی صلح‌جو)
 *
 * - «جنگ اول جهانی» ← «جنگ جهانی اول» (و دوم) (ص ۱۱۶)
 * - «قرون وسطی» ← «سده‌های میانه» (ص ۵۰)
 * - «درب» ← «در»، فقط پیش از «را» یا اسم‌هایی که «در» خانه و اتاق و ماشین را
 *   می‌رسانند؛ نام‌ها («درب امام»، «درب‌الشهدا») دست نمی‌خورند (ص ۵۷)
 * - «ضمناً» ← «در ضمن»، «قطعاً» ← «به‌طور قطع» (تنوین‌زدایی، ص ۵۰).
 *   دستور خط واژه‌های تنوین‌دار را درست می‌داند؛ این فقط پیشنهاد سبکی است.
 *
 * از غلط ننویسیم (ابوالحسن نجفی):
 * - تنوین عربی با واژهٔ فارسی یا فرنگی: «گاهاً» (ص ۳۱۹)، «دوماً» (ص ۱۹۷)، «ناچاراً» (ص ۳۸۱)،
 *   «تلفناً، تلگرافاً» (ص ۱۱۲)، «زباناً» (ص ۲۱۹)، «جاناً و مالاً» (ص ۱۳۰). «سوماً» عمداً
 *   نیامده: هم‌شکل نام‌های خاص است.
 * - «مربوطه» ← «مربوط» (صفت مؤنث عربی؛ ص ۳۴۴)
 * - «کاندیداتوری» ← «نامزدی» (در هیچ زبانی نیست؛ ص ۳۱۰)
 */
import { createPatternRule, START, END, ZWNJ } from "../shared";

const S = (page: string) => `نکته‌های ویرایش، علی صلح‌جو، ص ${page}`;
const N = (page: string) => `غلط ننویسیم، ابوالحسن نجفی، ص ${page}`;
/** alef with or without tanvin, in either order */
const AN = "(?:اً|ًا|ا)";
const AN_ONLY = "(?:اً|ًا)";
const TANVIN = (w: string) => `«${w}» فارسی است و تنوین عربی نمی‌گیرد`;
const ORDINAL: Record<string, string> = { اول: "اول", دوم: "دوم", سوم: "سوم" };
// what a «درب» opens or closes: the door of these
const DOOR_NEXT = [
    "را", "و", "ورودی", "خروجی", "اصلی", "منزل", "خانه", "اتاق", "اتاقش", "ماشین", "خودرو", "یخچال", "کمد",
    "پارکینگ", "حیاط", "ساختمان", "مغازه", "بسته", "باز", "آهنی", "چوبی", "شیشه‌ای", "کوچه", "حمام", "آشپزخانه"
];

export default createPatternRule(() => ({
    source: S("۵۰"),
    checks: [
        {
            pattern: new RegExp(`${START}جنگ (اول|دوم|سوم) جهانی${END}`, "g"),
            check: (m) => ({
                message: `«جنگ جهانی ${ORDINAL[m[1]]}» جاافتاده‌تر و خوش‌آواتر است`,
                replacement: `جنگ جهانی ${ORDINAL[m[1]]}`,
                source: S("۱۱۶")
            })
        },
        {
            pattern: new RegExp(`${START}قرون[ ${ZWNJ}]وسط[یا]${END}`, "g"),
            check: () => ({
                message: "به‌جای «قرون وسطی» می‌شود «سده‌های میانه» نوشت",
                replacement: "سده‌های میانه",
                source: S("۵۰")
            })
        },
        {
            pattern: new RegExp(`${START}درب(${ZWNJ}?ها)?(?= (${DOOR_NEXT.join("|")})${END})`, "g"),
            check: (m) => ({
                message: `«درب» شکل رسمی‌نمای «در» است؛ «${m[1] ? "درها" : "در"}» بس است`,
                replacement: m[1] ? "درها" : "در",
                source: S("۵۷")
            })
        },
        {
            pattern: new RegExp(`${START}ضمنا[ًٌ]?${END}`, "g"),
            check: () => ({ message: "پیشنهاد سبکی: «در ضمن» به‌جای واژهٔ تنوین‌دار «ضمناً»", replacement: "در ضمن" })
        },
        {
            // not «قطعاً خیر»، «قطعاً نه»
            pattern: new RegExp(`${START}قطعا[ًٌ]?${END}(?! *(?:خیر|نه|بله|آری)${END})`, "g"),
            check: () => ({ message: "پیشنهاد سبکی: «به‌طور قطع» به‌جای واژهٔ تنوین‌دار «قطعاً»", replacement: "به‌طور قطع" })
        },
        {
            pattern: new RegExp(`${START}گاه${AN}${END}`, "g"),
            check: () => ({ message: `${TANVIN("گاه")}؛ بسته به معنا «گاه»، «گاهی» یا «احیاناً»`, fix: false, source: N("۳۱۹") })
        },
        {
            // not «دوما» without tanvin: the Russian Duma
            pattern: new RegExp(`${START}دوم${AN_ONLY}${END}`, "g"),
            check: () => ({ message: `${TANVIN("دوم")}؛ «دوم» خود قید است (یا «دوم آنکه»، «ثانیاً»)`, replacement: "دوم", source: N("۱۹۷") })
        },
        {
            pattern: new RegExp(`${START}ناچار${AN}${END}`, "g"),
            check: () => ({ message: `${TANVIN("ناچار")}؛ «ناچار» خود قید است (یا «به‌ناچار»)`, replacement: "ناچار", source: N("۳۸۱") })
        },
        {
            pattern: new RegExp(`${START}(تلفن|تلگراف)${AN}${END}`, "g"),
            check: (m) => ({
                message: `«${m[1]}» فرانسوی است و تنوین عربی نمی‌گیرد: «${m[1]}ی» یا «با ${m[1]}»`,
                replacement: `${m[1]}ی`,
                source: N("۱۱۲")
            })
        },
        {
            pattern: new RegExp(`${START}زبان${AN_ONLY}${END}`, "g"),
            check: () => ({ message: `${TANVIN("زبان")}: «زبانی» یا «شفاهی»`, replacement: "زبانی", source: N("۲۱۹") })
        },
        {
            pattern: new RegExp(`${START}جان${AN_ONLY}(?: و مال${AN_ONLY})?${END}`, "g"),
            check: (m) => m[0].includes("مال")
                ? { message: `${TANVIN("جان")}: «جانی و مالی» (یا «از لحاظ جانی و مالی»)`, replacement: "جانی و مالی", source: N("۱۳۰") }
                : { message: `${TANVIN("جان")}: «جانی»`, replacement: "جانی", fix: false, source: N("۱۳۰") }
        },
        {
            pattern: new RegExp(`${START}مربوطه${END}`, "g"),
            check: () => ({ message: "«مربوطه» صفت مؤنث عربی است و فارسی مذکر و مؤنث ندارد: «مربوط»", replacement: "مربوط", source: N("۳۴۴") })
        },
        {
            pattern: new RegExp(`${START}کاندیداتوری(?=${ZWNJ}|${END})`, "g"),
            check: () => ({ message: "«کاندیداتوری» در هیچ زبانی نیست: «نامزدی» یا «داوطلبی»", replacement: "نامزدی", source: N("۳۱۰") })
        }
    ]
}));
