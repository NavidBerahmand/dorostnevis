/**
 * The colloquial word bank (since 1.6.2, the owner's decision): «از متن‌های محاوره‌ای که درآوردی یه
 * بانک لغت‌های محاوره‌ای درست کن؛ در متنی که محاوره‌ای تشخیص داده شد، اون‌جوری نوشته بودن صحیحه.»
 *
 * Spoken forms mined from Persian blogs and forums (dict/colloquial-bank.json: how it was built), each
 * correctly spelled (the half-space of «می‌»، «ذ» in «بذار»، «خوا»، «آ»: the misspelled forms are not in it
 * and are still marked). In a spoken sentence a bank word gets no spelling, ezafe or register card; in a
 * written one, a recommendation (blue) with its written form when the bank has a reliable one
 * («دیگه» ← «دیگر»، «می‌خوام» ← «می‌خواهم»), and no card when it has none («منم»: «من هم» or «من هستم»).
 */
import bank from "../dict/colloquial-bank.json";

const WORDS = new Map<string, string[]>(Object.entries((bank as { words: Record<string, string[]> }).words));
const norm = (w: string) => w.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/^\u200c+|\u200c+$/g, "");

/** Is `w` a spoken word of the bank (spelled as it should be)? */
export const inBank = (w: string): boolean => WORDS.has(norm(w));
/** The bank's written form(s) of `w`: [] when no form is reliable, null when `w` is not in the bank. */
export const bankFormal = (w: string): string[] | null => WORDS.get(norm(w)) ?? null;
/** How many words the bank has (for the page's about text and the tests). */
export const BANK_SIZE = WORDS.size;
