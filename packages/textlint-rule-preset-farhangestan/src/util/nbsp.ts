/**
 * Where a no-break space (U+00A0) belongs (since 1.4.0): the two sides must not fall on two lines.
 * The punctuation rule puts it there; the invisible rule, which flags NBSP elsewhere, leaves these.
 * - a number and its unit or counter: «۱۴۰ سانت»، «۲۰ درصد» (not what the book joins: «۵ساله»)
 * - a citation abbreviation and its number: «ص ۲۳۹»، «ج ۲»
 * - a day and its month: «۲۵ مهر ۱۴۰۳» (the space before the year stays plain)
 * - the inner side of a dash between words: «موزی —|که … است|— درست»
 */
import { joinsNumber } from "./number-compounds";

const UNITS = "سال ماه روز هفته ساعت دقیقه ثانیه قرن سده درصد متر کیلومتر سانت سانتی‌متر سانتیمتر میلی‌متر میلیمتر کیلو کیلوگرم گرم تن لیتر تومان ریال دلار یورو نفر بار برابر عدد جلد صفحه هزار میلیون میلیارد".split(" ");
const MONTHS = ("فروردین اردیبهشت خرداد تیر مرداد امرداد شهریور مهر آبان آذر دی بهمن اسفند " +
    "ژانویه فوریه مارس آوریل مه ژوئن ژوئیه اوت سپتامبر اکتبر نوامبر دسامبر " +
    "محرم صفر ربیع‌الاول ربیع‌الثانی ربیع‌الآخر جمادی‌الاول جمادی‌الاولی جمادی‌الثانی جمادی‌الآخر رجب شعبان رمضان شوال ذی‌القعده ذی‌الحجه").split(" ");
export { LETTERS };
export const CITATIONS = ["صص", "ص", "ج", "ش", "ف", "ب"];
const NUM = "[0-9۰-۹٠-٩]+(?:[.,٫٬][0-9۰-۹٠-٩]+)*";
const LETTERS = "\\u0621-\\u063A\\u0641-\\u064A\\u067E\\u0686\\u0698\\u06A9\\u06AF\\u06CC\\u200c";

/** A unit or counter after a number: the word, or its plural («ساعت‌ها»), never a form the book joins. */
export function isUnit(word: string): boolean {
    if (joinsNumber(word)) return false;
    return UNITS.some((u) => word === u || word === u + "‌ها" || word === u + "ها");
}

/** [start, end) of each place an NBSP belongs in `text`, by where its space stands. */
export function nbspPlaces(text: string): Array<{ at: number; len: number; what: "unit" | "citation" | "date" }> {
    const out: Array<{ at: number; len: number; what: "unit" | "citation" | "date" }> = [];
    const unit = new RegExp(`(?<![${LETTERS}0-9۰-۹٠-٩.,٫٬\\-/:])(${NUM})([ \\u00A0]+)([${LETTERS}]+)`, "g");
    for (const m of text.matchAll(unit)) {
        const word = m[3];
        const at = m.index! + m[1].length;
        if (MONTHS.includes(word) && m[1].length <= 2) out.push({ at, len: m[2].length, what: "date" });
        else if (isUnit(word)) out.push({ at, len: m[2].length, what: "unit" });
    }
    const cite = new RegExp(`(?<![${LETTERS}])(${CITATIONS.join("|")})([ \\u00A0]+)(?=[0-9۰-۹٠-٩])`, "g");
    for (const m of text.matchAll(cite)) out.push({ at: m.index! + m[1].length, len: m[2].length, what: "citation" });
    return out;
}

/** Is the NBSP at `i` one of those places (or the inner side of a dash)? */
export function nbspBelongs(text: string, i: number): boolean {
    if ((text[i - 1] === "—" && text[i - 2] === " ") || (text[i + 1] === "—" && text[i + 2] === " ")) return true;
    return nbspPlaces(text).some((p) => p.at <= i && i < p.at + p.len);
}
