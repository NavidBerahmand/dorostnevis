import TextLintTester from "textlint-tester";
import rule from "../src/rules/lexicon";
import { inv, z } from "./helpers";

new TextLintTester().run("lexicon", rule, {
    valid: [
        "اتاق، بلیت، رئیس، ارائه، مسئله، سؤال، تأثیر",
        "آخر کار غرق شد.",            // «آخُر/غُرُق» in the book are vowel-marked; never matched
        "این خطا بود.",
        "توام",                       // تو + ـَم (you are), not توأم
        "من بعد می‌آیم",              // not «من‌بعد»               // «خطا» is a word, not a variant of «ختا»
        z("هیچ‹کس، همین‹جا، هرکس، آنچه، بلکه"),
        {
            text: "تاثیر",
            options: { dictionaries: { hamza: false } }
        }
    ],
    invalid: [
        inv("اطاق", "اتاق"),
        inv("بلیط قطار", "بلیت قطار"),
        inv(z("بلیط‹ها"), z("بلیت‹ها")),
        inv("رییس اداره", "رئیس اداره"),
        inv("این مساله", "این مسئله"),
        inv("سوال کرد", "سؤال کرد"),
        inv("هیچکس نیامد", z("هیچ‹کس نیامد")),
        inv("هر کس آمد", "هرکس آمد"),
        inv("آنرا دیدم", "آن را دیدم"),
        inv(z("هم‹چنین"), "همچنین"),
        inv("در حالی که", z("درحالی‹که")),
        inv("پیش  از آنکه", z("پیش‹از آنکه")),
        inv("طهران", "تهران"),
        inv("زکوة", "زکات"),
        inv("تقوی", "تقوا"),
        inv("ان شاء الله", z("ان‹شاءالله")),
        inv("انشاالله", z("ان‹شاءالله")),
        inv("جابجا", z("جابه‹جا")),
        inv("روبرو", z("روبه‹رو")),
        inv("کم کم", z("کم‹کم")),
        inv("کم و کاست", z("کم‹وکاست")),
        inv("بخصوص", z("به‹خصوص")),
        inv("آنروز", "آن روز"),
        inv("چکار کنم", "چه کار کنم"),
        { text: "رفت و آمد", errors: [{}] },  // idiomatic only in some senses: no automatic fix
        inv("بمحض رسیدن", z("به‹محض رسیدن")), // p. 38
        inv("چه طور شد؟", "چطور شد؟"), // p. 34
        inv("همین طور شد.", z("همین‹طور شد.")),
        inv("هدف اینست که", "هدف این است که"),
        inv("ابن سینا", z("ابن‹سینا")),
        // «این‌که» is right in the sense «این کسی که»: suggestion only
        { text: z("این‹که آمد"), output: z("این‹که آمد"), errors: [{}] },
        // «آن چه بسا»: suggestion only
        { text: "آن چه بسا", output: "آن چه بسا", errors: [{}] }
    ]
});
