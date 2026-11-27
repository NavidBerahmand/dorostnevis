/*
 * ترجمه‌زدگی (پیشنهاد)
 *
 * - «در رابطه با» (in relation to) ← «دربارۀ»
 * - «به چالش کشیدن» (to challenge) ← «زیر سؤال بردن، نقد کردن، به مبارزه طلبیدن»
 * - «در راستای» (in line with) ← «برای، در جهتِ، همسو با»
 * - «آتش گشودن» (to open fire) ← «تیراندازی کردن، شلیک کردن، آتش کردن»
 *   (غلط ننویسیم، ابوالحسن نجفی، ص ۲–۳)
 */
import { createPatternRule, START, END, SOURCE } from "../shared";

/** «آتش گشودند» ← «تیراندازی کردند» */
const OPEN_FIRE: Record<string, string> = {
    گشود: "کرد", گشودند: "کردند", گشوده: "کرده", گشودن: "کردن", نگشود: "نکرد", نگشودند: "نکردند",
    میگشاید: "می‌کند", میگشایند: "می‌کنند", بگشاید: "کند", بگشایند: "کنند"
};

export default createPatternRule<{ ezafe?: "he-yeh" | "he-hamza" }>((options) => {
    const darbare = options.ezafe === "he-hamza" ? "دربارهٔ" : "دربارۀ";
    return {
        source: SOURCE("ترجمه‌زدگی"),
        checks: [
            {
                pattern: new RegExp(`${START}در رابطه با${END}`, "g"),
                check: () => ({
                    message: `«در رابطه با» گرته‌برداری از in relation to است؛ «${darbare}» یا «در مورد» رساتر است`,
                    replacement: darbare,
                    alternatives: ["در مورد"]
                })
            },
            {
                pattern: new RegExp(`${START}به چالش (?:کشید|کشیدند|کشیده|کشیدن|می[‌ ]?کشد|می[‌ ]?کشند|بکشد|بکشند|کشاند|کشاندند)${END}`, "g"),
                check: (m) => {
                    // the same tense and person with «بردن» and «طلبیدن»
                    const v = m[0].replace(/^به چالش /, "").replace(/[‌ ]/g, "");
                    const BORD: Record<string, [string, string]> = {
                        کشید: ["برد", "طلبید"], کشیدند: ["بردند", "طلبیدند"], کشیده: ["برده", "طلبیده"], کشیدن: ["بردن", "طلبیدن"],
                        میکشد: ["می‌برد", "می‌طلبد"], میکشند: ["می‌برند", "می‌طلبند"], بکشد: ["ببرد", "بطلبد"], بکشند: ["ببرند", "بطلبند"],
                        کشاند: ["برد", "طلبید"], کشاندند: ["بردند", "طلبیدند"]
                    };
                    const [b, t] = BORD[v] ?? ["برد", "طلبید"];
                    return {
                        message: "«به چالش کشیدن» گرته‌برداری از to challenge است؛ بسته به معنا: «زیر سؤال بردن»، «نقد کردن»، «به مبارزه طلبیدن»",
                        replacement: `زیر سؤال ${b}`,
                        alternatives: [`به مبارزه ${t}`],
                        fix: false
                    };
                }
            },
            {
                pattern: new RegExp(`${START}در راستای(?= +([^ ]+))?`, "g"),
                // «در راستای ۶ کیلومتری»: the physical direction
                check: (m) => (/^[0-9۰-۹]/.test(m[1] ?? "") ? null : {
                    message: "«در راستای» گرته‌برداری از in line with است؛ بسته به معنا: «برای»، «در جهتِ»، «همسو با»",
                    replacement: "برای",
                    alternatives: ["در جهتِ", "همسو با"],
                    end: "در راستای".length,
                    fix: false
                })
            },
            {
                pattern: new RegExp(`${START}آتش[ ‌](گشود|گشودند|گشوده|گشودن|نگشود|نگشودند|می[ ‌]?گشاید|می[ ‌]?گشایند|بگشاید|بگشایند)${END}`, "g"),
                check: (m) => {
                    const verb = OPEN_FIRE[m[1].replace(/[ ‌]/g, "")];
                    return verb ? {
                        message: `«آتش گشودن» ترجمۀ لفظ‌به‌لفظ open fire است؛ «تیراندازی ${verb}»، «شلیک ${verb}» یا «آتش ${verb}»`,
                        replacement: `تیراندازی ${verb}`,
                        source: "غلط ننویسیم، ابوالحسن نجفی، ص ۲–۳",
                        certain: true
                    } : null;
                }
            }
        ]
    };
});
