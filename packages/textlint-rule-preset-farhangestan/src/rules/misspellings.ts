/*
 * غلط‌های املایی رایج (نکته‌های ویرایش، علی صلح‌جو، ص ۳۰–۳۱)
 *
 * - «راجب» ← «راجع»
 * - «تکه کلام» ← «تکیه‌کلام» (کسرۀ اضافه افتاده: نیم‌فاصله، دستور خط، ترکیب‌ها)
 * - «چکنویس» ← «چرک‌نویس»؛ «چک‌نویس» فقط پیشنهاد، چون «نویسندۀ چک» هم هست
 * - «فلان و به همان» ← «فلان و بهمان»
 *
 * غلط‌های املایی از غلط ننویسیم (ابوالحسن نجفی)، فهرست بسته، هر کدام با صفحۀ مدخلش:
 * «مبری، لایتجزی» ← «مبرا، لایتجزا»؛ «سئوال» ← «سؤال»؛ «ک» پس از «ش»ِ ساکن در واژۀ
 * بسیط (ص ۲۷): «لشگر، گنجشگ، پزشگ، مشگل، خشگ» ← «لشکر، گنجشک…»؛ «ناگریز» ← «ناگزیر»؛
 * «ازدهام، انضجار، بهبوهه، برحه، ذوذنقه، ذکام، خوردسال، مرحم، منقص، وحله، حیضه،
 * معائب، معائیر». شکل‌های فرهنگ املایی همه با این‌ها یکی است.
 * - «مجزی» فقط پیشنهاد: «مُجزی» (کافی، در فقه: «طواف مجزی است») هم کلمه است.
 * - نام‌های خاص «لشگری» (نام خانوادگی) و «مشگین‌شهر» در فهرست نیستند.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, ZWNJ, WORD_CHAR } from "../util/persian";
import { doubledTypo } from "../util/speller";
import { registerSegments, spokenAt } from "../util/colloquial";

const S = (page: string) => `نکته‌های ویرایش، علی صلح‌جو، ص ${page}`;
const N = (page: string) => `غلط ننویسیم، ابوالحسن نجفی، ص ${page}`;

/** wrong → [right, page]; every listed form exactly, so «لشگری» (a surname) stays out */
const NAJAFI: Record<string, [string, string]> = {
    مبری: ["مبرا", "۳۳۵"], لایتجزی: ["لایتجزا", "۳۲۹"],
    سئوال: ["سؤال", "۲۳۴"], سئوالات: ["سؤالات", "۲۳۴"], سئوالی: ["سؤالی", "۲۳۴"], سئوالها: ["سؤالها", "۲۳۴"],
    لشگر: ["لشکر", "۳۲۹"], لشگرها: ["لشکرها", "۳۲۹"], لشگرهای: ["لشکرهای", "۳۲۹"], لشگریان: ["لشکریان", "۳۲۹"],
    لشگرکشی: ["لشکرکشی", "۳۲۹"],
    گنجشگ: ["گنجشک", "۳۲۶"], گنجشگها: ["گنجشکها", "۳۲۶"], گنجشگان: ["گنجشکان", "۳۲۶"],
    پزشگ: ["پزشک", "۹۱"], پزشگی: ["پزشکی", "۹۱"], پزشگان: ["پزشکان", "۹۱"],
    مشگل: ["مشکل", "۳۵۱"], مشگلات: ["مشکلات", "۳۵۱"], مشگلی: ["مشکلی", "۳۵۱"],
    خشگ: ["خشک", "۱۷۶"], خشگی: ["خشکی", "۱۷۶"], خشگسالی: ["خشکسالی", "۱۷۶"],
    ناگریز: ["ناگزیر", "۳۲۲"], ازدهام: ["ازدحام", "۲۱"], انضجار: ["انزجار", "۴۷"], منضجر: ["منزجر", "۴۷"],
    بهبوهه: ["بحبوحه", "۶۰"], برحه: ["برهه", "۶۹"], ذوذنقه: ["ذوزنقه", "۲۰۱"], ذکام: ["زکام", "۲۲۱"],
    خوردسال: ["خردسال", "۲۲۶"], خوردسالان: ["خردسالان", "۲۲۶"], خوردسالی: ["خردسالی", "۲۲۶"],
    مرحم: ["مرهم", "۳۴۵"], منقص: ["منغص", "۳۷۰"], وحله: ["وهله", "۴۱۰"], حیضه: ["هیضه", "۴۲۱"],
    معائب: ["معایب", "۳۵۸"], معائیر: ["معاییر", "۳۵۸"]
};
/**
 * One homophone letter off (1.6.0: ز/ذ/ض/ظ، س/ث/ص، ت/ط، ق/غ، ح/ه، ا/ع), mined from 2.9 million sentences of
 * Persian blogs and forums: the wrong form is no word (not in Hazm, the farhang or Wikipedia) and
 * the right one is common. A closed list: «حاظر»، «ضمینه»، «نصبت»، «متفاوط»، «گزاشتم»، «گزشته».
 * The «گذار/گزار» compounds are gozar's («برگذار»، «بارگزاری»).
 */
