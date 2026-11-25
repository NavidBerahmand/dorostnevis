import TextLintTester from "textlint-tester";
import rule from "../src/rules/lexicon";
import { inv, z } from "./helpers";

new TextLintTester().run("lexicon", rule, {
    valid: [
        "اتاق، بلیت، رئیس، ارائه، مسئله، سؤال، تأثیر",
        "آخر کار غرق شد.",            // «آخُر/غُرُق» in the book are vowel-marked; never matched
        "این خطا بود.",
        "توام",                       // تو + ـَم (you are), not توأم               // «خطا» is a word, not a variant of «ختا»
        z("هیچ‹کس، همین‹جا، هرکس، آنچه، بلکه"),
        {
            text: "تاثیر",
            options: { dictionaries: { hamza: false } }
        }
    ],
    invalid: [
        inv("اطاق", "اتاق"),
        inv("بلیط قطار", "بلیت قطار"),
        inv("رییس اداره", "رئیس اداره"),
        inv("این مساله", "این مسئله"),
        inv("سوال کرد", "سؤال کرد"),
        inv("هیچکس نیامد", z("هیچ‹کس نیامد")),
        inv("هر کس آمد", "هرکس آمد"),
        inv("آنرا دیدم", "آن را دیدم"),
        inv(z("هم‹چنین"), "همچنین"),
        inv("در حالی که", z("درحالی‹که")),
        inv("پیش  از آنکه", z("پیش‹از آنکه")),
        inv("طهران", "تهران")
    ]
});
