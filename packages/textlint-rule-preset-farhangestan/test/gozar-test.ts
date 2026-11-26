import TextLintTester from "textlint-tester";
import rule, { gozarCorrection } from "../src/rules/gozar";
import { inv, z } from "./helpers";
import assert from "assert";

new TextLintTester().run("gozar", rule, {
    valid: [
        "سپاسگزار شما هستم و خدمتگزاران آمدند.",
        z("مراسم برگزار شد؛ قانونگذاری و بنیان‹گذاری و سرمایه‹گذاری."),
        z("نمازگزار، خراج‹گزار، حج‹گزار، نام‹گذاری، تأثیرگذار"),
        z("پایه‹گزارش و فیلم گزارش"), // «گزارش»: a report
        "راه را بر گذار به ژنتیک مولکولی باز کردند.", // «بر گذار»: two words
        z("امانت‹گذار و سنت‹گذار و وام‹گذار"), // both spellings, two meanings
        "گذار از سنت به تجدد"
    ],
    invalid: [
        inv("سپاسگذار شما هستم.", "سپاسگزار شما هستم."),
        inv("خدمتگذاران آمدند.", "خدمتگزاران آمدند."),
        inv(z("خراج‹گذار روم بود."), z("خراج‹گزار روم بود.")),
        inv("مراسم برگذار شد و برگذاری آن", "مراسم برگزار شد و برگزاری آن", 2),
        inv("مجلس قانونگزاری", "مجلس قانونگذاری"),
        inv(z("قانون‹گزاری"), "قانونگذاری"),
        inv(z("نام‹گزاری کرد"), z("نام‹گذاری کرد")),
        inv("بنیانگزار و بنیادگزار", z("بنیان‹گذار و بنیادگذار"), 2),
        inv(z("سرمایه‹گزاری"), z("سرمایه‹گذاری")),
        inv("سرمایه گزاری کرد", z("سرمایه‹گذاری کرد")),
        inv("تاثیرگزار بود", "تأثیرگذار بود"),
        inv(z("سیاست‹گزاران دولت"), z("سیاست‹گذاران دولت")),
        inv(z("قانونگزاری‹ها"), z("قانونگذاری‹ها")),
        inv("نمازگذار و شکرگذار", "نمازگزار و شکرگزار", 2)
    ]
});

describe("gozarCorrection", () => {
    it("knows the closed list and its suffixes", () => {
        assert.strictEqual(gozarCorrection("سپاسگذار"), "سپاسگزار");
        assert.strictEqual(gozarCorrection("خدمتگذاران"), "خدمتگزاران");
        assert.strictEqual(gozarCorrection("سپاسگزار"), null);
        assert.strictEqual(gozarCorrection("گزارش"), null);
    });
});
