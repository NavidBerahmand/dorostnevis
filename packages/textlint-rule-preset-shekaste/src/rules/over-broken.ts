/*
 * املای شکل شکسته: شکل کلمه حفظ شود
 *
 * اصول شکسته‌نویسی (علی صلح‌جو، نشر مرکز)، ص ۲۱ و ۴۲: کلمه‌ای که به «ه»ی ناملفوظ ختم می‌شود، در
 * شکل شکسته هم شکلش را نگه می‌دارد و ضمیر با نیم‌فاصله می‌آید:
 * - «خالهم، تهش» ← «خاله‌م، ته‌ش» (فقط نیم‌فاصله؛ حروف همان است: غلط قطعی، قرمز)
 * - «تش» ← «ته‌ش» (پیشنهاد، آبی)
 *
 * Since 1.6.2 (the owner's decision) this is all that is left of the rule. The book's syllable rule
 * («فقط کلماتی که کاهش هجایی دارند شکسته شوند»: «نون، خونه، دیگه، اگه، همون، یه، نیس، منو، کتابو،
 * کتابا، اومدم، می‌دونم، بخونمش، موند، هنوزم، بازم، می‌کنین، بفرمایین، خارجن، می‌خورن، رفته‌ان…»
 * ← their «full» forms) is not followed: those are how people write the spoken words, and in a spoken
 * sentence they are correct (the colloquial word bank, util/colloquial-bank.ts). In a written sentence a
 * spoken word gets a recommendation with its written form (spoken-word.ts).
 */
import { createPatternRule } from "../../../textlint-rule-preset-farhangestan/src/util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../../../textlint-rule-preset-farhangestan/src/util/persian";
import { KNOWN, endsWithSilentHe } from "../../../textlint-rule-preset-farhangestan/src/util/words";
import type { PatternCheck } from "../../../textlint-rule-preset-farhangestan/src/util/pattern-rule";

const BOOK = "اصول شکسته‌نویسی";

/** Letters only, without the half-space. */
const letters = (s: string) => s.replace(/‌/g, "");
/**
 * A replacement that changes the writer's letters is a recommendation (blue); one that only adds the
 * half-space and keeps the letters («خالهم» ← «خاله‌م») is the spelling of the spoken form: red (1.5.1).
 */
const choiceUnlessSpelling = ({ pattern, check }: PatternCheck): PatternCheck => ({
    pattern,
    check: (m) => {
        const r = check(m);
        if (!r || r.replacement === undefined) return r;
        const from = m[0].slice(r.start ?? 0, r.end ?? m[0].length);
        if (r.fix !== false && letters(from) === letters(r.replacement)) return r;
        return { ...r, fix: false, kind: "suggestion" };
    }
});

export default createPatternRule(() => ({
    source: BOOK,
    checks: ([
        {
            // «تش» ← «ته‌ش» (ص ۴۲)
            pattern: new RegExp(`${START}تش${END}`, "g"),
            check: () => ({ message: "شکل کلمه حفظ شود: «ته‌ش»", replacement: "ته" + ZWNJ + "ش", source: `${BOOK}، ص ۴۲` })
        },
        {
            // «خالهم، تهش» → «خاله‌م، ته‌ش»: the word keeps its shape (ص ۲۱ و ۴۲)
            pattern: new RegExp(`${START}(${LETTER}+ه)(م|ت|ش)${END}`, "g"),
            check: (m) => {
                const stem = m[1];
                if (KNOWN.has(m[0]) || !KNOWN.has(stem) || !endsWithSilentHe(stem)) return null;
                const fixed = stem + ZWNJ + m[2];
                return { message: `شکل کلمه حفظ شود: «${fixed}»`, replacement: fixed, source: `${BOOK}، ص ۲۱ و ۴۲` };
            }
        }
    ] as PatternCheck[]).map(choiceUnlessSpelling)
}));
