import assert from "assert";
import { spoken, writtenForm, registerSegments } from "../src/util/colloquial";
import { z } from "./helpers";

/*
 * Spoken words and the register of each sentence (since 1.5.0): the page has no «نوع متن»
 * any more; it reads each sentence and quotation.
 */
const spokenSentences = (text: string) => registerSegments(text).map((s) => [text.slice(s.start, s.end).trim(), s.spoken] as const);

describe("colloquial: spoken words", function () {
    it("spoken forms and their written form", () => {
        const cases: Array<[string, string]> = [
            ["چمدون", "چمدان"], [z("چمدون‹های"), z("چمدان‹های")], ["گرون", "گران"], ["خونه", "خانه"], ["اومدم", "آمدم"],
            ["میگه", z("می‹گوید")], ["میرم", z("می‹روم")], ["میدم", z("می‹دهم")], ["میکنه", z("می‹کند")], [z("می‹کنن"), z("می‹کنند")],
            ["نمیدونم", z("نمی‹دانم")], ["خانما", z("خانم‹ها")], ["پامون", "پایمان"], ["استخون", "استخوان"], ["بگه", "بگوید"], ["بذارم", "بگذارم"]
        ];
        for (const [w, f] of cases) assert.strictEqual(spoken(w)?.formal, f, w);
    });

    it("written words are not spoken: «میدان»، «بره»، «روی»، «کاملا»، «می‌آیم»، «می‌خواند»، «بدن»", () => {
        for (const w of ["میدان", "بره", "روی", "کاملا", z("می‹آیم"), z("می‹خواند"), z("می‹دهم"), "بدن", "سیمون", "میانه", "خواهم", "تقویت"]) {
            assert.strictEqual(spoken(w), null, w);
        }
    });

    it("a written sentence gets the written form only where it is sure («ایمون»، «سالو» are names)", () => {
        assert.strictEqual(writtenForm("گرون"), "گران");
        assert.strictEqual(writtenForm(z("چمدون‹های")), z("چمدان‹های"));
        for (const w of ["ایمون", "سالو", "چرمن", "رایونو", "رو", "نون"]) assert.strictEqual(writtenForm(w), null, w);
    });
});

describe("colloquial: the register of each sentence", function () {
    it("the user's text (1.5.0 report) is spoken throughout", () => {
        const text = [
            "میرم سمت صندوق و کارت رو میدم به خانم صندوقدار با لبخند میگه: مبارکت باشه عزیزم رمزت رو وارد کن لطفاً. کارت رو پس می‌گیرم. از سه هفته پیش ۲۰۰ تومان گرون تر شده.",
            "میگم: خانما همگی خسته نباشید خدا نگهدار.",
            "از در خروجی سالن اومدم بیرون. باد سرد زد توصورتم. برای بار هزارم چمدون‌های تامی و تیلی هر دو روی لحاف و زیر پامون"
        ].join("\n");
        const s = spokenSentences(text);
        assert.strictEqual(s.length, 7);
        assert.deepStrictEqual(s.filter(([, sp]) => !sp), []);
    });

    it("written prose stays written, a quotation in it may be spoken", () => {
        const text = "او به خانه رفت و در را بست. مادرش گفت: «کجا بودی؟ دیگه نمیدونم باهات چیکار کنم.» پسر جواب نداد.";
        assert.deepStrictEqual(
            spokenSentences(text).map(([, sp]) => sp),
            [false, false, true, false]
        );
    });

    it("a line of dialogue after a dash", () => {
        const s = spokenSentences("ـ همیشه همینو میگی. بابات هم هنوز نیومده.");
        assert.deepStrictEqual(s.map(([, sp]) => sp), [true, true]);
    });

    it("one ambiguous word does not make a written sentence spoken", () => {
        for (const t of [
            "این روستا در شمال شهر نیس قرار دارد.", // «نیس»: Nice
            "از بازی‌های بیاد ماندنی او می‌توان به این مسابقه اشاره کرد.", // «بیاد» = «به یاد»
            "در قرن شانزدهم کشتی‌ها معمولاً در این بندر لنگر می‌انداختند.", // «معمولا»
            "کتاب را روی میز گذاشت و رفت.", // «رو» in «روی»
            "یوکو اونو این شعر را نوشت.", // «اونو»: a name
            "این تمرین عضلات را تقویت می‌کند."
        ]) {
            assert.deepStrictEqual(spokenSentences(t).filter(([, sp]) => sp), [], t);
        }
    });

    it("the same line gives the same answer alone and in a longer text", () => {
        const line = "از در خروجی سالن اومدم بیرون. باد سرد زد توصورتم.";
        const alone = registerSegments(line).map((s) => s.spoken);
        const text = "این یک جملهٔ رسمی است.\n" + line;
        const inText = registerSegments(text).slice(1).map((s) => s.spoken);
        assert.deepStrictEqual(inText, alone);
    });
});
