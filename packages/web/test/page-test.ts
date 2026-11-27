import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import { DEFAULT_SETTINGS, Msg, lintOptions, isCertainMsg, isTentative, splitMessage, isAuto } from "../src/lint-setup";

/*
 * What the page shows (since 1.4.0): every yellow or blue item carries its replacement (a
 * button), one per alternative its message names; a homograph is never red; the same error is
 * found the same way wherever it stands.
 */
const kernel = new TextlintKernel();
const lint = async (t: string, s = DEFAULT_SETTINGS) => (await kernel.lintText(t, lintOptions(s))).messages as unknown as Msg[];
const SAMPLE = [
    "منهای سالهای بچگی و شباهتهای آنها. حالا کمکم کن. صندلی عقبی و دندانهای او.",
    "این خانه توسط پدرم ساخته شد و کتابی که به من داده بودی را خواندم.",
    "در راستای اهداف، او قدرت را به چالش کشید و در ارتباط با نظرات لازم به ذکر است که این روش را استفاده کردند.",
    "گاهاً می‌آید و دوماً رفت. از این بابت متعجبم؛",
    "پسرم، «این کلید است. ساختمان—مثل کوه. این کتابه من است. خانه دار بود و شورای عالی آمد.",
    "در این علاقة رفت. او می‍رود."
].join("\n");

describe("the page's items", function () {
    it("every yellow/blue item has a replacement, except a note on a whole sentence", async () => {
        const bare = (await lint(SAMPLE)).filter((m) => !isCertainMsg(m) && !m.fix && m.ruleId !== "long-sentences");
        assert.deepStrictEqual(bare.map((m) => `${m.ruleId}: ${splitMessage(m).text}`), []);
    });

    it("a message that names alternatives («… یا «…»»، «دو خوانش») has one replacement per alternative", async () => {
        const msgs = await lint(SAMPLE);
        const lacking = msgs.filter((m) => /دو خوانش|یا «[^»]+»/.test(splitMessage(m).text) && m.fix).filter((m) => {
            const same = msgs.filter((x) => x.ruleId === m.ruleId && x.range[0] === m.range[0] && x.range[1] === m.range[1] && x.fix);
            return new Set(same.map((x) => x.fix!.text)).size < 2;
        });
        assert.deepStrictEqual(lacking.map((m) => `${m.ruleId}: ${splitMessage(m).text}`), []);
    });

    it("«سالهای» before a noun: «سال‌های» first", async () => {
        const m = (await lint("منهای سالهای بچگی")).filter((x) => x.ruleId === "plural-ha" && x.fix);
        assert.strictEqual(m[0].fix!.text, "سال‌های");
        assert.deepStrictEqual(m.map((x) => x.fix!.text).sort(), ["ساله‌ای", "سال‌های"].sort());
    });

    it("a homograph is never red: «حالا کمکم کن»، «صندلی عقبی»", async () => {
        for (const t of ["دیدمش و گفت املاکی شده و حالا کمکم کن", "صندلی عقبی خالی بود", "بینشان فاصله بود"]) {
            const red = (await lint(t)).filter(isCertainMsg);
            assert.deepStrictEqual(red.map((m) => `${m.ruleId}: ${splitMessage(m).text}`), [], t);
        }
    });

    it("the same error is found the same way in every line (item 4: «خامنه ایی»)", async () => {
        const text = "در تصویر سید علی خامنه ایی مشاهده کردم.\nخامنه ایی ۳۶ ساله بود.\nآقای خامنه ایی گفت";
        const msgs = await lint(text);
        const at = [...text.matchAll(/خامنه ایی/g)].map((x) => x.index!);
        const per = at.map((i) => msgs.filter((m) => m.range[0] === i).map((m) => `${m.ruleId}|${m.fix?.text}|${isCertainMsg(m)}`).sort().join(";"));
        assert.ok(per.every((p) => p === per[0] && p.includes("copula-attachment|خامنه‌ای|true")), per.join(" ‖ "));
    });

    it("silent fixes: «ۀ» → «هٔ», a missing tanvin, a comma before another mark, the dash, no-break spaces", async () => {
        const text = "خانۀ او ایضا هستند،: علی و ساختمان—مثل کوه به ۲۰ درصد در ۲۵ مهر (ص ۲۳۹)";
        const auto = (await lint(text)).filter((m) => isAuto(m, text)).map((m) => m.fix!.text);
        for (const want of ["هٔ", "ایضاً", ":", " —\u00A0", "\u00A0"]) assert.ok(auto.includes(want), `${want} in ${JSON.stringify(auto)}`);
        assert.strictEqual(auto.filter((x) => x === "\u00A0").length, 3, JSON.stringify(auto));
    });

    it("«همیشه «ها» را جدا بنویس»: joined «ها» becomes a silent fix only with the setting", async () => {
        const text = "شباهتهای آنها";
        const off = (await lint(text)).filter((m) => isAuto(m, text));
        const on = (await lint(text, { ...DEFAULT_SETTINGS, haApart: true })).filter((m) => isAuto(m, text));
        assert.strictEqual(off.length, 0);
        assert.ok(on.some((m) => m.fix!.text === "شباهت‌های"), JSON.stringify(on));
    });

    it("1.4.1: «تقویت» is not «تقوی» + «ت»: no marks at all", async () => {
        for (const t of ["این تمرین عضلات را تقویت می‌کند.", "تقویم سال نو را خرید.", "رایش سوم فروپاشید."]) {
            const msgs = await lint(t);
            assert.deepStrictEqual(msgs.map((m) => `${m.ruleId}: ${splitMessage(m).text}`), [], t);
        }
    });

    it("recommendations are blue and never red", async () => {
        const msgs = await lint("شباهتهای آنها و این خانه توسط پدرم ساخته شد.");
        const ha = msgs.find((m) => m.ruleId === "plural-ha")!;
        assert.ok(isTentative(ha) && ha.message.startsWith("⁤"));
    });
});
