/*
 * املای شکل شکسته (since 1.5.0), in spoken sentences only (the page finds them by itself).
 *
 * - «میگه، میرم، میدم، نمیدونم» ← «می‌گه، می‌رم، می‌دم، نمی‌دونم»: «می» با نیم‌فاصله به فعل
 *   می‌چسبد، در شکل شکسته هم (دستور خط، «می و همی»، ص ۳۹). Not the «-ون» verbs the over-broken
 *   rule writes in full («بخونمش» ← «بخوانمش»).
 * - «توصورتم» ← «تو صورتم»: «تو» (در) جدا از واژهٔ بعد. A judgement (it may be a word), yellow.
 */
import { createPatternRule } from "../../../textlint-rule-preset-farhangestan/src/util/pattern-rule";
import { START, END, LETTER } from "../../../textlint-rule-preset-farhangestan/src/util/persian";
import { isKnown } from "../../../textlint-rule-preset-farhangestan/src/util/words";
import { spoken, knownish } from "../../../textlint-rule-preset-farhangestan/src/util/colloquial";
import { corpusBucket } from "../../../textlint-rule-preset-farhangestan/src/util/speller";

const Z = "‌";

export default createPatternRule(() => ({
    source: "دستور خط، «می و همی»، ص ۳۹",
    checks: [
        {
            pattern: new RegExp(`${START}(ن?می)(${LETTER}{2,})${END}`, "g"),
            check: (m) => {
                const s = spoken(m[0]);
                if (!s || !/^ن?می‌/.test(s.formal)) return null;
                if (/^(?!تون).*ون(م|ی|ه|یم|ین|ن)?$/.test(m[2])) return null; // «میدونم»: the over-broken rule's
                const fixed = m[1] + Z + m[2];
                return { message: `در شکل شکسته هم «${m[1]}» با نیم‌فاصله به فعل می‌چسبد: «${fixed}»`, replacement: fixed };
            }
        },
        {
            // «توصورتم» → «تو صورتم»
            pattern: new RegExp(`${START}تو(${LETTER}{3,})${END}`, "g"),
            check: (m) => {
                if (isKnown(m[0]) || (corpusBucket(m[0]) ?? -1) >= 4 || !(knownish(m[1]) || spoken(m[1]))) return null;
                const fixed = "تو " + m[1];
                return {
                    message: `اگر «تو» (به معنای «در») است، از واژۀ بعد جدا نوشته می‌شود: «${fixed}»`,
                    replacement: fixed,
                    fix: false,
                    source: "دستور خط، «حروف اضافه»؛ اصول شکسته‌نویسی"
                };
            }
        }
    ]
}));
