import normalizeCharacters from "./rules/normalize-characters";
import zwnjCleanup from "./rules/zwnj-cleanup";
import miPrefix from "./rules/mi-prefix";
import biPrefix from "./rules/bi-prefix";
import pluralHa from "./rules/plural-ha";
import tarTarin from "./rules/tar-tarin";
import ezafeHe from "./rules/ezafe-he";
import copulaAttachment from "./rules/copula-attachment";
import lexicon from "./rules/lexicon";
import joinedWords from "./rules/joined-words";
import compoundVerbs from "./rules/compound-verbs";
import numbers from "./rules/numbers";
import verbPrefixAlef from "./rules/verb-prefix-alef";
import hamzaTanvin from "./rules/hamza-tanvin";
import arabicPrefixes from "./rules/arabic-prefixes";
import dictionary from "./rules/dictionary";
import wordSpacing from "./rules/word-spacing";

export default {
    rules: {
        "normalize-characters": normalizeCharacters,
        "zwnj-cleanup": zwnjCleanup,
        "mi-prefix": miPrefix,
        "bi-prefix": biPrefix,
        "plural-ha": pluralHa,
        "tar-tarin": tarTarin,
        "ezafe-he": ezafeHe,
        "copula-attachment": copulaAttachment,
        lexicon,
        "joined-words": joinedWords,
        "compound-verbs": compoundVerbs,
        "numbers": numbers,
        "verb-prefix-alef": verbPrefixAlef,
        "hamza-tanvin": hamzaTanvin,
        "arabic-prefixes": arabicPrefixes,
        "word-spacing": wordSpacing,
        dictionary
    },
    rulesConfig: {
        "normalize-characters": true,
        "zwnj-cleanup": true,
        "mi-prefix": true,
        "bi-prefix": true,
        "plural-ha": true,
        "tar-tarin": true,
        "ezafe-he": true,
        "copula-attachment": true,
        lexicon: true,
        "joined-words": true,
        "compound-verbs": true,
        "numbers": true,
        "verb-prefix-alef": true,
        "hamza-tanvin": true,
        "arabic-prefixes": true,
        "word-spacing": true,
        dictionary: true
    }
};
