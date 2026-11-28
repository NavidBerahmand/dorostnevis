import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import { DEFAULT_SETTINGS, Msg, isCertainMsg, isAuto, isBlue, makeLint, applyCertain, convertDigits, digitFixes, isLatinDigits, applyFix } from "../src/lint-setup";

/*
 * 1.6.6 (the owner: «عددهای انگلیسی آبی باشه و یه دونه دکمه اصلاح همه هم داشته باشه»): the Latin-digit card is
 * blue, never in «درست‌کن», never silent; «همۀ عددها» → «بله» converts every number it marks at once. And «می میرم»
 * becomes «می‌میرم» by itself, never «می‌می‌رم».
 */
const kernel = new TextlintKernel();
const at = (t: string, m: Msg) => t.slice(m.range[0], m.range[1]);

/** The automatic typing fixes, as the page makes them (5 rounds). */
async function auto(text0: string, settings = DEFAULT_SETTINGS) {
    const alint = makeLint(kernel, settings, false, true);
    let text = text0;
    for (let r = 0; r < 5; r++) {
        const fx = (await alint(text)).filter((m) => isAuto(m, text)).sort((a, b) => b.fix!.range[0] - a.fix!.range[0]);
        if (!fx.length) break;
        let end = Infinity;
        for (const m of fx) {
            if (m.fix!.range[1] > end) continue;
            text = applyFix(text, m.fix!);
            end = m.fix!.range[0];
        }
    }
    return text;
}

describe("1.6.6: Latin digits", function () {
    this.timeout(120000);
    const text = "در سال 1402 رشد 4.5 بود و 1,000 نفر آمدند؛ نسخۀ 4.2.0 را از 192.168.1.1 ساعت 12:30 گرفتیم و Windows 10 هم بود.";

    it("a blue card, not red, not silent, not in «درست‌کن»", async () => {
        const msgs = await makeLint(kernel, DEFAULT_SETTINGS)(text);
        const digits = msgs.filter(isLatinDigits);
        assert.deepStrictEqual(digits.map((m) => [at(text, m), m.fix!.text]), [["1402", "۱۴۰۲"], ["4.5", "۴٫۵"], ["1,000", "۱٬۰۰۰"]]);
        for (const m of digits) {
            assert.ok(isBlue(m) && !isCertainMsg(m) && !isAuto(m, text), m.message);
        }
        assert.ok(!/[۰-۹]/.test(applyCertain(text, msgs)), "«درست‌کن» leaves the digits");
        // the typing fixes only put a no-break space after a number and its counter («1,000 نفر»): no digit changes
        assert.strictEqual((await auto(text)).replace(/\u00A0/g, " "), text, "nothing is made silently");
    });

    it("«همۀ عددها» → «بله»: every number the card marks, at once; versions, addresses, times and Latin context stay", async () => {
        const msgs = await makeLint(kernel, DEFAULT_SETTINGS)(text);
        assert.strictEqual(digitFixes(msgs).length, 3);
        assert.strictEqual(
            convertDigits(text, msgs),
            "در سال ۱۴۰۲ رشد ۴٫۵ بود و ۱٬۰۰۰ نفر آمدند؛ نسخۀ 4.2.0 را از 192.168.1.1 ساعت 12:30 گرفتیم و Windows 10 هم بود."
        );
        // after it, no digit card is left
        const after = convertDigits(text, msgs);
        assert.deepStrictEqual((await makeLint(kernel, DEFAULT_SETTINGS)(after)).filter(isLatinDigits), []);
    });

    it("the same in every «ها» mode and with «کل متن محاوره‌ای است»", async () => {
        for (const s of [{ pluralMode: "apart" }, { pluralMode: "required-only" }, { colloquialText: true }]) {
            const msgs = await makeLint(kernel, { ...DEFAULT_SETTINGS, ...s })(text);
            assert.deepStrictEqual(msgs.filter(isLatinDigits).map((m) => [isBlue(m), isCertainMsg(m)]), [[true, false], [true, false], [true, false]], JSON.stringify(s));
        }
    });
});

describe("1.6.6: «می‌می‌» never", function () {
    this.timeout(120000);
    it("«می میرم» ← «می‌میرم» by itself (and «می میرد»، «می میراند»، «نمی میرد»، «میمیرم»)", async () => {
        const cases: Array<[string, string]> = [
            ["من می میرم.", "من می‌میرم."],
            ["او هم می میرد.", "او هم می‌میرد."],
            ["او را می میراند.", "او را می‌میراند."],
            ["او هرگز نمی میرد.", "او هرگز نمی‌میرد."],
            ["من میمیرم.", "من می‌میرم."],
            ["گفت: «دارم می میرم دیگه.»", "گفت: «دارم می‌میرم دیگه.»"]
        ];
        for (const [t, want] of cases) assert.strictEqual(await auto(t), want, t);
    });
    it("a «می» typed twice, a month or a name: nothing makes «می‌می‌»", async () => {
        for (const t of ["بسیار بالا می می باشد که", "عموماً لر می می‌باشند", "از 15 دسامبر تا 15 می می توان رفت.", "طرح‌های گل گلی می می رم", "وااای می می جون"]) {
            const out = await auto(t);
            assert.ok(!out.includes("می‌می‌"), `${t} → ${out}`);
            for (const m of await makeLint(kernel, DEFAULT_SETTINGS)(out)) if (m.fix) assert.ok(!applyFix(out, m.fix).includes("می‌می‌"), `${out}: ${m.ruleId} ${m.fix.text}`);
        }
    });
});
