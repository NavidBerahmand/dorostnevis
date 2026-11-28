import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import { DEFAULT_SETTINGS, Msg, isCertainMsg, isAuto, isBlue, makeLint } from "../src/lint-setup";

/*
 * 1.6.5: «ها»ی جمع one menu of three (it was a menu of two and a checkbox that did nothing with «فقط موارد
 * الزامی»), straight quotes typed against the wrong word, and what 1.6.4 left of the spelling checker and the
 * spaced compounds.
 */
const kernel = new TextlintKernel();
const at = (t: string, m: Msg) => t.slice(m.range[0], m.range[1]);
const colour = (m: Msg) => (isCertainMsg(m) ? "R" : isBlue(m) ? "B" : "Y");

describe("1.6.5", function () {
    this.timeout(120000);

    it("«ها»ی جمع: each of the three modes on «کتابها» and «خانهها»", async () => {
        const text = "کتابها را در خانهها گذاشت.";
        const cards = async (pluralMode: string) => {
            const msgs = (await makeLint(kernel, { ...DEFAULT_SETTINGS, pluralMode })(text)).filter((m) => m.ruleId.startsWith("plural-ha"));
            const of = (w: string) => msgs.filter((m) => at(text, m) === w).map((m) => colour(m) + (isAuto(m, text) ? "auto" : "") + " " + m.fix?.text);
            return { ketab: of("کتابها"), khane: of("خانهها") };
        };
        // only where the book requires it: «کتابها» untouched, «خانهها» red
        const req = await cards("required-only");
        assert.deepStrictEqual(req.ketab, [], JSON.stringify(req));
        assert.ok(req.khane.length && req.khane.every((x) => x.startsWith("R")) && req.khane.some((x) => x.endsWith("خانه‌ها")), JSON.stringify(req));
        // the default: the blue recommendation on «کتابها»
        const rec = await cards("recommended");
        assert.deepStrictEqual(DEFAULT_SETTINGS.pluralMode, "recommended");
        assert.ok(rec.ketab.length && rec.ketab.every((x) => x.startsWith("B") && !x.includes("auto")) && rec.ketab.some((x) => x.endsWith("کتاب‌ها")), JSON.stringify(rec));
        assert.ok(rec.khane.some((x) => x.startsWith("R") && x.endsWith("خانه‌ها")), JSON.stringify(rec));
        // always apart: «کتابها» a typing fix (red, applied silently when the automatic fixes are on)
        const ap = await cards("apart");
        assert.ok(ap.ketab.length && ap.ketab.every((x) => x.startsWith("Rauto")) && ap.ketab.some((x) => x.endsWith("کتاب‌ها")), JSON.stringify(ap));
        assert.ok(ap.khane.some((x) => x.startsWith("R") && x.endsWith("خانه‌ها")), JSON.stringify(ap));
    });
    it("a word that comes back elsewhere in the pasted text is a name: no spelling card (another paragraph, the title)", async () => {
        const lint = makeLint(kernel, DEFAULT_SETTINGS);
        const one = "مانند پاپایا، باباکو به دلیل میوه‌های خوراکی پرورش می‌یابد.";
        const whole = "باباکو\n\n" + one;
        const card = (t: string, msgs: Msg[]) => msgs.some((m) => m.ruleId === "spelling" && at(t, m) === "باباکو");
        assert.ok(card(one, await lint(one)), "alone, «باباکو» looks like «با باکو»");
        assert.ok(!card(whole, await lint(whole)), "with its title, it is the article's name");
    });

    it("straight quotes typed against the wrong word become «…» by themselves; a tanvin typed as «\"» stays", async () => {
        const text = 'مبنی بر اینکه" برو سؤال کن" کاشف به عمل آمد.\nاو حتما" می‌آید.';
        const auto = (await makeLint(kernel, DEFAULT_SETTINGS, false, true)(text)).filter((m) => isAuto(m, text));
        const q = auto.filter((m) => /گیومۀ فارسی/.test(m.message));
        assert.deepStrictEqual(q.map((m) => m.fix!.text), [" «برو سؤال کن»"], JSON.stringify(q.map((m) => m.fix)));
    });
});
