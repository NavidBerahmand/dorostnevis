import TextLintTester from "textlint-tester";
import rule from "../src/rules/bi-prefix";
import { inv, z } from "./helpers";

new TextLintTester().run("bi-prefix", rule, {
    valid: [
        z("بی‹تردید، بی‹توجّه، بی‹حاصل، بی‹حساب، بی‹حوصله، بی‹جهت، بی‹قرار"), // p. 39
        "بیچاره، بیداد، بیدل، بیراه، بیزار، بیعار، بیکار، بینوا",                // exceptions, p. 39
        "بی هیچ چشمداشتی کار کرد.",                                              // preposition, p. 39
        "بی آنکه چیزی بگوید رفت.",
        z("مردی بی‹هوش و بی‹خرد"),                                               // بی‌هوش is valid in another sense
        "بیمار، بیرون، بیگانه، بیهوده، بیست، بیان",                              // real words
        "بیهوش شد. بیجا گفت. بیخود نگران است."                                   // book exceptions, never separated
    ],
    invalid: [
        { text: "بینشان فاصله بود", output: "بینشان فاصله بود", errors: [{}] }, // «بین» + «شان» too

        inv("کاری بی دلیل کرد.", z("کاری بی‹دلیل کرد.")),
        inv("مرد بی چاره", "مرد بیچاره"),
        inv(z("آدم بی‹کار"), "آدم بیکار"),
        inv("کاری بیدلیل", z("کاری بی‹دلیل")),
        inv("بیشک درست است", z("بی‹شک درست است")),
        inv(z("بیدلیل‹اند"), z("بی‹دلیل‹اند"))
    ]
});
