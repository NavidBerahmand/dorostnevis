/**
 * Compound words made with a number written in digits, which دستور خط writes joined to it
 * (ترکیب‌ها، ب-۱۰-الف، ص ۶۵: «واژه‌های مرکّبی که در آن‌ها عدد به کار رفته باشد با
 * نیم‌فاصله/ بی‌فاصله نوشته می‌شود: ۴۷سالگی …»).
 *
 * One list for two rules, so they cannot disagree: «numbers» joins «۷۵ درصدی» → «۷۵درصدی»,
 * and «punctuation» (the convention «۵ سال», not in the book) never asks for the space back.
 */
export const NUMBER_COMPOUNDS = ["سالگی", "ساله", "ماهه", "روزه", "سالة", "درصدی", "نفره", "طبقه", "گانه"];

/** Also left joined by the convention, though «numbers» does not require it: «۵ساعته»، «۱۰۰متری»، «۳تایی». */
const ALSO_JOINED = ["ساعته", "متری", "تایی"];

const JOINED = [...NUMBER_COMPOUNDS, ...ALSO_JOINED].sort((a, b) => b.length - a.length).join("|");
/** «درصدی»، «ساله‌ای»، «پنج‌ساله»: a word that may stay joined to the number before it. */
const JOINED_WORD = new RegExp(`^(?:${JOINED})(?:‌.*)?$|(?:${JOINED})$`);
export function joinsNumber(word: string): boolean {
    return JOINED_WORD.test(word);
}
