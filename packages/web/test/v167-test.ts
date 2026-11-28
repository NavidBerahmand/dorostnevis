import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import { DEFAULT_SETTINGS, Msg, isCertainMsg, isAuto, isBlue, makeLint, applyFix } from "../src/lint-setup";

/*
 * 1.6.7: only certain fixes, each measured on the blogs and Wikipedia. How the page shows them: red (and in
 * «درست‌کن») for the joined «ب» forms, a letter typed twice and the misspellings; silent for a tanvin typed with the
 * wrong mark; no card where the farhang lists both forms or «بی» is the preposition before a plural in «ات».
 */
const kernel = new TextlintKernel();
const at = (t: string, m: Msg) => t.slice(m.range[0], m.range[1]);
const colour = (m: Msg) => (isCertainMsg(m) ? "R" : isBlue(m) ? "B" : "Y");

async function auto(text0: string) {
    const alint = makeLint(kernel, DEFAULT_SETTINGS, false, true);
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
const cards = async (t: string, w: string) => (await makeLint(kernel, DEFAULT_SETTINGS)(t)).filter((m) => at(t, m) === w).map((m) => `${colour(m)}${isAuto(m, t) ? "auto" : ""} ${m.ruleId} ${m.fix?.text ?? ""}`);

describe("1.6.7", function () {
    this.timeout(120000);
    it("joined «ب» + word: red, one card, the book's form", async () => {
        const t = "او بصورت رسمی آمد و بنظر من مشکلی بوجود آمد؛ صبح بخیر.";
        assert.deepStrictEqual(await cards(t, "بصورت"), ["R lexicon به‌صورت"]);
        assert.deepStrictEqual(await cards(t, "بنظر"), ["R lexicon به نظر"]);
        assert.deepStrictEqual(await cards(t, "بوجود"), ["R lexicon به وجود"]);
        assert.deepStrictEqual(await cards(t, "بخیر"), ["R lexicon به خیر"]);
        const h = "بهمین دلیل رفت.";
        assert.deepStrictEqual(await cards(h, "بهمین"), ["R lexicon به همین"], "not also «به مین»");
    });
    it("a tanvin typed with the wrong mark is fixed silently", async () => {
        assert.strictEqual(await auto("شخصاَ آمد و عینأ گفت و حتمآ رفت."), "شخصاً آمد و عیناً گفت و حتماً رفت.");
    });
    it("a letter typed twice and the closed misspellings: red, not silent", async () => {
        const t = "او وععده داد و بنابرین از فرشگاه خرید.";
        assert.strictEqual(await auto(t), t);
        assert.deepStrictEqual(await cards(t, "وععده"), ["R misspellings وعده"]);
        assert.deepStrictEqual(await cards(t, "بنابرین"), ["R misspellings بنابراین"]);
        assert.deepStrictEqual(await cards(t, "فرشگاه"), ["R misspellings فروشگاه"]);
        // a stretch in speech is not a typo
        const s = "گفت: «خووب بود دیگه.»";
        assert.ok(!(await makeLint(kernel, DEFAULT_SETTINGS)(s)).some((m) => m.ruleId === "misspellings"));
    });
    it("no card where the farhang lists both forms; no red «بی‌» before a plural in «ات»; «خلاء» red", async () => {
        for (const [t, w] of [["سیب زمینی خریدم.", "سیب زمینی"], ["حتی یک بار هم نگفت.", "یک بار"], ["آب میوه خوردیم.", "آب میوه"]]) assert.deepStrictEqual(await cards(t, w), [], t);
        const b = "بی مشکلات کار کرد.";
        assert.ok(!(await makeLint(kernel, DEFAULT_SETTINGS)(b)).some((m) => m.ruleId === "bi-prefix"));
        assert.deepStrictEqual(await cards("در خلاء.", "خلاء"), ["R lexicon خلأ"]);
    });
    it("«بهش، بهشون» still no colour", async () => {
        const t = "بهش گفتم و بهشون گفتم.";
        assert.deepStrictEqual((await makeLint(kernel, DEFAULT_SETTINGS)(t)).filter((m) => /بهش/.test(at(t, m))), []);
    });
});
