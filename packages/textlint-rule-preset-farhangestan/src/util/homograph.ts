/**
 * A «wrong» form that is also a different, correct word: «کمکم» is «کم‌کم» (به‌تدریج) or
 * «کمک» + «م» (کمکِ من); «عقبی» is «عقبا» or «عقب» + «ی»; «بینشان» is «بی‌نشان» or «بین» +
 * «شان». A homograph is never red: the rules that correct a spelling from a list (فرهنگ
 * املایی، فهرست‌های کتاب، «بی‌»، ترکیب‌ها) ask with this reading instead (since 1.4.0).
 */
import commonNouns from "../dict/hazm-common-nouns.json";
import hazmAdjectives from "../dict/hazm-adjectives.json";
import { ZWNJ } from "./persian";
import { FARHANG, FARHANG_OVERRIDES } from "./words";

const BASES = new Set<string>([
    ...commonNouns.words,
    ...hazmAdjectives.adjectives,
    // prepositions and the like that take a pronoun: «بینشان»، «پیشش»، «رویش»
    "بین", "میان", "پیش", "پشت", "زیر", "روی", "کنار", "سوی", "برای", "نزد", "جلو", "دنبال"
]);
/** Pronouns, plural, indefinite/nisba «ی», comparative: what a word may carry joined. */
const ENDINGS = ["شان", "تان", "مان", "ترین", "های", "ها", "تر", "ان", "ات", "م", "ت", "ش", "ی"];

/** How the farhang writes a word («طرفدار» → «طرف‌دار»), if it has it. */
function farhangForm(w: string): string | undefined {
    return FARHANG_OVERRIDES[w] ?? FARHANG[w]?.[0] ?? undefined;
}

/**
 * «کمک» + «م», if `word` (as typed, the letters of `target`) reads that way too; else null.
 * Not when the other reading is the same word: «طرفداری» is «طرفدار» + «ی», and «طرف‌داری» is
 * just how that is written (`correct` gives a rule's own correction of the base, «روبرو» →
 * «روبه‌رو»).
 */
export function otherReading(word: string, target: string, correct?: (base: string) => string | undefined): { base: string; ending: string } | null {
    if (word.includes(ZWNJ) || word.includes(" ")) return null;
    const first = target.split(/[‌ ]/)[0];
    for (const ending of ENDINGS) {
        if (!word.endsWith(ending)) continue;
        const base = word.slice(0, -ending.length);
        if (base.length < 2 || base === first || !BASES.has(base)) continue;
        if (target.replace(/[‌ ]/g, "") === base) continue;
        const same = [farhangForm(base), correct?.(base)].some((f) => f && (target === f + ending || target === f + ZWNJ + ending));
        if (same) continue;
        return { base, ending };
    }
    return null;
}

/** The message for a homograph: the correction first, then the other reading «… هم درست است». */
export function homographMessage(word: string, target: string, r: { base: string; ending: string }): string {
    return `اگر منظور «${target}» است، «${target}» نوشته می‌شود؛ «${word}» («${r.base}» + «${r.ending}») هم درست است`;
}