const HOMOPHONE: Record<string, string> = {
    حاظر: "حاضر",
    ظبط: "ضبط",
    آزربایجان: "آذربایجان",
    ضمینه: "زمینه",
    توجیح: "توجیه",
    ملاحضه: "ملاحظه",
    ملاحضات: "ملاحظات",
    نصبت: "نسبت",
    گذینه: "گزینه",
    لحضه: "لحظه",
    لحضات: "لحظات",
    اظافه: "اضافه",
    تنضیمات: "تنظیمات",
    گذارش: "گزارش",
    حظور: "حضور",
    انظباط: "انضباط",
    اظطراب: "اضطراب",
    تایین: "تعیین",
    عرسال: "ارسال",
    توضیع: "توزیع",
    تغزیه: "تغذیه",
    متفاوط: "متفاوت",
    قازی: "قاضی",
    سابت: "ثابت",
    اختار: "اخطار",
    ترجیه: "ترجیح",
    محصوب: "محسوب",
    حدیه: "هدیه",
    رغیب: "رقیب",
    وابسطه: "وابسته",
    قرغیزستان: "قرقیزستان",
    قورباقه: "قورباغه",
    افلاتون: "افلاطون",
    طومان: "تومان",
    جایگذین: "جایگزین",
    ایطالیا: "ایتالیا",
    نفوز: "نفوذ",
    عظلات: "عضلات",
    ظوابط: "ضوابط",
    درسد: "درصد",
    خوشهال: "خوشحال",
    امتهان: "امتحان",
    اضهار: "اظهار",
    مطعلق: "متعلق",
    محاجرت: "مهاجرت",
    شبیح: "شبیه",
    توضیه: "توضیح",
    احظار: "احضار",
    مزاکره: "مذاکره",
    متوصل: "متوسل",
    لحاض: "لحاظ",
    صلیقه: "سلیقه",
    شرایت: "شرایط",
    زخیم: "ضخیم",
    زخیره: "ذخیره",
    توصیح: "توصیه",
    توصعه: "توسعه",
    بحص: "بحث",
    اوغات: "اوقات",
    ازعان: "اذعان",
    هاشیه: "حاشیه",
    مطمعن: "مطمئن",
    // 1.6.7: frequent misspellings of the blogs and Wikipedia, each checked in its contexts: never a word, a name or a
    // dialect form (left out so: «اسفدن» a town, «مقیسه» a surname, «سرشاسی» a car part, «تمیشه» a place, «متلب» MATLAB)
    بنابرین: "بنابراین",
    فرشگاه: "فروشگاه",
    خوداری: "خودداری",
    استفاه: "استفاده",
    اسفاده: "استفاده",
    برخودار: "برخوردار",
    یاداشت: "یادداشت",
    باردید: "بازدید",
    انتظآر: "انتظار",
    امیتاز: "امتیاز",
    پاورپویینت: "پاورپوینت"
};
/** Endings a listed noun or adjective may carry: «حاظرم»، «لحضه‌ای»، «اظافه‌ها». */
const HOMO_END = "(ی|ای|ها|های|هایی|م|ت|ش|مان|تان|شان|مون|تون|شون|ات|ان|ین|یم|ید|ند|ه)?";
/** «گزاشتم»، «نگزاشت»، «گزشته»: «گذاشتن» and «گذشتن» with «ز». */
const GOZASHT = new RegExp(`${START}(ن|ب|ن?می${ZWNJ}?)?گز(اشت|شت)(م|ی|یم|ید|ین|ند|ن|ه|گی)?(?=${ZWNJ}|${END})`, "g");
/** Forms this rule corrects: the typo checker leaves them to it. */
export const MISSPELLED: ReadonlySet<string> = new Set([...Object.keys(NAJAFI), "راجب", ...Object.keys(HOMOPHONE)]);
export const misspelledHomophone = (word: string, w = word.split(ZWNJ)[0]) =>
    new RegExp(`^(${Object.keys(HOMOPHONE).join("|")})${HOMO_END}$`).test(w) || new RegExp(`^${GOZASHT.source.slice(START.length, -`(?=${ZWNJ}|${END})`.length)}$`).test(w);
