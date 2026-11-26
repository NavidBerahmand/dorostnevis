/*
 * ویرگول پیش از «و»ی میان دو جمله (پیشنهاد)
 *
 * «به خانهٔ دوستم رفتم، و برایش گل بردم» ← «… رفتم و برایش گل بردم»
 * وقتی «و» دو جمله را به هم می‌پیوندد، ویرگول پیش از آن تقلید از
 * نشانه‌گذاری انگلیسی است (نکته‌های ویرایش، علی صلح‌جو، ص ۱۵۷).
 *
 * فقط وقتی گزارش می‌شود که:
 * - کلمهٔ پیش از ویرگول فعلی است که جز فعل نیست (با «می/نمی»، صفت مفعولی
 *   + «است/بود/اند»، یا «است»، «بود(ند)»، «شد(ند)»…)؛
 * - و پیش از آن، در همان جمله، ویرگول دیگری نیامده باشد: در رشته‌ای از بندها
 *   («آمدند، نشستند، و رفتند») ویرگول پیش از «و»ی آخر روا است؛
 * - و بند پیش از ویرگول بند «که» یا بند وابسته («اگر»، «چون»، «وقتی»، «در حالی که»…)
 *   نباشد: آنجا ویرگول پایان بند را نشان می‌دهد.
 */
import { createPatternRule, START, LETTER, ZWNJ } from "../shared";

const AUX = [
    "است", "بود", "بودم", "بودی", "بودیم", "بودید", "بودند",
    "باشد", "باشند", "شد", "شدم", "شدیم", "شدند", "شود", "شوند",
    "اند", "ایم", "اید"
];
const VERB = [
    `ن?می${ZWNJ}${LETTER}+`,
    `${LETTER}+ه${ZWNJ}(?:اند|ایم|اید)`,
    `(?:${AUX.join("|")})`
].join("|");

const SUBORDINATE = new RegExp(`(?:^|[^${LETTER.slice(1, -1)}${ZWNJ}])(?:که|اگر|اگرچه|هرچند|چون|چنانچه|وقتی|زمانی|هنگامی|درحالی|در حالی)(?![${LETTER.slice(1, -1)}${ZWNJ}])`);

export default createPatternRule(() => ({
    source: "نکته‌های ویرایش، علی صلح‌جو، ص ۱۵۷",
    checks: [
        {
            pattern: new RegExp(`${START}(?:${VERB})(،)(?= و )`, "g"),
            check: (m) => {
                // the sentence so far: from the last full stop, «؟»، «!»، «؛» or line break
                const before = m.input.slice(0, m.index);
                const sentence = before.slice(Math.max(...[".", "؟", "!", "؛", "\n", ":"].map((c) => before.lastIndexOf(c))) + 1);
                if (sentence.includes("،")) return null;
                // the clause before the comma is a «که» clause or a subordinate one: the comma closes it
                if (SUBORDINATE.test(sentence)) return null;
                const start = m[0].length - 1;
                return {
                    message: "وقتی «و» دو جمله را به هم می‌پیوندد، پیش از آن ویرگول نمی‌آید",
                    replacement: "",
                    start,
                    end: start + 1
                };
            }
        }
    ]
}));
