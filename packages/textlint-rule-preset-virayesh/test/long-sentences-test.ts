import TextLintTester from "textlint-tester";
import rule from "../src/rules/long-sentences";

const long = Array.from({ length: 45 }, (_, i) => (i % 2 ? "کتاب" : "خوب")).join(" ") + ".";
new TextLintTester().run("long-sentences", rule, {
    valid: ["جملهٔ کوتاهی است.", "کتابی که خریدم و دوستی که دیدم خوب بودند.", "کم کم"],
    invalid: [
        { text: long, errors: [{}] },
        { text: "کتابی که دوستی که در شهری که دیدیم نوشت خوب بود.", errors: [{}] },
        { text: long, options: { maxWords: 50 }, errors: [] } as any
    ].filter((c) => c.errors.length)
});
