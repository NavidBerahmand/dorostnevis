import TextLintTester from "textlint-tester";
import rule from "../src/rules/mi-prefix";
import { inv, z } from "./helpers";

new TextLintTester().run("mi-prefix", rule, {
    valid: [
        z("می‹افکند، می‹رود، همی‹گوید"), // examples from the book, p. 39
        "می ناب نوشید.",                   // «می» the noun (wine)
        "همی نیست اندر دوزخ، جایگاه، کافران را؟", // emphatic «همی» stays separate
        "میدان، میز، میوه، میانجی، میهمان، میراث، میلیون", // real words starting with «می»
        "مطالعات میدانی",                    // «میدانی» = field (adj.), left alone
        "درمیان جمع"
    ],
    invalid: [
        inv("او هر روز می رود.", z("او هر روز می‹رود.")),
        inv("نمی دانم چه می گفت.", z("نمی‹دانم چه می‹گفت."), 2),
        inv("ما می خواهیم", z("ما می‹خواهیم")),
        inv("او میرود.", z("او می‹رود.")),
        inv("نمیدانم.", z("نمی‹دانم.")),
        inv("میدانیم که برمیگردد.", z("می‹دانیم که برمی‹گردد."), 2),
        inv("فردا میاید.", z("فردا می‹آید.")),
        inv("هر روز میرفت.", z("هر روز می‹رفت.")),
        inv("میتوان ساده‌تر نوشت.", z("می‹توان ساده‌تر نوشت.")),
        inv("نمیتوان گفت.", z("نمی‹توان گفت."))
    ]
});
