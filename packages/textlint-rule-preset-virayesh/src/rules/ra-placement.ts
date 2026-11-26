/*
 * جای «را» (پیشنهاد)
 *
 * «را» بلافاصله پس از مفعول می‌آید، پیش از بند «که»:
 *   «کتابی که به من داده بودی را خواندم» ← «کتابی را که به من داده بودی خواندم»
 * (نکته‌های ویرایش، علی صلح‌جو، ص ۲۰)
 *
 * نشانه‌اش «را»یی است که درست پس از فعل آمده؛ فقط شکل‌هایی گرفته می‌شود که
 * جز فعل نیستند:
 * - فعل با «می/نمی»: «می‌خرید را»، «نمی‌دانست را»
 * - «است»، «بود(ند)»، «باشد»، «شد/شود» و صرف‌هایشان: «نوشته است را»، «داده بودی را»
 * - صفت مفعولی + «اند»: «رفته‌اند را»
 * فعل‌هایی که هم‌شکل اسم یا صفت‌اند («خرید»، «کرد»، «گفت»، «رفت»، «شدید»، «شوید»)
 * و «هست/نیست»
 * («هست و نیست را») عمداً بیرون مانده‌اند. جابه‌جا کردن «را» به ساخت جمله
 * بستگی دارد، پس اصلاح خودکار ندارد.
 */
import { createPatternRule, START, END, LETTER, ZWNJ } from "../shared";

const AUX = [
    "است", "بود", "بودم", "بودی", "بودیم", "بودید", "بودند",
    "باشد", "باشم", "باشی", "باشیم", "باشید", "باشند",
    "شد", "شدم", "شدی", "شدیم", "شدند", "شود", "شوند"
    // not «شدید» (severe)، «شوید» (dill)، «شوی» (husband)، «شوم» (ominous)
];
const VERB = [
    // «می‌خرید»، «نمی‌دانست»، «می خرید»
    `ن?می[${ZWNJ} ]${LETTER}+`,
    // «رفته‌اند»
    `${LETTER}+ه${ZWNJ}?اند`,
    `(?:${AUX.join("|")})`
].join("|");

export default createPatternRule(() => ({
    source: "نکته‌های ویرایش، علی صلح‌جو، ص ۲۰",
    checks: [
        {
            pattern: new RegExp(`${START}(?:${VERB}) +(را)${END}`, "g"),
            check: (m) => {
                const start = m[0].length - m[1].length;
                // the suggestion moves «را» before the «که» of the clause: «کتابی که خریدی را» → «کتابی را که خریدی»
                const sentenceStart = Math.max(...[".", "!", "؟", "?", "؛", "\n"].map((c) => m.input.lastIndexOf(c, m.index - 1))) + 1;
                const head = m.input.slice(sentenceStart, m.index);
                const k = head.search(/\S+ +که +(?!.* که )/);
                let move: { replacement: string; fixStart: number; fixEnd: number } | null = null;
                if (k >= 0) {
                    const objEnd = sentenceStart + k + head.slice(k).match(/^\S+/)![0].length;
                    const verbEnd = m.index + m[0].slice(0, start).trimEnd().length;
                    move = { replacement: " را" + m.input.slice(objEnd, verbEnd), fixStart: objEnd - m.index, fixEnd: m[0].length };
                }
                return {
                    message: "«را» پس از فعل آمده است؛ «را» بلافاصله پس از مفعول و پیش از بند «که» می‌آید: «کتابی را که … خواندم»، نه «کتابی که … را خواندم»",
                    ...(move ?? {}),
                    fix: false,
                    start,
                    end: start + 2
                };
            }
        }
    ]
}));
