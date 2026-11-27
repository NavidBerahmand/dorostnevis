/**
 * The «آ» left out at the start of a word (1.5.2, extended in 1.6.0): «ادم»، «ادما»، «ازارش»، «اینده»
 * ← «آدم»، «آدما»، «آزارش»، «آینده». A closed list of words that are common only with «آ» and
 * whose «ا» form is no word (dict/alef-madd.json), and the endings they take. typing-shortcuts
 * reports it; the rules that would read such a word another way stand down («اینده» is not «این
 * ده»، «انها» is not «ان» + «ها»).
 */
import { isKnown, isDictionaryWord } from "./words";
import { spoken } from "./colloquial";
import alef from "../dict/alef-madd.json";

export const ALEF = new Set<string>((alef as { words: string }).words.split(" "));
/** Endings a word may carry after the missing «آ»: «ادما»، «ادمها»، «ازارش»، «امدند». */
const ENDINGS = ["", "ها", "های", "هایی", "ا", "ی", "ای", "م", "ت", "ش", "مان", "تان", "شان", "مون", "تون", "شون", "ند", "ید", "یم", "ن", "ین", "ه", "هایش", "هام", "هات", "هاش"];
/** Short or listed words with their own checks («ان»، «اب»: typing-shortcuts asks the context). */
const OWN_CHECK = new Set(["ان", "اب"]);

/** «ادما» → «آدما», or null. */
export function missingMadd(word: string): string | null {
    if (!word.startsWith("ا") || word.length < 3 || OWN_CHECK.has(word)) return null;
    if (isKnown(word) || isDictionaryWord(word)) return null;
    // the whole word is listed: «ارزو» (not «ارز» + «را»)
    if (ALEF.has("آ" + word.slice(1))) return "آ" + word.slice(1);
    // «اینه»، «اونه»: «این است» in speech, not «آینه»; «ارزون»: a spoken word («ارزان»), not «آرزو» + «ن»
    if (word.endsWith("ه") && isKnown(word.slice(0, -1))) return null;
    if (spoken(word)) return null;
    // a known word with an ending («استانهای» = «استان» + «های»)
    if (ENDINGS.some((e) => e && word.endsWith(e) && isKnown(word.slice(0, -e.length)))) return null;
    for (const e of ENDINGS) {
        if (!e || !word.endsWith(e)) continue;
        const stem = word.slice(0, word.length - e.length);
        if (stem.length >= 3 && ALEF.has("آ" + stem.slice(1))) return "آ" + word.slice(1);
    }
    return null;
}
