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
 */
import { createPatternRule, START, END, ZWNJ } from "../shared";

const S = (page: string) => `نگارش و ویرایش، احمد سمیعی گیلانی، ص ${page}`;
const Z = `[ ${ZWNJ}]`;
// «غیرقابلِ X» ← the farhang's «-ناپذیر» form
const UNABLE: Record<string, string> = {
    انکار: "انکارناپذیر", اجتناب: `اجتناب${ZWNJ}ناپذیر`, بازگشت: `بازگشت${ZWNJ}ناپذیر`,
    [`پیش${ZWNJ}بینی`]: `پیش${ZWNJ}بینی${ZWNJ}ناپذیر`, تحمل: `تحمل${ZWNJ}ناپذیر`, توصیف: `وصف${ZWNJ}ناپذیر`,
    جبران: `جبران${ZWNJ}ناپذیر`, تغییر: "تغییرناپذیر", تفکیک: `تفکیک${ZWNJ}ناپذیر`, نفوذ: "نفوذناپذیر",
    بخشش: "نابخشودنی", باور: "باورنکردنی", شکست: `شکست${ZWNJ}ناپذیر`, مقایسه: `مقایسه${ZWNJ}ناپذیر`
};
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
                    source: S("۱۵۴")
                };
            }
        },
        {
            pattern: new RegExp(`${START}آنچه که${END}`, "g"),
            check: () => ({ message: "«که» پس از «آنچه» زائد است", replacement: "آنچه", source: S("۱۵۴") })
        },
        {
            pattern: new RegExp(`${START}با این وجود${END}`, "g"),
            check: () => ({ message: "«با این وجود» نادرست است؛ «باوجوداین»، «با این همه» یا «با این وصف»", replacement: "باوجوداین", source: S("۱۵۵") })
        },
        {
            pattern: new RegExp(`${START}در ارتباط با${END}`, "g"),
            check: () => ({ message: "«در ارتباط با» تعبیر اداری و عاریتی است؛ بسته به معنا «دربارهٔ» یا «در مورد»", fix: false, source: S("۱۵۷") })
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
            check: () => ({ message: "«نظرات» جمع «نظره» است، نه «نظر»؛ «نظرها» (یا «نظرهای …») یا «آرا»", replacement: "نظرها", fix: false, source: S("۱۶۱") })
        },
        {
            pattern: new RegExp(`${START}لازم به (?:ذکر|یادآوری|توضیح) است${END}`, "g"),
            check: () => ({ message: "«لازم به ذکر است» نامطلوب است؛ «باید یادآور شد» یا «یادآوری این نکته لازم است»", fix: false, source: S("۱۶۰") })
        },
        {
            pattern: new RegExp(`${START}غیر${Z}?قابلِ?${Z}?(${Object.keys(UNABLE).map((k) => k.replace(ZWNJ, Z)).join("|")})${END}`, "g"),
            check: (m) => {
                const to = UNABLE[unableKey(m[1])];
                return to ? { message: `«غیرقابل …» دراز و متکلّفانه است؛ «${to}»`, replacement: to, source: S("۱۷۵") } : null;
            }
        },
        {
            pattern: new RegExp(`${START}طبق${Z}(گزارش|برآورد)${END}`, "g"),
            check: (m) => ({ message: `«به ${m[1]}» کوتاه‌تر و رساتر است`, replacement: `به ${m[1]}`, source: S("۱۷۵") })
        },
        {
            pattern: new RegExp(`${START}منطبق با${END}`, "g"),
            check: () => ({ message: "«منطبق» با «بر» می‌آید: «منطبق بر»", replacement: "منطبق بر", source: S("۱۶۳") })
        },
        {
            pattern: new RegExp(`${START}را استفاده (?:کرد|کردند|کرده|کردیم|کردم|می${Z}?کند|می${Z}?کنند|می${Z}?کنیم|کنند|کند|کنید)${END}`, "g"),
            check: () => ({ message: "«استفاده کردن» با «از» می‌آید، نه «را»: «از … استفاده کرد»", fix: false, source: S("۱۶۸") })
        },
        {
            pattern: new RegExp(`${START}قابلِ?${Z}?اهمیت${END}`, "g"),
            check: () => ({ message: "«قابل اهمیت» نادرست است؛ «مهم» یا «درخور توجه»", replacement: "مهم", source: S("۱۶۹") })
        },
        {
            pattern: new RegExp(`${START}الاهم فی الاهم${END}`, "g"),
            check: () => ({ message: "درست آن «الاهم فالاهم» است", replacement: "الاهم فالاهم", source: S("۱۶۹") })
        },
        {
            pattern: new RegExp(`${START}سر به فرمان${END}`, "g"),
            check: () => ({ message: "«گوش به فرمان» درست است، نه «سر به فرمان»", replacement: "گوش به فرمان", source: S("۱۷۰") })
        },
        {
            pattern: new RegExp(`${START}انجام (گرفته|شده) شده${END}`, "g"),
            check: (m) => ({ message: "مجهول دوگانه نادرست است", replacement: `انجام ${m[1]}`, source: S("۱۸۵") })
        },
        {
            pattern: new RegExp(`${START}کنکاش${END}`, "g"),
            check: () => ({ message: "«کنکاش» (درست‌تر: کنگاش) یعنی «مشورت»؛ در معنای جست‌وجو «کاوش» یا «تفحص»", fix: false, source: S("۱۶۰") })
        },
        {
            pattern: new RegExp(`${START}معرّ?ف حضور`, "g"),
            check: () => ({ message: "«معروف حضور» درست است، نه «معرف حضور»", replacement: "معروف حضور", source: S("۱۶۱") })
        },
        {
            pattern: new RegExp(`${START}(?:تسلیت|تهنیت) باد${END}`, "g"),
            check: () => ({ message: "«تسلیت باد» نادرست است (مثل «تبریک باد»)؛ «تسلیت می‌گوییم»", fix: false, source: S("۱۵۶") })
        }
    ]
}));
