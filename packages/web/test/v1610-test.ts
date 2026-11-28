import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import { DEFAULT_SETTINGS, Msg, isCertainMsg, isBlue, makeLint } from "../src/lint-setup";

/* 1.6.10: the retrained ezafe model on the page: «نحوه، سایه، نظریه» get their (yellow) ezafe card; red as in 1.6.8. */
const kernel = new TextlintKernel();
const at = (t: string, m: Msg) => t.slice(m.range[0], m.range[1]);
const colour = (m: Msg) => (isCertainMsg(m) ? "R" : isBlue(m) ? "B" : "Y");
const ezafe = async (t: string, w: string) =>
    (await makeLint(kernel, DEFAULT_SETTINGS)(t)).filter((m) => m.ruleId === "ezafe-he" && at(t, m) === w).map((m) => `${colour(m)} ${m.fix?.text ?? ""}`);

describe("1.6.10", function () {
    this.timeout(120000);
    it("«نحوه انجام»، «در سایه این درخت»: a yellow ezafe card", async () => {
        assert.deepStrictEqual(await ezafe("نحوه انجام کار را توضیح داد.", "نحوه"), ["Y نحوۀ"]);
        assert.deepStrictEqual(await ezafe("در سایه این درخت نشستیم.", "سایه"), ["Y سایۀ"]);
    });
    it("red stays as in 1.6.8", async () => {
        assert.deepStrictEqual(await ezafe("او در زمینه فناوری کار می‌کند.", "زمینه"), ["R زمینۀ"]);
        assert.deepStrictEqual(await ezafe("این کتاب درباره تاریخ ایران است.", "درباره"), ["R دربارۀ"]);
    });
    it("spoken «یه»: no ezafe card", async () => {
        assert.deepStrictEqual(await ezafe("یه دونه بده بهم.", "یه"), []);
    });
});
