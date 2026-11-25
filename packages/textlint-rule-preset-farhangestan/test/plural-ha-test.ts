import TextLintTester from "textlint-tester";
import rule from "../src/rules/plural-ha";
import { inv, z } from "./helpers";

new TextLintTester().run("plural-ha", rule, {
    valid: [
        z("کتاب‹ها، باغ‹ها، خانه‹ها، پیش‹بینی‹ها"),
        "درها و دیوارها",
        "واژه‌های مختوم به های غیرملفوظ",   // «های» = the letter ه                  // after non-joining letters joined and separate look the same
        "تنها آمد. تنهایی سخت است. بهای نان. انتها و اشتها", // not plurals
        "درنهایت، شیربها، بااشتها",                       // dictionary words containing «ها»
        {
            text: "کتابها را خواندم.",
            options: { mode: "required-only" }
        }
    ],
    invalid: [
        inv("کتابها را خواندم.", z("کتاب‹ها را خواندم.")),
        inv("خانهها", z("خانه‹ها")),
        inv("بلیت ها کجاست", z("بلیت‹ها کجاست")),
        inv("در ها", "درها"),
        inv("ایرانیهای مقیم", z("ایرانی‹های مقیم")),
        inv("آنها آمدند و کتابهایشان را آوردند.", z("آن‹ها آمدند و کتاب‹هایشان را آوردند."), 2),
        {
            text: "خانهها",
            output: z("خانه‹ها"),
            options: { mode: "required-only" },
            errors: [{}]
        }
    ]
});
