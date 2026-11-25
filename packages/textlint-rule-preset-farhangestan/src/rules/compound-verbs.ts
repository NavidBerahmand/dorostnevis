/*
 * مصدرهای مرکّب و فعل‌های گروهی
 *
 * دستور خط، ترکیب‌ها، ج-۲ (ص ۶۷–۶۸):
 *   در مصدرهای مرکّب و مصدرهای گروهی، همکرد (به‏صورت مصدری یا صرف‏شده) با
 *   یک فاصلۀ کامل از جزء غیرهمکرد نوشته می‏شود: اختصاص دادن، اختصاص داده
 *   بودیم، به دست آوردن، سخن گفتن، سخن گفتم
 *   تبصرۀ ۱: صورت‏های مشتق … (اسم‌مصدرها، صفت‏های فاعلی و مفعولی) با
 *   نیم‌فاصله: تصمیم‏گیرنده، فیلم‌برداری، یاری‏دهنده
 *
 * - «صحبت‌کرد»، «صحبت‌می‌کنیم»، «تمام‌شدن» (نیم‌فاصله) ← «صحبت کرد»…
 * - فقط صورت‌های صرف‌شده و مصدرِ همکردهای «کردن، شدن، نمودن، گردیدن، دادن،
 *   گرفتن، داشتن، زدن، گفتن، یافتن».
 *   صفت مفعولی («ساخته‌شده»، «تمام‌شده») عمداً گرفته نمی‌شود، چون طبق تبصرهٔ ۱
 *   با نیم‌فاصله درست است.
 * - اگر شکل پیوسته واژهٔ شناخته‌شده‌ای باشد («عملکرد»، «رویکرد») دست نمی‌خورد.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../util/persian";
import { isKnown, isDictionaryWord } from "../util/words";

const SOURCE = "دستور خط، ترکیب‌ها، ج-۲، ص ۶۷–۶۸";

// «دادن، گرفتن، داشتن، زدن، گفتن، یافتن» too, but not their bare present stems,
// which are also suffixes («-ده»، «-گیر»، «-دار»، «-زن»، «-گو»، «-یاب»)
const PAST_STEMS = ["کرد", "شد", "نمود", "گردید", "داد", "گرفت", "داشت", "زد", "گفت", "یافت"];
const PRESENT_STEMS = ["کن", "شو", "نما", "گرد", "ده", "گیر", "دار", "زن", "گوی", "یاب"];
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

// subjunctive without «ب» («صحبت‌کنم»، «ساخته‌شود»). Only کن/شو: «-گرد» and «-نما»
// are also suffixes («جهان‌گرد»، «جهان‌نما»).
for (const s of ["کن", "شو"]) {
    for (const p of PRESENT_PERSON) FORMS.add(s + p);
}

const ALTERNATION = [...FORMS].sort((a, b) => b.length - a.length).join("|");

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            pattern: new RegExp(`${START}(${LETTER}{2,})${ZWNJ}(${ALTERNATION})${END}`, "g"),
            check: (m) => {
                const [, noun, verb] = m;
                if (isKnown(noun + verb)) return null; // «عملکرد»، «رویکرد»
                if (verb.endsWith("ی") && isKnown(noun + verb.slice(0, -1))) return null; // «روی‌کردی» = «رویکرد» + «ی»
                if (ZWNJ_NOUNS.has(m[0])) return null;
                if (isDictionaryWord(m[0])) return null; // «خوش‌نمود»، «برون‌شد»: dictionary words, not verbs
                // «می‌شد» is one verb (also with Arabic «ي/ى»); «دربرمی‌گرفت»: a preverb before «می»
                if (/(^|^(بر|در|باز|فرا|فرو|ور|وا|دربر))ن?م[یيى]$|^هم[یيى]$/.test(noun)) return null;
                return {
                    message: `همکرد «${verb}» با فاصلهٔ کامل از «${noun}» نوشته می‌شود`,
                    replacement: `${noun} ${verb}`
                };
            }
        }
    ]
}));
