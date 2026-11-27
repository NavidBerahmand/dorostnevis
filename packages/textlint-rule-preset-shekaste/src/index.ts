import overBroken from "./rules/over-broken";
import mayBreak from "./rules/may-break";
import spokenSpelling from "./rules/spoken-spelling";
import spokenWord from "./rules/spoken-word";

/** Rules for the written sentences of a text that has spoken ones too (since 1.5.0). */
export const formalRules = { "spoken-word": spokenWord };

/**
 * Rules for dialogue in fiction («اصول شکسته‌نویسی»). Use together with
 * textlint-rule-preset-farhangestan, which keeps applying to every word.
 */
export default {
    rules: {
        "over-broken": overBroken,
        "may-break": mayBreak,
        "spoken-spelling": spokenSpelling
    },
    rulesConfig: {
        "over-broken": true,
        "may-break": true,
        "spoken-spelling": true
    }
};
