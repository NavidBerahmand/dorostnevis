import TextLintTester from "textlint-tester";
import spokenSpelling from "../src/rules/spoken-spelling";
import spokenWord from "../src/rules/spoken-word";
import { inv, z } from "./helpers";

// 1.5.0: the spelling of spoken forms (spoken sentences), and spoken forms in written ones
new TextLintTester().run("spoken-spelling", spokenSpelling, {
    valid: [z("می‹گه، می‹رم، می‹دم"), "میدان", "میانه", "میدونم", "تو صورتم", "توضیح داد"],
    invalid: [
        inv("میگه", z("می‹گه")),
        inv("میرم خونه", z("می‹رم خونه")),
        inv("نمیشه", z("نمی‹شه")),
        { text: "باد سرد زد توصورتم", output: "باد سرد زد توصورتم", errors: [{}] } // «تو صورتم»: a judgement
    ]
});
new TextLintTester().run("spoken-word", spokenWord, {
    valid: ["قیمت‌ها گران شد.", "ایمون آمد.", "سالو و بارون آمدند.", "رو به دریا", "نون و پنیر"],
    invalid: [
        { text: "قیمت‌ها گرون شد.", output: "قیمت‌ها گرون شد.", errors: [{}] },
        { text: z("چمدون‹های مسافران"), output: z("چمدون‹های مسافران"), errors: [{}] }
    ]
});
