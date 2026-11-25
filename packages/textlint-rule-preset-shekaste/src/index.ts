import overBroken from "./rules/over-broken";
import mayBreak from "./rules/may-break";

/**
 * Rules for dialogue in fiction («اصول شکسته‌نویسی»). Use together with
 * textlint-rule-preset-farhangestan, which keeps applying to every word.
 */
export default {
    rules: {
        "over-broken": overBroken,
        "may-break": mayBreak
    },
    rulesConfig: {
        "over-broken": true,
        "may-break": true
    }
};
