/*
 * تعبیرهای نادرست یا نامطلوب (پیشنهاد؛ نگارش و ویرایش، احمد سمیعی گیلانی)
 *
 * - «اگرچه/هرچند/با اینکه … ، اما/ولی» ← بی «اما» (ص ۱۵۴)
 * - «آنچه که» ← «آنچه» (ص ۱۵۴)؛ «با این وجود» ← «باوجوداین» (ص ۱۵۵)
 * - «در ارتباط با» ← «دربارهٔ» (ص ۱۵۷)؛ «نقطه نظر» ← «دیدگاه»، «نظرات» ← «نظرها» (ص ۱۶۱)
 * - «لازم به ذکر است» ← «باید یادآور شد» (ص ۱۶۰)
 * - «غیرقابل انکار» ← «انکارناپذیر» و مانند آن (ص ۱۶۰، ۱۷۵)؛ «طبق گزارش» ← «به گزارش» (ص ۱۷۵)
 * - «منطبق با» ← «منطبق بر» (ص ۱۶۳)؛ «… را استفاده کرد» ← «از … استفاده کرد» (ص ۱۶۸)
 * - «قابل اهمیت»، «الاهم فی الاهم» (ص ۱۶۹)، «سر به فرمان» (ص ۱۷۰)، «انجام گرفته شده» (ص ۱۸۵)،
 *   «کنکاش»، «معرف حضور»، «تسلیت باد» (ص ۱۵۶–۱۶۱)
 *
 * از غلط ننویسیم (ابوالحسن نجفی):
 * - «چون … ، لذا …» ← بی «لذا» (ص ۱۴۹)
 * - «فراری دادن» ← «فرار دادن» (ص ۲۸۹)
 * - «مثمر ثمر» ← «ثمربخش» (ص ۳۳۷)؛ «مفید فایده» ← «مفید» (ص ۳۶۱)؛ «سهل و ممتنع» ← «سهل ممتنع» (ص ۲۳۵)
 * - «استفاده بردن» ← «استفاده کردن»، «استمداد طلبیدن» ← «استمداد کردن» (ص ۲۴)؛
 *   «سؤال پرسیدن» ← «سؤال کردن» یا «پرسیدن» (ص ۲۳۴)
 * - «تفهیم و تفاهم» ← «تفاهم» یا «تفهیم و تفهم» (ص ۱۰۹)؛ «ید طولانی» ← «ید طولا» (ص ۴۲۵)
 * - «لازم به تذکر است» (ص ۳۲۸)؛ «غیرقابل احتراز» ← «احترازناپذیر» (ص ۲۸۴)
 */
import { createPatternRule, START, END, ZWNJ } from "../shared";

const S = (page: string) => `نگارش و ویرایش، احمد سمیعی گیلانی، ص ${page}`;
const N = (page: string) => `غلط ننویسیم، ابوالحسن نجفی، ص ${page}`;
const Z = `[ ${ZWNJ}]`;
// «غیرقابلِ X» ← the farhang's «-ناپذیر» form
const UNABLE: Record<string, string> = {
    انکار: "انکارناپذیر", اجتناب: `اجتناب${ZWNJ}ناپذیر`, بازگشت: `بازگشت${ZWNJ}ناپذیر`,
    [`پیش${ZWNJ}بینی`]: `پیش${ZWNJ}بینی${ZWNJ}ناپذیر`, تحمل: `تحمل${ZWNJ}ناپذیر`, توصیف: `وصف${ZWNJ}ناپذیر`,
    جبران: `جبران${ZWNJ}ناپذیر`, تغییر: "تغییرناپذیر", تفکیک: `تفکیک${ZWNJ}ناپذیر`, نفوذ: "نفوذناپذیر",
    بخشش: "نابخشودنی", باور: "باورنکردنی", شکست: `شکست${ZWNJ}ناپذیر`, مقایسه: `مقایسه${ZWNJ}ناپذیر`,
    احتراز: "احترازناپذیر"
};
// «استفاده بردن» ← «استفاده کردن»: the verb after «استفاده»، «استمداد»، «سؤال»
const BORDAN: Record<string, string> = {
    برد: "کرد", بردند: "کردند", بردم: "کردم", بردیم: "کردیم", بردی: "کردی", بردید: "کردید", برده: "کرده", بردن: "کردن",
    نبرد: "نکرد", نبردند: "نکردند", میبرد: "می‌کند", میبرند: "می‌کنند", میبریم: "می‌کنیم", میبرم: "می‌کنم",
    میبردند: "می‌کردند", نمیبرد: "نمی‌کند", نمیبرند: "نمی‌کنند", ببرد: "کند", ببرند: "کنند", ببریم: "کنیم", ببرم: "کنم"
};
const TALABIDAN: Record<string, string> = {
    طلبید: "کرد", طلبیدند: "کردند", طلبیده: "کرده", طلبیدن: "کردن", میطلبد: "می‌کند", میطلبند: "می‌کنند",
    بطلبد: "کند", بطلبند: "کنند"
};
const PORSIDAN: Record<string, string> = {
    پرسید: "کرد", پرسیدند: "کردند", پرسیدم: "کردم", پرسیدیم: "کردیم", پرسیده: "کرده", پرسیدن: "کردن",
    نپرسید: "نکرد", میپرسد: "می‌کند", میپرسند: "می‌کنند", میپرسیم: "می‌کنیم", میپرسم: "می‌کنم",
    میپرسیدند: "می‌کردند", نمیپرسد: "نمی‌کند", نمیپرسند: "نمی‌کنند", بپرسد: "بکند", بپرسند: "بکنند",
    بپرسیم: "بکنیم", بپرسم: "بکنم", بپرسید: "بکنید"
};
const verbAlt = (map: Record<string, string>) =>
    Object.keys(map).sort((a, b) => b.length - a.length).map((k) => k.replace(/^(ن?می)/, `$1${Z}?`)).join("|");
