import normalizeCharacters from "./rules/normalize-characters";
import zwnjCleanup from "./rules/zwnj-cleanup";
import miPrefix from "./rules/mi-prefix";
import biPrefix from "./rules/bi-prefix";
import pluralHa from "./rules/plural-ha";
import tarTarin from "./rules/tar-tarin";
import ezafeHe from "./rules/ezafe-he";
import copulaAttachment from "./rules/copula-attachment";
import lexicon from "./rules/lexicon";

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
        lexicon
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
        lexicon: true
    }
};
