import TextLintTester from "textlint-tester";
import rule from "../src/rules/spelling";
import { z } from "./helpers";

const one = (text: string) => ({ text, output: text, errors: [{}] }); // suggestion only, never fixed
new TextLintTester().run("spelling", rule, {
    valid: [
        "این کتاب را در کتابخانه خواندم و به خانه رفتم.",
        z("کتاب‹هایشان را نمی‹خوانند و بی‹حوصله‹اند."),
        z("نیم‹فاصله و حاصل‹مصدرها"),
        "لورا و آندریا و کاپرا به تهران آمدند.", // names without a frequent neighbour
        "Windows و ATM74"
    ],
    invalid: [one("طایقه بزرگی بودند."), one("منظره و منثره"), one("او درکانادا زندگی می‌کند."), one("غرمجاز است.")]
});
