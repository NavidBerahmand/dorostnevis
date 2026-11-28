import TextLintTester from "textlint-tester";
import assert from "assert";
import lexicon from "../src/rules/lexicon";
import wordSpacing from "../src/rules/word-spacing";
import hamzaTanvin from "../src/rules/hamza-tanvin";
import misspellings from "../src/rules/misspellings";
import biPrefix from "../src/rules/bi-prefix";
import spacedCompounds from "../src/rules/spaced-compounds";
import { doubledTypo } from "../src/util/speller";
import { z } from "./helpers";

/*
 * 1.6.7 (the owner: «فقط مواردی که با قاعدۀ ۱۰۰ درصدی می‌شه رفعشون کرد»): only fixes that are certain by the book and
 * measured right on the blogs and Wikipedia. Joined «ب» + word, tanvin with the wrong mark, a letter typed twice, a
 * closed list of misspellings, «خلاء»; no card where the farhang lists both forms, no red «بی‌» before a plural in «ات».
 */
const tester = new TextLintTester();
const fix = (text: string, output: string, count = 1) => ({ text, output: z(output), errors: Array.from({ length: count }, () => ({})) });

tester.run("1.6.7: joined «ب» + a word, as the book writes it", lexicon, {
    valid: ["او بروز کرد.", "تا برسم خانه.", "بمانند یا بروند؟", "کار بجا بود.", "علامت بعلاوه است.", "تنگه بسفر در استانبول است.", "پیر باین آمد."],
    invalid: [
        // the farhang's «به‌X» (ب: compound adverbs and prepositions, with a ZWNJ)
        fix("او بصورت رسمی آمد.", "او به‹صورت رسمی آمد."),
        fix("بتازگی آمد.", "به‹تازگی آمد."),
        fix("سیستم را بروزرسانی کرد.", "سیستم را به‹روزرسانی کرد."),
        // not in the farhang's list: «به» the preposition, apart (ج: «به برادرت گفتم، به کار بردم»)
        fix("بنظر من خوب است.", "به نظر من خوب است."),
        fix("مشکلی بوجود آمد.", "مشکلی به وجود آمد."),
        fix("آن را بدست آورد.", "آن را به دست آورد."),
        fix("صبح بخیر.", "صبح به خیر."),
        fix("بنظرم خوب است.", "به نظرم خوب است."),
        fix("بهمین دلیل رفت.", "به همین دلیل رفت.")
    ]
});

tester.run("1.6.7: «بهمین» is the word lists', not «به» + «مین»", wordSpacing, {
    valid: ["بهمین دلیل رفت.", "بهمراه او آمد."],
    invalid: [fix("بهصورت رسمی آمد.", "به‹صورت رسمی آمد."), fix("بهنظر من خوب است.", "به نظر من خوب است.")]
});

tester.run("1.6.7: tanvin typed with the wrong mark", hamzaTanvin, {
    valid: ["شخصاً آمد.", "خلأ بود."],
    invalid: [
        fix("شخصاَ آمد.", "شخصاً آمد."),
        fix("عینأ گفت.", "عیناً گفت."),
        fix("واقعاٌ خوب بود.", "واقعاً خوب بود."),
        fix("اصلاْ نه.", "اصلاً نه."),
        fix("حتمآ بیا.", "حتماً بیا."),
        fix("مطلقاُ نه.", "مطلقاً نه.")
    ]
});

tester.run("1.6.7: a letter typed twice; the closed list of misspellings", misspellings, {
    valid: ["اسمم علی است.", "ششم بود.", "خیلیییی خوب.", "او ووطن را دید.", "او مرددی بود.", "در اسفدن ماند.", "قاضی مقیسه آمد.", "نرم‌افزار متلب.", "تنظیم سرشاسی جلو."],
    invalid: [
        fix("او وععده داد.", "او وعده داد."),
        fix("توججه کنید.", "توجه کنید."),
        fix("ددانشگاه رفت.", "دانشگاه رفت."),
        fix("بنابرین رفتم.", "بنابراین رفتم."),
        fix("از فرشگاه خرید.", "از فروشگاه خرید."),
        fix("یاداشت‌ها را خواند.", "یادداشت‹ها را خواند."),
        fix("از برخوداری گفت.", "از برخورداری گفت."),
        fix("باردید دیروز.", "بازدید دیروز.")
    ]
});

describe("1.6.7: a letter typed twice, only where certain", () => {
    it("an ending after the same letter, a prefix before it, «لا» turned round, a stretch: none", () => {
        for (const w of ["سهامم", "جوونن", "ببرد", "ننواخت", "باال", "خیلیییی", "ووکیل", "مرددی"]) assert.strictEqual(doubledTypo(w), null, w);
        assert.strictEqual(doubledTypo("دانششگاه"), "دانشگاه");
        // «ا، و، ی» doubled is a stretch in speech: only in a written sentence
        assert.strictEqual(doubledTypo("بسیاار", false), null);
        assert.strictEqual(doubledTypo("بسیاار", true), "بسیار");
    });
});

tester.run("1.6.7: «بی» before a plural in «ات» is the preposition", biPrefix, {
    valid: ["بی مشکلات کار کرد.", "بی تبعات بود.", "بی جزئیات گفت."],
    invalid: [fix("بی ثبات شد.", "بی‹ثبات شد."), fix("بی گناهان را کشت.", "بی‹گناهان را کشت.")]
});

tester.run("1.6.7: «خلاء» ← «خلأ», whatever follows", lexicon, {
    valid: ["در خلأ."],
    invalid: [fix("در خلاء زندگی کرد.", "در خلأ زندگی کرد."), fix("در خلاء.", "در خلأ."), fix("خلاء، فضا.", "خلأ، فضا."), fix("خلاءها.", "خلأها.")]
});

tester.run("1.6.7: both forms in the farhang: no card", spacedCompounds, {
    valid: ["سیب زمینی خریدم.", "آب میوه خوردم.", "یک بار گفتم.", "آدم حسابی است."],
    invalid: [{ text: "تخم مرغ خریدم.", output: "تخم مرغ خریدم.", errors: [{}] }]
});
