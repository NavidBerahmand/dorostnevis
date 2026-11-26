import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import virayesh, { CERTAIN_RULES } from "../src/index";

/*
 * `part`: the page runs each rule in CERTAIN_RULES twice, «certain» (red, in «اعمال همه»)
 * and «suggest» (yellow). Every certain report must have a fix, and the two parts together
 * must report exactly what the rule reports alone.
 */
const kernel = new TextlintKernel();
// the text plugin is an ES module that textlint-tester also imports: load it when the tests run
let textPlugin: any;
const run = async (id: string, part: object | true, text: string) =>
    kernel.lintText(text, {
        ext: ".txt",
        plugins: [{ pluginId: "text", plugin: (textPlugin ??= await import("@textlint/textlint-plugin-text")).default ?? textPlugin }],
        rules: [{ ruleId: id, rule: (virayesh.rules as any)[id], options: part }]
    });
const TEXT = [
    "با این وجود، آنچه که گفت مثمر ثمر بود و در ارتباط با آن نظرات زیادی بود؛ لازم به ذکر است.",
    "اگرچه باران آمد، اما رفتیم. چون دیر شد، لذا برگشتیم. سر به فرمان او بود.",
    "اثرات و خطرات و اقشار و دواوین و اساتید و مسئولین، اشعه‌های خورشید.",
    "در سن ۲۰ سالگی بازگشت مجدد کرد و پیشرفت رو به جلو داشت.",
    "آتش گشودند و در رابطه با آن به چالش کشیدند.",
    "رئیس مربوطه درب ورودی را بست؛ ضمناً در جنگ اول جهانی کاندیداتوری‌اش را اعلام کرد.",
    "سؤالی پرسیده شد و سؤالی بپرسم؟ این سؤال را پرسید."
].join("\n");

describe("certain and suggested parts", () => {
    for (const id of CERTAIN_RULES) {
        it(id, async () => {
            const all = (await run(id, true, TEXT)).messages;
            const certain = (await run(id, { part: "certain" }, TEXT)).messages;
            const suggest = (await run(id, { part: "suggest" }, TEXT)).messages;
            assert.ok(certain.length > 0, "no certain report");
            for (const m of certain) assert.ok(m.fix, `certain without a fix: ${m.message}`);
            const key = (m: { range: readonly number[]; message: string }) => `${m.range}|${m.message}`;
            assert.deepStrictEqual([...certain, ...suggest].map(key).sort(), all.map(key).sort());
        });
    }
    it("stay suggestions: «در ارتباط با»، «نظرات»، «دواوین»، «اساتید»، «سر به فرمان»، «درب»، passive «سؤال … پرسیده شد»", async () => {
        const certain = (await Promise.all([...CERTAIN_RULES].map((id) => run(id, { part: "certain" }, TEXT)))).flatMap((r) => r.messages);
        const flagged = certain.map((m) => TEXT.slice(m.range[0], m.range[1]));
        for (const w of ["در ارتباط با", "نظرات", "دواوین", "اساتید", "مسئولین", "سر به فرمان", "درب", "بازگشت مجدد", "در رابطه با", "ضمناً"]) {
            assert.ok(!flagged.some((f) => f.includes(w)), `«${w}» must stay yellow`);
        }
        for (const w of ["با این وجود", "مثمر ثمر", "اثرات", "خطرات", "مربوطه", "کاندیداتوری", "آتش گشودند", "سن "]) {
            assert.ok(flagged.some((f) => f.includes(w)), `«${w}» must be red`);
        }
    });
});