const verbKey = (s: string) => s.replace(/[ ‌]/g, "");
const unableKey = (w: string) => w.replace(/ /g, ZWNJ);

export default createPatternRule(() => ({
    source: S("۱۵۴"),
    checks: [
        {
            // «اگرچه … شد، اما …»: «اگرچه» and «اما» say the same thing twice
            pattern: new RegExp(`${START}(?:اگر${Z}?چه|هر${Z}?چند|با این${Z}?که|با آن${Z}?که)${END}[^.؟!؛،\\n]{3,160}?،\\s*((?:اما|ولی)${END}\\s*)`, "g"),
            check: (m) => {
                const start = m[0].length - m[1].length;
                return {
                    message: "پس از «اگرچه/هرچند/با اینکه»، «اما» یا «ولی» زائد است",
                    replacement: "",
                    start,
                    end: m[0].length,
                    source: S("۱۵۴"), certain: true
                };
            }
        },
        {
            pattern: new RegExp(`${START}آنچه که${END}`, "g"),
            check: () => ({ message: "«که» پس از «آنچه» زائد است", replacement: "آنچه", source: S("۱۵۴"), certain: true })
        },
        {
            pattern: new RegExp(`${START}با این وجود${END}`, "g"),
            check: () => ({ message: "«با این وجود» نادرست است؛ «باوجوداین»، «با این همه» یا «با این وصف»", replacement: "باوجوداین", source: S("۱۵۵"), certain: true })
        },
        {
            pattern: new RegExp(`${START}در ارتباط با${END}`, "g"),
            check: () => ({ message: "«در ارتباط با» تعبیر اداری و عاریتی است؛ بسته به معنا «دربارهٔ» یا «در مورد»", replacement: "دربارهٔ", alternatives: ["در مورد"], fix: false, source: S("۱۵۷") })
        },
        {
            pattern: new RegExp(`${START}نقطه${Z}?نظر(ات)?${END}`, "g"),
            check: (m) => ({
                message: "«نقطه نظر» گرته‌برداری است؛ «دیدگاه» یا «نظرگاه»",
                replacement: m[1] ? `دیدگاه${ZWNJ}ها` : "دیدگاه",
                fix: !m[1], // «نقطه نظرات او» needs «دیدگاه‌های او»
                source: S("۱۶۱")
            })
        },
        {
            pattern: new RegExp(`${START}نظرات${END}`, "g"),
            // no automatic fix: «نظرات او» needs «نظرهای او»
            check: () => ({ message: "«نظرات» جمع «نظره» است، نه «نظر»؛ «نظرها» (یا «نظرهای …») یا «آرا»", replacement: "نظرها", alternatives: ["آرا"], fix: false, source: S("۱۶۱") })
        },
        {
            pattern: new RegExp(`${START}لازم به (ذکر|یادآوری|توضیح|تذکر) است${END}`, "g"),
            check: (m) => m[1] === "تذکر"
                ? { message: "«لازم» حرف اضافهٔ «به» نمی‌گیرد؛ «این تذکر لازم است»، یا عبارت را یکسره بردارید", replacement: "این تذکر لازم است", fix: false, source: N("۳۲۸") }
                : { message: "«لازم به ذکر است» نامطلوب است؛ «باید یادآور شد» یا «یادآوری این نکته لازم است»", replacement: "باید یادآور شد", alternatives: ["یادآوری این نکته لازم است"], fix: false, source: S("۱۶۰") }
        },
        {
            pattern: new RegExp(`${START}غیر${Z}?قابلِ?${Z}?(${Object.keys(UNABLE).map((k) => k.replace(ZWNJ, Z)).join("|")})${END}`, "g"),
            check: (m) => {
                const to = UNABLE[unableKey(m[1])];
                if (to && m[1] === "احتراز") {
                    return { message: `«غیرقابل احتراز» گرته‌برداری از inevitable است؛ «${to}»، «ناگزیر» یا «گریزناپذیر»`, replacement: to, source: N("۲۸۴"), certain: true };
                }
                return to ? { message: `«غیرقابل …» دراز و متکلّفانه است؛ «${to}»`, replacement: to, source: S("۱۷۵"), certain: true } : null;
            }
        },
        {
            pattern: new RegExp(`${START}طبق${Z}(گزارش|برآورد)${END}`, "g"),
            check: (m) => ({ message: `«به ${m[1]}» کوتاه‌تر و رساتر است`, replacement: `به ${m[1]}`, source: S("۱۷۵") })
        },
        {
            pattern: new RegExp(`${START}منطبق با${END}`, "g"),
            check: () => ({ message: "«منطبق» با «بر» می‌آید: «منطبق بر»", replacement: "منطبق بر", source: S("۱۶۳"), certain: true })
        },
        {
            pattern: new RegExp(`${START}را استفاده (?:کرد|کردند|کرده|کردیم|کردم|می${Z}?کند|می${Z}?کنند|می${Z}?کنیم|کنند|کند|کنید)${END}`, "g"),
            // «را استفاده کرد» → «را به کار برد»: the object stays where it is
            check: (m) => {
                const v = m[0].replace(/^را استفاده /, "");
                const to = "را به کار " + v.replace(/کرد/, "برد").replace(/کن(?=د|ند|یم|ید)/, "بر");
                return { message: "«استفاده کردن» با «از» می‌آید، نه «را» («از … استفاده کرد»)؛ «را به کار برد» هم رساست", replacement: to, fix: false, source: S("۱۶۸") };
            }
        },
        {
            pattern: new RegExp(`${START}قابلِ?${Z}?اهمیت${END}`, "g"),
            check: () => ({ message: "«قابل اهمیت» نادرست است؛ «مهم» یا «درخور توجه»", replacement: "مهم", source: S("۱۶۹"), certain: true })
        },
        {
            pattern: new RegExp(`${START}الاهم فی الاهم${END}`, "g"),
            check: () => ({ message: "درست آن «الاهم فالاهم» است", replacement: "الاهم فالاهم", source: S("۱۶۹"), certain: true })
        },
        {
            pattern: new RegExp(`${START}سر به فرمان${END}`, "g"),
            // not certain: «سر به فرمان کسی سپردن/نهادن» (to submit) is another idiom
            check: () => ({ message: "«گوش به فرمان» درست است، نه «سر به فرمان»", replacement: "گوش به فرمان", source: S("۱۷۰") })
        },
        {
            pattern: new RegExp(`${START}انجام (گرفته|شده) شده${END}`, "g"),
            check: (m) => ({ message: "مجهول دوگانه نادرست است", replacement: `انجام ${m[1]}`, source: S("۱۸۵"), certain: true })
        },
        {
            pattern: new RegExp(`${START}کنکاش${END}`, "g"),
            check: () => ({ message: "«کنکاش» (درست‌تر: کنگاش) یعنی «مشورت»؛ در معنای جست‌وجو «کاوش» یا «تفحص»", replacement: "کاوش", alternatives: ["تفحص", "کنگاش"], fix: false, source: S("۱۶۰") })
        },
        {
            pattern: new RegExp(`${START}معرّ?ف حضور`, "g"),
            check: () => ({ message: "«معروف حضور» درست است، نه «معرف حضور»", replacement: "معروف حضور", source: S("۱۶۱"), certain: true })
        },
        {
            pattern: new RegExp(`${START}(تسلیت|تهنیت) باد${END}`, "g"),
            check: (m) => ({ message: `«${m[1]} باد» نادرست است (مثل «تبریک باد»): «${m[1]} می‌گوییم»، «${m[1]} عرض می‌کنیم» یا «${m[1]} می‌گویم»`, replacement: `${m[1]} می‌گوییم`, source: S("۱۵۶"), certain: true })
        },
        {
            // «چون … ، لذا …»: «چون» and «لذا» both give the cause (as «اگرچه … اما» above)
            pattern: new RegExp(`${START}چون${END}[^.؟!؛،\\n]{3,160}?،\\s*(لذا${END}\\s*)`, "g"),
            check: (m) => ({
                message: "پس از «چون»، «لذا» زائد است",
                replacement: "",
                start: m[0].length - m[1].length,
                end: m[0].length,
                source: N("۱۴۹"), certain: true
            })
        },
        {
            // «فراری دادند» ← «فرار دادند»: only «فراری» changes
            pattern: new RegExp(`${START}فراری(?=${Z}(?:ن?می${Z}?|ب|ن)?(?:داد(?:ن|ند|ه|ی|یم|ید|م)?|ده(?:د|ند|ی|یم|ید|م)?)${END})`, "g"),
            check: () => ({ message: "«فراری» صفت است و «فراری دادن» بی‌معناست: «فرار دادن» (گریزاندن)", replacement: "فرار", source: N("۲۸۹"), certain: true })
        },
        {
            pattern: new RegExp(`${START}مثمر${Z}?ثمر${END}`, "g"),
            check: () => ({ message: "«مثمر» خود یعنی «ثمردهنده»؛ «مثمر ثمر» حشو است: «ثمربخش»، «سودمند» یا «مثمر»", replacement: "ثمربخش", source: N("۳۳۷"), certain: true })
        },
        {
            pattern: new RegExp(`${START}مفید${Z}?فا[یئ]ده${END}`, "g"),
            check: () => ({ message: "«مفید» خود یعنی «فایده‌دار»؛ «مفید فایده» حشو است: «مفید» یا «سودمند»", replacement: "مفید", source: N("۳۶۱"), certain: true })
        },
        {
            pattern: new RegExp(`${START}سهل و ممتنع${END}`, "g"),
            check: () => ({ message: "این ترکیب بی «و» است: «سهل ممتنع»", replacement: "سهل ممتنع", source: N("۲۳۵"), certain: true })
        },
        {
            pattern: new RegExp(`${START}(استفاده|استمداد)${Z}(${verbAlt(BORDAN)}|${verbAlt(TALABIDAN)})${END}`, "g"),
            check: (m) => {
                const key = verbKey(m[2]);
                const verb = m[1] === "استفاده" ? BORDAN[key] : TALABIDAN[key];
                if (!verb) return null;
                const why = m[1] === "استفاده" ? "«استفاده» با «کردن» می‌آید، نه «بردن»" : "«استمداد» خود یعنی «مدد طلبیدن»؛ با «کردن» می‌آید";
                return { message: `${why}: «${m[1]} ${verb}»`, replacement: `${m[1]} ${verb}`, source: N("۲۴"), certain: true };
            }
        },
        {
            // «سؤالی بپرسم» ← «سؤالی بکنم» (or «چیزی بپرسم»)
            pattern: new RegExp(`${START}((?:سؤال|سوال|سئوال)(?:ی)?)${Z}(را${Z})?(${verbAlt(PORSIDAN)})${END}`, "g"),
            check: (m) => {
                const verb = PORSIDAN[verbKey(m[3])];
                if (!verb) return null;
                // «سؤالی پرسیده شد» ← not «سؤالی کرده شد»: the writer rephrases
                const passive = /^ +(?:ن?(?:شد|شده|شود|شوند|شدند)|ن?می[ ‌]?شو(?:د|ند)|خواهد شد)(?![\u0600-\u06FF‌])/.test(m.input.slice(m.index + m[0].length));
                return {
                    message: `«سؤال» خود یعنی «پرسش»؛ «سؤال پرسیدن» یعنی «پرسش پرسیدن»: «${m[1]} ${m[2] ? "را " : ""}${verb}» یا فقط «پرسیدن»`,
                    replacement: `${m[1]} ${verb}`,
                    // «این سؤال را پرسید» ← «این را پرسید»: the writer decides
                    fix: m[2] || passive ? false : undefined,
                    source: N("۲۳۴"),
                    certain: !m[2] && !passive
                };
            }
        },
        {
            pattern: new RegExp(`${START}تفهیم و تفاهم${END}`, "g"),
            check: () => ({ message: "«تفاهم» خود همان «تفهیم و تفهم» است: «تفاهم» یا «تفهیم و تفهم»", replacement: "تفاهم", source: N("۱۰۹"), certain: true })
        },
        {
            pattern: new RegExp(`${START}ید${Z}?طولانی${END}`, "g"),
            check: () => ({ message: "«ید طولا» درست است، نه «ید طولانی»", replacement: "ید طولا", source: N("۴۲۵"), certain: true })
        }
    ]
}));
