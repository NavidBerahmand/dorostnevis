import TextLintTester from "textlint-tester";
import rule from "../src/rules/plural-ha";
import { inv, z } from "./helpers";

new TextLintTester().run("plural-ha", rule, {
    valid: [
        "دو علامت منهای پی در پی",
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
        // joined is also correct: reported, never fixed (ص ۴۰)
        { text: "کتابها را خواندم.", output: "کتابها را خواندم.", errors: [{}] },
        inv("خانهها", z("خانه‹ها")),
        inv("بلیت ها کجاست", z("بلیت‹ها کجاست")),
        inv("در ها", "درها"),
        { text: "ایرانیهای مقیم", output: "ایرانیهای مقیم", errors: [{}] },
        { text: "آنها آمدند و کتابهایشان را آوردند.", output: "آنها آمدند و کتابهایشان را آوردند.", errors: [{}, {}] },
        {
            text: "خانهها",
            output: z("خانه‹ها"),
            options: { mode: "required-only" },
            errors: [{}]
        },
        // a rare «Xه» before «ایم» («هلهایم», a name): no automatic fix
        { text: "هلهایم", output: "هلهایم", errors: [{}] },

    ]
});
