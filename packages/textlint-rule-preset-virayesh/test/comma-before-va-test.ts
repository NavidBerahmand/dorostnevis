import TextLintTester from "textlint-tester";
import rule from "../src/rules/comma-before-va";

new TextLintTester().run("comma-before-va", rule, {
    valid: [
        "به خانه می‌روم و گل می‌برم.",
        "آمدند، نشستند، و رفتند.",                               // a series of clauses
        "تقویمی که تقسیم شده بود، و دیگری تقویم مقدس.",           // the comma closes the «که» clause
        "اگر باران می‌بارد، و هوا سرد است، نرو.",
        "چای، قهوه، و شکر روی میز بود."
    ],
    invalid: [
        { text: "او به نماز جمعه می‌رفت، و هر شب دعا می‌خواند.", output: "او به نماز جمعه می‌رفت و هر شب دعا می‌خواند.", errors: [{}] },
        { text: "این شورش سرکوب شد، و سبب تغییر شد.", output: "این شورش سرکوب شد و سبب تغییر شد.", errors: [{}] },
        { text: "او متولد شده است، و نامش علی است.", output: "او متولد شده است و نامش علی است.", errors: [{}] }
    ]
});
