/*
 * «ب»، «ن»، «م» پیش از فعل‌هایی که با «ا» یا «آ» شروع می‌شوند
 *
 * دستور خط، «به»، تبصرۀ ۲ و ۳ (ص ۳۸–۳۹):
 *   هرگاه «بای زینت یا بای تأکید»، «نون نفی و نهی» یا «میم نهی» بر سر افعالی
 *   بیایند که با الفِ مفتوح یا مضموم آغاز می‌شوند … «الف» در نوشتن حذف
 *   می‌شود و به‌جای آن صامت میانجی «ی» می‌آید: بینجامد، بینداز، بینگیخت،
 *   میفکن، نیفتاد
 *   یادآوری: «الف» در مشتقّاتِ فعل «ایستادن» حذف نمی‌شود: بِایست، نَایستد
 *   تبصرۀ ۳: … افعالی که با «آ» آغاز می‌شوند … «ی» میانجی افزوده می‌شود:
 *   بیاموز، میازار، نیافرید
 *
 * - «بانداز»، «بیانداز» ← «بینداز»؛ «نافتاد» ← «نیفتاد»
 * - «بآموز»، «نآمد» ← «بیاموز»، «نیامد»
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER } from "../util/persian";
import { isKnown } from "../util/words";
import { verbForm, isPresentStem } from "./mi-prefix";

const SOURCE = "دستور خط، «به»، تبصرۀ ۲ و ۳، ص ۳۸–۳۹";

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            pattern: new RegExp(`${START}(ب|ن|م)(ی)?([اآ])(${LETTER}+)${END}`, "g"),
            check: (m) => {
                const [word, prefix, , alef, rest] = m;
                if (isKnown(word)) return null;
                // «بازاری» = «بازار» + «ی», «نادانی» = «نادان» + «ی»: not verbs
                if (word.endsWith("ی") && isKnown(word.slice(0, -1))) return null;
                if (verbForm(word) || isPresentStem(word)) return null; // «ماند» is a verb, not م + «اند»
                if (rest.startsWith("یست")) return null; // ایستادن keeps its alef: بایست
                // «نیافت» = ن + «یافت», «بیابد» = ب + «یابد»: already correct
                const afterPrefix = word.slice(1);
                if (afterPrefix.startsWith("ی") && (verbForm(afterPrefix) || isPresentStem(afterPrefix))) return null;
                const candidates = alef === "آ" ? ["آ" + rest] : ["ا" + rest, "آ" + rest];
                for (const stemForm of candidates) {
                    const form = verbForm(stemForm) ?? (isPresentStem(stemForm) ? stemForm : null); // imperative: bare stem
                    if (!form) continue;
                    const fixed = form.startsWith("آ") ? prefix + "یا" + form.slice(1) : prefix + "ی" + form.slice(1);
                    if (fixed === word) return null;
                    return {
                        message: `پیش از فعلی که با «${form[0]}» شروع می‌شود، «${prefix}» با «ی» میانجی می‌آید: «${fixed}»`,
                        replacement: fixed
                    };
                }
                return null;
            }
        }
    ]
}));
