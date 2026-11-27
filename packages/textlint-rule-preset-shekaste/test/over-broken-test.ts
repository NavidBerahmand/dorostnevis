import assert from "assert";
import TextLintTester from "textlint-tester";
import { TextlintKernel } from "@textlint/kernel";
import rule from "../src/rules/over-broken";
import { inv, z } from "./helpers";

/**
 * Since 1.5.1, a replacement that changes the writer's letters (the formal or fuller form of a
 * spoken word) is a suggestion (blue since 1.6.0): without the option `suggestions` (the command
 * line, here) it has no fix. Only the half-space, the letters kept, is a fix (red on the page).
 */
const ask = (text: string, count = 1) => ({ text, output: text, errors: Array.from({ length: count }, () => ({})) });

new TextLintTester().run("over-broken", rule, {
    valid: [
        z("می‹رم، می‹آم، می‹گم، می‹تونم، تونستم"),   // a syllable shorter: fine to break (p. 17)
        "دو تا نان و یک هندوانه بخر",
        "پتو، دارو، زانو",                          // real words ending in «و»
        "زن و مرد", "بیان",                         // not verbs
        z("نمی‹تونم بیام، تونستم"),                  // «تون» loses a syllable: fine
        "دریا، صدا، هوا، دکترا",                     // words ending in «ا» (دکترا = doctorate)
        "خون، خونی، روند",                           // blood, bloody, trend: not verbs
        "تو هم بیا",
        "اصلا حتما مطمئنا دقیقا",                    // tanvin left out (lexicon's), not «اصل» + plural «ا»
        "باید حفظ کنن",                              // «کنند», a verb: not «کن‌اند»
        // 1.5.2: «به» + a pronoun is never marked (the user's decision)
        "بهش بگو", "بهشون گفتم", "بهت گفتم", "بهتون گفتم", "بهم گفت", "بهمون گفت", "بهاش گفتم",
        // 1.6.0: no absurd «full» forms: «می‌گند، میش‌اند، می‌رند، می‌خواند، اصل‌اند، هار را، ارز را، بدنی‌ها»
        z("می‹گن، می‹شن، می‹رن، می‹خوان، می‹دن، میان"), "میشن", "واقعن اصلن مثلن حتمن", "کتابارو بردم", "هارو", "ارزو", "بدنیا",
        // 1.6.1: «رو» and «اون، اونو» are not marked (two readings each, a third of all the blue cards)، «انصافا» is
        // «انصافاً»، «منو» one card
        "اون گفت", "کتاب رو بده", "اونو بردم", "انصافا خوب بود",
        // 1.6.2 (the owner's decision): the book's syllable rule is not followed; these are how the spoken
        // words are written, correct in a spoken sentence (the colloquial bank)
        "دو تا نون بخر", "رفته خونه", "اگه دیگه نیاد", "شکوفه اینجا نیس", "یه خرده صبر کن", "میزو تمیز کن", "هنوزم دیر نیست", "بفرمایین تو", z("می‹کنین؟"), "بچه‌ها خارجن.", "اونا نیستن", z("می‹خورن"), z("نمی‹تونن"), z("بچه‹ها رفته‹ان"), z("رفته بودم خونه‹ی خاله‹م"), "خونۀ ما", "دیروز اومدم", "درختا خشک شد", "کتابا را آورد", "خانما خسته نباشید", "فردا بخونمش", z("نمی‹دونم"), "همان‌جا موند", "کتاب را خوندم",
    ],
    invalid: [
        // only the half-space: the spelling of the spoken form, a fix
        inv("رفتم پیش خالهم.", z("رفتم پیش خاله‹م.")), // p. 21
        inv("تهش چیزی نماند.", z("ته‹ش چیزی نماند.")) // p. 42
    ]
});

describe("over-broken on the page (option `suggestions`)", function () {
    const kernel = new TextlintKernel();
    // required here, not imported: textlint-tester is still loading the plugin when this file is
    const lint = async (text: string) => {
        const textPlugin = require("@textlint/textlint-plugin-text");
        return (
            await kernel.lintText(text, {
                ext: ".txt",
                plugins: [{ pluginId: "text", plugin: (textPlugin as any).default ?? textPlugin }],
                rules: [{ ruleId: "over-broken", rule: rule as any, options: { suggestions: true } }]
            })
        ).messages;
    };
    it("1.6.2: «اومدم»، «خانما»، «یه»: no card (the book's syllable rule is not followed)", async () => {
        for (const t of ["دیروز اومدم", "خانما خسته نباشید", "یه خرده"]) assert.strictEqual((await lint(t)).length, 0, t);
    });
    it("«تش» → «ته‌ش»: a recommendation", async () => {
        const ms = await lint("تا تش رفتم");
        assert.strictEqual(ms.length, 1);
        assert.strictEqual(ms[0].fix?.text, z("ته‹ش"));
    });
    it("«خالهم» → «خاله‌م»: a fix, not a suggestion", async () => {
        const ms = await lint("رفتم پیش خالهم.");
        assert.strictEqual(ms.length, 1);
        assert.ok(!ms[0].message.startsWith("⁣"));
        assert.strictEqual(ms[0].fix?.text, z("خاله‹م"));
    });
});