const NAJAFI_PATTERN = Object.keys(NAJAFI).sort((a, b) => b.length - a.length).join("|");

export default createPatternRule(() => ({
    source: S("۳۱"),
    checks: [
        {
            pattern: new RegExp(`${START}راجب${END}`, "g"),
            check: () => ({ message: "«راجع» درست است، نه «راجب»: «راجع به»", replacement: "راجع", source: S("۳۱") })
        },
        {
            // «تکه کلام»، «تکه‌کلامش»
            pattern: new RegExp(`${START}تکه[ ${ZWNJ}]?کلام(?=${WORD_CHAR}*${END})`, "g"),
            check: () => ({ message: "«تکیه‌کلام» درست است، نه «تکه کلام»", replacement: `تکیه${ZWNJ}کلام`, source: S("۳۱") })
        },
        {
            pattern: new RegExp(`${START}چک(${ZWNJ}?)نویس(?=${WORD_CHAR}*${END})`, "g"),
            check: (m) => ({
                message: m[1]
                    ? "اگر منظور نوشتۀ پیش از پاک‌نویس است، «چرک‌نویس» درست است"
                    : "«چرک‌نویس» درست است، نه «چکنویس»",
                replacement: `چرک${ZWNJ}نویس`,
                fix: !m[1],
                source: S("۳۰")
            })
        },
        {
            pattern: new RegExp(`${START}فلان و به همان${END}`, "g"),
            check: () => ({ message: "«بهمان» یک کلمه است: «فلان و بهمان»", replacement: "فلان و بهمان", source: S("۳۰") })
        },
        {
            // the word may continue after a ZWNJ: «سئوال‌ها»، «لشگر‌ها»
            pattern: new RegExp(`${START}(${NAJAFI_PATTERN})(?=${ZWNJ}|${END})`, "g"),
            check: (m) => {
                const [right, page] = NAJAFI[m[1]];
                return { message: `املای درست «${right}» است، نه «${m[1]}»`, replacement: right, source: N(page) };
            }
        },
        {
            // «حاظر» → «حاضر» (1.6.0)
            pattern: new RegExp(`${START}(${Object.keys(HOMOPHONE).sort((a, b) => b.length - a.length).join("|")})${HOMO_END}(?=${ZWNJ}|${END})`, "g"),
            check: (m) => {
                const right = HOMOPHONE[m[1]];
                const fixed = right + (m[2] ?? "");
                return { message: `املای درست «${right}» است، نه «${m[1]}»`, replacement: fixed, source: "فرهنگ املایی خطّ فارسی" };
            }
        },
        {
            // «گزاشتم» → «گذاشتم»، «گزشته» → «گذشته» (1.6.0)
            pattern: GOZASHT,
            check: (m) => {
                const fixed = m[0].replace(/^(ن?می)(?!\u200c)(?=گ)/, "$1\u200c").replace("گز", "گذ");
                const verb = m[2] === "اشت" ? "گذاشتن" : "گذشتن";
                return { message: `«${verb}» با «ذ» نوشته می‌شود: «${fixed}»`, replacement: fixed, source: `فرهنگ املایی خطّ فارسی («${verb}»)` };
            }
        },
        {
            // a letter typed twice (1.6.7): «دووست» ← «دوست»، «وععده» ← «وعده»؛ only where certain (util/speller.ts)
            pattern: new RegExp(`${START}[آ-ی]*([آ-ی])\\1[آ-ی]*(?=${ZWNJ}|${END})`, "g"),
            check: (m) => {
                const spoken = spokenAt(registerSegments(m.input), m.index);
                const right = doubledTypo(m[0], !spoken);
                if (!right) return null;
                return { message: `حرفی دو بار تایپ شده است: «${right}»`, replacement: right, source: "غلط تایپی (واژه‌نامۀ واج‌بان)" };
            }
        },
        {
            pattern: new RegExp(`${START}مجزی(?=${ZWNJ}|${END})`, "g"),
            check: () => ({
                message: "اگر به معنای «جدا» است، «مجزا» درست است («مُجزی» یعنی «کافی»)",
                replacement: "مجزا",
                fix: false,
                source: N("۳۳۹")
            })
        }
    ]
}));
