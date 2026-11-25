/*
 * مصدرهای مرکّب و فعل‌های گروهی
 *
 * دستور خط، ترکیب‌ها، ج-۲ (ص ۶۸):
 *   در مصدرهای مرکّب و مصدرهای گروهی، همکرد (به‏صورت مصدری یا صرف‏شده) با
 *   یک فاصلۀ کامل از جزء غیرهمکرد نوشته می‏شود: اختصاص دادن، اختصاص داده
 *   بودیم، به دست آوردن، سخن گفتن، سخن گفتم
 *   تبصرۀ ۱: صورت‏های مشتق … (اسم‌مصدرها، صفت‏های فاعلی و مفعولی) با
 *   نیم‌فاصله: تصمیم‏گیرنده، فیلم‌برداری، یاری‏دهنده
 *
 * - «صحبت‌کرد»، «صحبت‌می‌کنیم»، «تمام‌شدن» (نیم‌فاصله) ← «صحبت کرد»…
 * - فقط صورت‌های صرف‌شده و مصدرِ همکردهای «کردن، شدن، نمودن، گردیدن».
 *   صفت مفعولی («ساخته‌شده»، «تمام‌شده») عمداً گرفته نمی‌شود، چون طبق تبصرهٔ ۱
 *   با نیم‌فاصله درست است.
 * - اگر شکل پیوسته واژهٔ شناخته‌شده‌ای باشد («عملکرد»، «رویکرد») دست نمی‌خورد.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../util/persian";
import { isKnown, isDictionaryWord } from "../util/words";

const SOURCE = "دستور خط، ترکیب‌ها، ج-۲، ص ۶۸";

const PAST_STEMS = ["کرد", "شد", "نمود", "گردید"];
const PRESENT_STEMS = ["کن", "شو", "نما", "گرد"];
const PERSON = ["", "م", "ی", "یم", "ید", "ند"];
const PRESENT_PERSON = ["م", "ی", "د", "یم", "ید", "ند"];

const FORMS = new Set<string>();
for (const s of PAST_STEMS) {
    FORMS.add(s + "ن"); // infinitive
    for (const p of PERSON) FORMS.add(s + p);
}
for (const s of PRESENT_STEMS) {
    for (const p of PRESENT_PERSON) {
        FORMS.add("می" + ZWNJ + s + p);
        FORMS.add("نمی" + ZWNJ + s + p);
    }
}
/** Nouns the book writes with a ZWNJ (ج-۲، تبصرهٔ ۲، استثنا). */
const ZWNJ_NOUNS = new Set(["برون‌رفت", "بوم‌نگاشت", "بیرون‌شد", "ته‌نشست"]);

const ALTERNATION = [...FORMS].sort((a, b) => b.length - a.length).join("|");

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            pattern: new RegExp(`${START}(${LETTER}{2,})${ZWNJ}(${ALTERNATION})${END}`, "g"),
            check: (m) => {
                const [, noun, verb] = m;
                if (isKnown(noun + verb)) return null; // «عملکرد»، «رویکرد»
                if (ZWNJ_NOUNS.has(m[0])) return null;
                if (isDictionaryWord(m[0])) return null; // «خوش‌نمود»، «برون‌شد»: dictionary words, not verbs
                if (/^(ن?می|همی)$/.test(noun)) return null; // «می‌شد» is one verb
                return {
                    message: `همکرد «${verb}» با فاصلهٔ کامل از «${noun}» نوشته می‌شود`,
                    replacement: `${noun} ${verb}`
                };
            }
        }
    ]
}));
