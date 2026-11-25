/**
 * Shared word lists.
 *
 * - KNOWN: every word Hazm has seen in its corpus (frequency > 0). A token in
 *   this set is never rewritten by a «joined form» check, which is what keeps
 *   «میدان», «بیمار», «دفتر» safe.
 * - BOOK_JOINED: every word دستور خط explicitly writes joined. The book wins
 *   over Hazm: these are never split.
 */
import hazmWords from "../dict/hazm-words.json";
import bookJoined from "../dict/book-joined.json";

export const KNOWN: ReadonlySet<string> = new Set(hazmWords.words);

export const BOOK_JOINED: ReadonlySet<string> = new Set(bookJoined.groups.flatMap((g) => g.words));

export function isKnown(word: string): boolean {
    return KNOWN.has(word) || BOOK_JOINED.has(word);
}

/**
 * A final «ه» is pronounced (ملفوظ) after a long vowel (راه، کوه، فقیه) and
 * in a few short words; otherwise it is the silent «ه» of خانه، نامه.
 */
const PRONOUNCED_HE = new Set([
    "به", "مه", "ده", "ره", "شه", "که", "گره", "زره", "بزه", "فربه", "توجه", "متوجه",
    "منزه", "مشتبه", "مشبه", "تنبه", "متنبه", "فرمانده", "بازده", "سپهبد", "وجه", "شبه"
]);

export function endsWithSilentHe(word: string): boolean {
    if (!word.endsWith("ه") || word.length < 2) return false;
    if (PRONOUNCED_HE.has(word)) return false;
    const before = word[word.length - 2];
    return !(before === "ا" || before === "و" || before === "ی" || before === "آ");
}
