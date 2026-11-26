import TextLintTester from "textlint-tester";
import rule from "../src/rules/misspellings";
import { inv, z } from "./helpers";

new TextLintTester().run("misspellings", rule, {
    valid: ["راجع به این کتاب", z("تکیه‹کلام او"), z("چرک‹نویس نامه"), "فلان و بهمان", "به همان اندازه", "تکه‌ای از کلام او"],
    invalid: [
        inv("راجب به این کتاب", "راجع به این کتاب"),
        inv("تکه کلامش این بود", z("تکیه‹کلامش این بود")),
        inv("چکنویس نامه", z("چرک‹نویس نامه")),
        { text: z("چک‹نویس نامه"), output: z("چک‹نویس نامه"), errors: [{}] },
        inv("فلان و به همان نویسنده", "فلان و بهمان نویسنده")
    ]
});
