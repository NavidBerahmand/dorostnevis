/*
 * ترجمه‌زدگی (پیشنهاد)
 *
 * - «در رابطه با» (in relation to) ← «دربارهٔ»
 * - «به چالش کشیدن» (to challenge) ← «زیر سؤال بردن، نقد کردن، به مبارزه طلبیدن»
 * - «در راستای» (in line with) ← «برای، در جهتِ، همسو با»
 */
import { createPatternRule, START, END, SOURCE } from "../shared";

export default createPatternRule<{ ezafe?: "he-yeh" | "he-hamza" }>((options) => {
    const darbare = options.ezafe === "he-hamza" ? "دربارهٔ" : "دربارۀ";
    return {
        source: SOURCE("ترجمه‌زدگی"),
        checks: [
            {
                pattern: new RegExp(`${START}در رابطه با${END}`, "g"),
                check: () => ({
                    message: `«در رابطه با» گرته‌برداری از in relation to است؛ «${darbare}» یا «در مورد» رساتر است`,
                    replacement: darbare
                })
            },
            {
                pattern: new RegExp(`${START}به چالش (?:کشید|کشیدند|کشیده|کشیدن|می[‌ ]?کشد|می[‌ ]?کشند|بکشد|بکشند|کشاند|کشاندند)${END}`, "g"),
                check: () => ({
                    message: "«به چالش کشیدن» گرته‌برداری از to challenge است؛ بسته به معنا: «زیر سؤال بردن»، «نقد کردن»، «به مبارزه طلبیدن»",
                    fix: false
                })
            },
            {
                pattern: new RegExp(`${START}در راستای(?= +([^ ]+))?`, "g"),
                // «در راستای ۶ کیلومتری»: the physical direction
                check: (m) => (/^[0-9۰-۹]/.test(m[1] ?? "") ? null : {
                    message: "«در راستای» گرته‌برداری از in line with است؛ بسته به معنا: «برای»، «در جهتِ»، «همسو با»",
                    fix: false
                })
            }
        ]
    };
});
