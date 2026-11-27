/*
 * شکل گفتاری در جملهٔ رسمی (since 1.5.0), in written sentences only: «گرون» ← «گران»،
 * «چمدون‌های» ← «چمدان‌های»، «میگه» ← «می‌گوید». A recommendation (blue): the writer may mean
 * it. Sure spoken words always; a word that only fits a spoken pattern («-ون»، «-ا»، «-و»)
 * only when the corpus has never seen it (names like «ایمون»، «سالو» are left alone).
 */
import { createPatternRule } from "../../../textlint-rule-preset-farhangestan/src/util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../../../textlint-rule-preset-farhangestan/src/util/persian";
import { writtenForm } from "../../../textlint-rule-preset-farhangestan/src/util/colloquial";

export default createPatternRule(() => ({
    source: "صورت نوشتاری؛ اصول شکسته‌نویسی، علی صلح‌جو",
    checks: [
        {
            pattern: new RegExp(`(?<![A-Za-z0-9۰-۹])${START}${LETTER}[${LETTER.slice(1, -1)}${ZWNJ}]+${END}`, "g"),
            check: (m) => {
                const formal = writtenForm(m[0]);
                if (!formal) return null;
                return {
                    message: `«${m[0]}» شکل گفتاری است؛ در متن رسمی: «${formal}»`,
                    replacement: formal,
                    fix: false,
                    kind: "suggestion"
                };
            }
        }
    ]
}));
