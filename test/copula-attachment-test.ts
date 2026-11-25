import TextLintTester from "textlint-tester";
import rule from "../src/rules/copula-attachment";
import { inv, z } from "./helpers";

new TextLintTester().run("copula-attachment", rule, {
    valid: [
        z("خسته‹ام، خسته‹ای، خسته است، خسته‹ایم، خسته‹اید، خسته‹اند"), // p. 42
        z("ایرانی‹ام، ایرانی است، ایرانی‹اند"),
        "گفتی ای دوست که می‌آیی",   // vocative «ای»
        "کوه ام"                       // pronounced «ه»: left alone
    ],
    invalid: [
        inv("من خسته ام.", z("من خسته‹ام.")),
        inv("خانه ای خریدند.", z("خانه‹ای خریدند.")),
        inv("ایرانی اند", z("ایرانی‹اند")),
        inv("خانه اش بزرگ است.", z("خانه‹اش بزرگ است."))
    ]
});
