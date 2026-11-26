import redundantVerbs from "./rules/redundant-verbs";
import arabicPlurals from "./rules/arabic-plurals";
import prepositions from "./rules/prepositions";
import calques from "./rules/calques";
import redundancy from "./rules/redundancy";
import repeatedWords from "./rules/repeated-words";
import longSentences from "./rules/long-sentences";
import raPlacement from "./rules/ra-placement";
import commaBeforeVa from "./rules/comma-before-va";
import wordChoice from "./rules/word-choice";
import phrases from "./rules/phrases";

/**
 * The rules with checks marked `certain` (a flat error by its book, with a fix: «با این
 * وجود»، «مثمر ثمر»، «خطرات»…). Run with the option `part: "certain"` a rule reports only
 * those, with `part: "suggest"` only the rest; the page runs both and marks the first red.
 */
export const CERTAIN_RULES: ReadonlySet<string> = new Set(["arabic-plurals", "calques", "redundancy", "word-choice", "phrases"]);

/**
 * Language editing (ویرایش زبانی): editorial advice beyond دستور خط. Most reports are
 * suggestions for the writer to judge; the checks marked `certain` are errors by the
 * book they cite (see CERTAIN_RULES).
 */
export default {
    rules: {
        "redundant-verbs": redundantVerbs,
        "arabic-plurals": arabicPlurals,
        prepositions,
        calques,
        redundancy,
        "repeated-words": repeatedWords,
        "long-sentences": longSentences,
        "ra-placement": raPlacement,
        "comma-before-va": commaBeforeVa,
        "word-choice": wordChoice,
        phrases
    },
    rulesConfig: {
        "redundant-verbs": true,
        "arabic-plurals": true,
        prepositions: true,
        calques: true,
        redundancy: true,
        "repeated-words": true,
        "long-sentences": true,
        "ra-placement": true,
        "comma-before-va": true,
        "word-choice": true,
        phrases: true
    }
};
