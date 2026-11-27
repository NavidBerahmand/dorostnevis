/*
 * 1.6.1: the false reds 1.6.0 left, at the level of each rule (the page's view: packages/web/test/v161-test.ts).
 */
import assert from "assert";
import TextLintTester from "textlint-tester";
import joinedWords from "../src/rules/joined-words";
import verbPrefixAlef from "../src/rules/verb-prefix-alef";
import arabicPrefixes from "../src/rules/arabic-prefixes";
import lexicon from "../src/rules/lexicon";
import punctuation from "../src/rules/punctuation";
import spacedCompounds from "../src/rules/spaced-compounds";
import { FARHANG } from "../src/util/words";
import { spellingCheck } from "../src/util/speller";
import { inv, z } from "./helpers";

const ask = (text: string, count = 1) => ({ text, output: text, errors: Array.from({ length: count }, () => ({})) });

new TextLintTester().run("joined-words (1.6.1)", joinedWords, {
    valid: ["همتون رو دوست دارم.", "همشون اومدن.", "از جلوش رد شدم.", "گلوش درد می‌کنه.", "یکی از دخترا رفت.", "این فکرا میاد تو ذهنم."],
    invalid: [
        ask("لبهام خشک شده بود."), // «لبه‌ام» or «لب‌هام»: a judgement
        ask("چشمهام درد می‌کنه."),
        inv("من از خانهام بیرون آمدم.", z("من از خانه‹ام بیرون آمدم.")), // nobody says «خان‌هام»
        inv("این همکلاسی من است.", z("این هم‹کلاسی من است."))
    ]
});

new TextLintTester().run("verb-prefix-alef (1.6.1)", verbPrefixAlef, {
    valid: ["باورم نمی‌شه.", "باورش کن.", "بادامو بده."],
    invalid: [inv("بانداز بیرون.", "بینداز بیرون."), inv("نافتاد.", "نیفتاد.")]
});

new TextLintTester().run("arabic-prefixes (1.6.1)", arabicPrefixes, {
    valid: ["ضد زیر دریایی", "زد و ضد زیر گریه", "غیر احمد کسی نیامد.", "غیر علی کسی نبود."],
    invalid: [inv("غیر قانونی است.", "غیرقانونی است."), inv("غیر مسلمانان آمدند.", "غیرمسلمانان آمدند."), inv("ضد زنگ است.", "ضدزنگ است.")]
});

new TextLintTester().run("lexicon (1.6.1)", lexicon, {
    valid: ["از این رو به اون رو شد.", "از این رو به آن رو شدید.", "الحمدلله که خوبی."],
    invalid: [inv("از این رو به خانه رفتیم.", z("ازاین‹رو به خانه رفتیم.")), inv("الحمدالله که خوبی.", "الحمدلله که خوبی."), inv("انصافا خوب بود.", "انصافاً خوب بود.")]
});

new TextLintTester().run("punctuation (1.6.1)", punctuation, {
    valid: ["نسخه 4.2.0 منتشر شد.", "آدرس 192.168.1.1 است.", "ساعت 12:30 رسیدم.", "ورژن 4.2 آمد.", "حالم خوب شه ((((((", "پدر و مادر۲) داشتن برنامه", "[گل]*(¸.•*¨(¸.•*¨"],
    invalid: [
        ask("شمردم یک..دو..سه", 2), // a judgement each (on the page with «… » and «. »)
        inv("گلپر و . . . در اینجا", "گلپر و… در اینجا"),
        inv("در سال 2020 بود.", "در سال ۲۰۲۰ بود.")
    ]
});

new TextLintTester().run("spaced-compounds (1.6.1)", spacedCompounds, {
    valid: ["چند روزیه حال ندارم.", "این دو رو رد کرده.", "خداوند آن را در بدن ما قرار داد.", "یک بار دو بار رفتم."],
    invalid: [ask("سیب زمینی خریدم.")]
});

describe("1.6.1: data and the spelling checker", function () {
    it("the farhang prints «الحمدلله» and «بارک‌الله» (the «لله» ligature was read as «الله»)", () => {
        assert.deepStrictEqual(FARHANG["الحمدلله"]?.[0], "الحمدلله");
        assert.strictEqual(FARHANG["الحمدالله"], undefined);
        assert.strictEqual(FARHANG["بارکالله"]?.[0], z("بارک‹الله"));
        assert.strictEqual(FARHANG["لاالهالاالله"]?.[0], z("لااله‹الاالله"));
    });
    it("no guess two letters away; «و» and «که» run in are split; spoken inflections are words", () => {
        assert.deepStrictEqual(spellingCheck("وعمدی"), { suggestions: ["و عمدی"] });
        assert.deepStrictEqual(spellingCheck("حالتیکه"), { suggestions: ["حالتی که"] });
        assert.ok(!spellingCheck("وبودر") || !("suggestions" in spellingCheck("وبودر")!));
        for (const w of ["میسازنا", "ننداخته", "گفتینو", "شدتون", "میومدن", "دستامو"]) assert.strictEqual(spellingCheck(w), null, w);
        // 1.6.4: «خ» for «ق» is neither a homophone nor a neighbouring key: not offered (editKind «other»)
        assert.ok(!spellingCheck("عشخ") || !("suggestions" in spellingCheck("عشخ")!));
    });
});
