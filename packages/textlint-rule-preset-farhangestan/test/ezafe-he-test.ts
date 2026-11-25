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
        }
    ],
    invalid: [
        inv("خانه ی من", "خانۀ من"),
        inv(z("نامه‹ی او"), "نامۀ او"),
        inv("خانهٔ او", "خانۀ او"),
        {
            text: "خانۀ او",
            output: "خانهٔ او",
            options: { style: "he-hamza" },
            errors: [{}]
        }
    ]
});
