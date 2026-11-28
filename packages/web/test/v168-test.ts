import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import { DEFAULT_SETTINGS, Msg, isCertainMsg, isAuto, isBlue, makeLint, applyCertain } from "../src/lint-setup";

/*
 * 1.6.8: the certain ezafe (کسرۀ اضافه) is red, with «ۀ», so «درست‌کن» makes it: «درباره»، «به» + «گفته، وسیله،
 * اندازه، مثابه…»، «در/از/به» + «دوره، سده، زمینه، مرحله…». Only in written sentences; the model's other guesses stay
 * yellow; nothing is silent.
 */
const kernel = new TextlintKernel();
const at = (t: string, m: Msg) => t.slice(m.range[0], m.range[1]);
const colour = (m: Msg) => (isCertainMsg(m) ? "R" : isBlue(m) ? "B" : "Y");
const lint = () => makeLint(kernel, DEFAULT_SETTINGS);
const ezafe = async (t: string, w: string) =>
    (await lint()(t)).filter((m) => m.ruleId === "ezafe-he" && at(t, m) === w).map((m) => `${colour(m)}${isAuto(m, t) ? "auto" : ""} ${m.fix?.text ?? ""}`);

describe("1.6.8", function () {
    this.timeout(120000);
    it("the certain ezafe is red, with «ۀ», never silent", async () => {
        const t = "این کتاب درباره تاریخ ایران است و به گفته رئیس دانشگاه در زمینه فناوری نوشته شده است.";
        assert.deepStrictEqual(await ezafe(t, "درباره"), ["R دربارۀ"]);
        assert.deepStrictEqual(await ezafe(t, "گفته"), ["R گفتۀ"]);
        assert.deepStrictEqual(await ezafe(t, "زمینه"), ["R زمینۀ"]);
    });
    it("«درست‌کن» makes them", async () => {
        const t = "این کتاب درباره تاریخ ایران است و به گفته رئیس دانشگاه در زمینه فناوری نوشته شده است.";
        let x = t;
        for (let r = 0; r < 3; r++) x = applyCertain(x, await lint()(x));
        assert.ok(x.includes("دربارۀ تاریخ") && x.includes("به گفتۀ رئیس") && x.includes("در زمینۀ فناوری"), x);
    });
    it("the model alone stays yellow; «خانه من» stays yellow", async () => {
        assert.deepStrictEqual((await ezafe("او خانه قبلی را فروخت.", "خانه")).map((s) => s[0]), ["Y"]);
        assert.deepStrictEqual((await ezafe("این خانه من است.", "خانه")).map((s) => s[0]), ["Y"]);
    });
    it("a spoken sentence: «درباره» yellow, not red", async () => {
        const c = await ezafe("میخوام درباره این فیلم یه چیزی بگم.", "درباره");
        assert.ok(c.length > 0 && c.every((s) => s[0] === "Y"), String(c));
    });
    it("the written ezafe mark is still red («خانه ی من» ← «خانۀ من»)", async () => {
        assert.deepStrictEqual(await ezafe("کلید خانه ی دوستم را گم کردم.", "خانه ی"), ["R خانۀ"]);
    });
    it("«شهریه  ی»، «خانه  ای»، «کتاب  ها»: the word's fix takes in the extra space, one answer, no «one space» card", async () => {
        const all = async (t: string) => (await lint()(t)).map((m) => `${colour(m)}${isAuto(m, t) ? "auto" : ""} ${m.ruleId} ${at(t, m)}→${m.fix?.text ?? ""}`);
        assert.deepStrictEqual(await all("سی جلسه با شهریه  ی مناسب به"), ["R ezafe-he شهریه  ی→شهریۀ"]);
        assert.deepStrictEqual(await all("یک خانه  ای خرید."), ["R copula-attachment خانه  ای→خانه\u200cای"]);
        assert.deepStrictEqual(await all("این کتاب  ها خوب است."), ["Rauto plural-ha کتاب  ها→کتاب\u200cها"]);
        // nothing else there: the extra space is still fixed by itself
        assert.deepStrictEqual(await all("این دو  کتاب است."), ["Rauto punctuation   → "]);
    });
    it("«بهش، بهشون» still no colour", async () => {
        const t = "بهش گفتم و بهشون گفتم.";
        assert.deepStrictEqual((await lint()(t)).filter((m) => /بهش/.test(at(t, m))), []);
    });
});
