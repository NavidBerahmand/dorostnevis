import TextLintTester from "textlint-tester";
import rule from "../src/rules/ezafe-he";
import { inv, z } from "./helpers";

new TextLintTester().run("ezafe-he", rule, {
    valid: [
        "برنامۀ روزانه، بندۀ خدا، خانۀ او، رانندۀ ماهر", // p. 47
        "راه یکی است.",
        {
            text: "خانهٔ او",
            options: { style: "he-hamza" }
        },
        // «کتابه» as the definite marker in dialogue: not an ezafe
        { text: "این کتابه خوب بود.", options: { formal: false } },
        "این کتابه که خریدم.",
        "خونه من", // spoken «خانه»: another rule's job
        "خسته من" // ends in a silent ه: a real word
    ],
    invalid: [
        inv("خانه ی من", "خانۀ من"),
        inv(z("نامه‹ی او"), "نامۀ او"),
        inv("خانهٔ او", "خانۀ او"),
        inv("کتابه من را بده.", "کتاب من را بده."),
        inv("دوسته شما آمد.", "دوست شما آمد."),
        // before other words: suggestion only
        { text: "دوسته علی آمد.", output: "دوسته علی آمد.", errors: [{}] },
        {
            text: "خانۀ او",
            output: "خانهٔ او",
            options: { style: "he-hamza" },
            errors: [{}]
        }
    ]
});
