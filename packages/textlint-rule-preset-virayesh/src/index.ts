import redundantVerbs from "./rules/redundant-verbs";
import arabicPlurals from "./rules/arabic-plurals";
import prepositions from "./rules/prepositions";
import calques from "./rules/calques";
import redundancy from "./rules/redundancy";
import repeatedWords from "./rules/repeated-words";
import longSentences from "./rules/long-sentences";

/**
 * Language editing (ویرایش زبانی): editorial advice beyond دستور خط. Every
 * report is a suggestion; where a replacement is certain the rule offers it,
 * but a writing tool should not apply these without the writer's say.
 */
export default {
    rules: {
        "redundant-verbs": redundantVerbs,
        "arabic-plurals": arabicPlurals,
        prepositions,
        calques,
        redundancy,
        "repeated-words": repeatedWords,
        "long-sentences": longSentences
    },
    rulesConfig: {
        "redundant-verbs": true,
        "arabic-plurals": true,
        prepositions: true,
        calques: true,
        redundancy: true,
        "repeated-words": true,
        "long-sentences": true
    }
};
