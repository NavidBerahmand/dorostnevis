/**
 * Shared word lists.
 *
 * - KNOWN: every word Hazm has seen in its corpus (frequency > 0). A token in
 *   this set is never rewritten by a «joined form» check, which is what keeps
 *   «میدان», «بیمار», «دفتر» safe.
 * - BOOK_JOINED: every word دستور خط explicitly writes joined. The book wins
 *   over Hazm: these are never split.
 * - Every form listed in فرهنگ املایی (1394) also counts as known, so the
 *   heuristic rules never rewrite a dictionary spelling; the dictionary rule
 *   decides those.
 */
import hazmWords from "../dict/hazm-words.json";
import bookJoined from "../dict/book-joined.json";
import farhang from "../dict/farhang-emlaei.json";
import overrides from "../dict/farhang-v2-overrides.json";

type FarhangRow = [string | null, string[], number];
export const FARHANG: Readonly<Record<string, FarhangRow>> = farhang.entries as unknown as Record<string, FarhangRow>;
/** Dictionary spellings the 2nd edition of دستور خط overrides: skeleton → 2nd-edition form. */
export const FARHANG_OVERRIDES: Readonly<Record<string, string>> = overrides.overrides as unknown as Record<string, string>;

const known = new Set<string>(hazmWords.words);
for (const [preferred, others] of Object.values(FARHANG)) {
    if (preferred) known.add(preferred);
    for (const f of others) known.add(f);
}
for (const f of Object.values(FARHANG_OVERRIDES)) known.add(f);
export const KNOWN: ReadonlySet<string> = known;

const dictionaryForms = new Set<string>();
for (const [preferred, others] of Object.values(FARHANG)) {
    if (preferred) dictionaryForms.add(preferred);
    for (const f of others) dictionaryForms.add(f);
}

/**
 * Listed in فرهنگ املایی or written joined by دستور خط. Stricter than
 * isKnown(): Hazm's corpus also contains common misspellings («آنها»).
 */
export function isDictionaryWord(word: string): boolean {
    return dictionaryForms.has(word) || BOOK_JOINED.has(word);
}

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
