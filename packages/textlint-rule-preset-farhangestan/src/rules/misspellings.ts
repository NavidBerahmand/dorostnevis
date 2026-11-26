/*
 * غلط‌های املایی رایج (نکته‌های ویرایش، علی صلح‌جو، ص ۳۰–۳۱)
 *
 * - «راجب» ← «راجع»
 * - «تکه کلام» ← «تکیه‌کلام» (کسرهٔ اضافه افتاده: نیم‌فاصله، دستور خط، ترکیب‌ها)
 * - «چکنویس» ← «چرک‌نویس»؛ «چک‌نویس» فقط پیشنهاد، چون «نویسندهٔ چک» هم هست
 * - «فلان و به همان» ← «فلان و بهمان»
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, ZWNJ, WORD_CHAR } from "../util/persian";

const S = (page: string) => `نکته‌های ویرایش، علی صلح‌جو، ص ${page}`;

export default createPatternRule(() => ({
    source: S("۳۱"),
    checks: [
        {
            pattern: new RegExp(`${START}راجب${END}`, "g"),
            check: () => ({ message: "«راجع» درست است، نه «راجب»: «راجع به»", replacement: "راجع", source: S("۳۱") })
        },
        {
            // «تکه کلام»، «تکه‌کلامش»
            pattern: new RegExp(`${START}تکه[ ${ZWNJ}]?کلام(?=${WORD_CHAR}*${END})`, "g"),
            check: () => ({ message: "«تکیه‌کلام» درست است، نه «تکه کلام»", replacement: `تکیه${ZWNJ}کلام`, source: S("۳۱") })
        },
        {
            pattern: new RegExp(`${START}چک(${ZWNJ}?)نویس(?=${WORD_CHAR}*${END})`, "g"),
            check: (m) => ({
                message: m[1]
                    ? "اگر منظور نوشتهٔ پیش از پاک‌نویس است، «چرک‌نویس» درست است"
                    : "«چرک‌نویس» درست است، نه «چکنویس»",
                replacement: `چرک${ZWNJ}نویس`,
                fix: !m[1],
                source: S("۳۰")
            })
        },
        {
            pattern: new RegExp(`${START}فلان و به همان${END}`, "g"),
            check: () => ({ message: "«بهمان» یک کلمه است: «فلان و بهمان»", replacement: "فلان و بهمان", source: S("۳۰") })
        }
    ]
}));
