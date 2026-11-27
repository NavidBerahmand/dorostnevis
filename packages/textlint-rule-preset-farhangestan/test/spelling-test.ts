import TextLintTester from "textlint-tester";
import rule from "../src/rules/spelling";
import { z } from "./helpers";

const one = (text: string) => ({ text, output: text, errors: [{}] }); // suggestion only, never fixed
new TextLintTester().run("spelling", rule, {
    valid: [
        "این کتاب را در کتابخانه خواندم و به خانه رفتم.",
        z("کتاب‹هایشان را نمی‹خوانند و بی‹حوصله‹اند."),
        z("نیم‹فاصله و حاصل‹مصدرها"),
        "لورا و آندریا و کاپرا به تهران آمدند.", // names without a frequent neighbour
        "Windows و ATM74",
        // 1.6.4: another letter changed is not offered (ث/ظ: no homophones, no neighbouring keys; judged
        // cards of 1.6.3: such guesses were names or the wrong word 14 times in 17)
        "منظره و منثره"
    ],
    invalid: [one("طایقه بزرگی بودند."), one("او درکانادا زندگی می‌کند."), one("غرمجاز است.")]
});

// 1.5.0: spoken forms are not typos; suggestions pass a quality bar, else a note without a replacement
import assert from "assert";
import { spellingCheck, editCost, nearLetters } from "../src/util/speller";
new TextLintTester().run("spelling (1.5.0)", rule, {
    valid: [
        "برای بار هزارم چمدون‌های تامی و تیلی هر دو روی لحاف و زیر پامون",
        "میگم: خانما همگی خسته نباشید خدا نگهدار.",
        "میرم خونه، گرون شده. اومدم بیرون. باد سرد زد توصورتم.",
        // 1.6.4: no card without a replacement («در واژه‌نامه نیست» alone was right 24 times in 135)
        "گرونانک آمد"
    ],
    invalid: [one("مفابل خانه ایستاد.")]
});
describe("spelling: the quality bar", function () {
    it("near keys and confused letters cost half", () => {
        assert.ok(nearLetters("ت", "ط") && nearLetters("ق", "ف") && nearLetters("س", "ش") && !nearLetters("چ", "ن"));
        assert.strictEqual(editCost("مفابل", "مقابل"), 0.5);
        assert.ok(editCost("چمدونهای", "نمونهای") > 1.5 && editCost("چمدونهای", "تمدنهای") > 1.5); // beyond the bar
    });
    it("no absurd candidate: «چمدونهای» is not «نمونهای» or «تمدنهای»", () => {
        const r = spellingCheck("چمدونهای");
        const s = r && "suggestions" in r ? r.suggestions : [];
        assert.ok(!s.includes("نمونهای") && !s.includes("تمدنهای"), JSON.stringify(r));
    });
    it("a candidate keeps the first letter, and a short word one letter more or less at most", () => {
        for (const w of ["طایقه", "مفابل"]) {
            const r = spellingCheck(w);
            assert.ok(r && "suggestions" in r && r.suggestions.every((c) => c[0] === w[0] || nearLetters(c[0], w[0])), w + JSON.stringify(r));
        }
    });
    it("in a spoken sentence, two words run together come first: «امروزسه» → «امروز سه»، «بااون» → «با اون»", () => {
        assert.deepStrictEqual(spellingCheck("امروزسه", true), { suggestions: ["امروز سه"] });
        assert.deepStrictEqual(spellingCheck("بااون", true), { suggestions: ["با اون"] });
    });
});
