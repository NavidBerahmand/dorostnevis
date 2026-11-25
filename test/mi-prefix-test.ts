import TextLintTester from "textlint-tester";
import rule from "../src/rules/mi-prefix";
import { inv, z } from "./helpers";

new TextLintTester().run("mi-prefix", rule, {
    valid: [
        z("می‹افکند، می‹رود، همی‹گوید"), // examples from the book, p. 39
        "می ناب نوشید.",                   // «می» the noun (wine)
        "همی نیست اندر دوزخ، جایگاه، کافران را؟" // emphatic «همی» stays separate
    ],
    invalid: [
        inv("او هر روز می رود.", z("او هر روز می‹رود.")),
        inv("نمی دانم چه می گفت.", z("نمی‹دانم چه می‹گفت."), 2),
        inv("ما می خواهیم", z("ما می‹خواهیم"))
    ]
});
