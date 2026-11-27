import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import { DEFAULT_SETTINGS, Msg, isCertainMsg, isAuto, isBlue, makeLint, conflictsOf, outranked, oneAnswerPerSpan, applyFix } from "../src/lint-setup";

/*
 * 1.6.4 (the owner: «اون دو تا رو هم درست کن»): the spelling checker and the spaced compounds, the two
 * sources of wrong yellow cards 1.6.3 left, measured on cards judged by hand on blog and Wikipedia text.
 * The checker offers only the edits typos are made of (a letter left out, a homophone, a neighbouring key,
 * two letters swapped), no card without a replacement, nothing beside a name; the compounds leave a number
 * and what it counts, and the pairs their context reads as two words.
 */
const kernel = new TextlintKernel();
const at = (t: string, m: Msg) => t.slice(m.range[0], m.range[1]);
const colour = (m: Msg) => (isCertainMsg(m) ? "R" : isBlue(m) ? "B" : "Y");

/** What the page shows after its automatic typing fixes: not silent, not outranked, one answer per word. */
async function page(text0: string) {
    const s = DEFAULT_SETTINGS;
    const lint = makeLint(kernel, s);
    const alint = makeLint(kernel, s, false, true);
    let text = text0;
    for (let r = 0; r < 5; r++) {
        const auto = (await alint(text)).filter((m) => isAuto(m, text)).sort((a, b) => b.fix!.range[0] - a.fix!.range[0]);
        if (!auto.length) break;
        let last = Infinity;
        for (const m of auto) {
            if (m.fix!.range[1] > last) continue;
            text = applyFix(text, m.fix!);
            last = m.fix!.range[0];
        }
    }
    const msgs = await lint(text);
    const keep: Msg[] = [];
    for (const m of msgs) {
        if (isAuto(m, text)) continue;
        if (m.fix && outranked(m, await conflictsOf(lint, text, m, msgs))) continue;
        keep.push(m);
    }
    const shown = await oneAnswerPerSpan(lint, text, keep);
    const of = (rule: string) => shown.filter((m) => m.ruleId === rule).map((m) => `${colour(m)} ${at(text, m)}→${m.fix?.text ?? ""}`);
    return { text, shown, spelling: of("spelling"), compounds: of("spaced-compounds") };
}

describe("1.6.4: the spelling checker", function () {
    this.timeout(60000);
    it("still offers the typo's word, first", async () => {
        assert.deepStrictEqual((await page("کندانسور مشمل بر پنج قطعه است.")).spelling[0], "Y مشمل→مشتمل");
        assert.deepStrictEqual((await page("نماز واقعآ نماد وقار است.")).spelling[0], "Y واقعآ→واقعاً");
        assert.deepStrictEqual((await page("چاروق اکنون درزنجان ساخته می‌شود.")).spelling[0], "Y درزنجان→در زنجان");
    });
    it("no card on a name, a loanword or a spoken form many sites use, nor without a replacement", async () => {
        for (const t of [
            "از جمله توماس کرنمر، اسقف اعظم کانتربری، آمد.",
            "پل شرودر و کارل کیبرگ را ملاقات کرد.",
            "واسیلوسکی و ژوکف سعی کردند استالین را قانع کنند.",
            "پروفسور دایان پکنولد اشاره کرده است.",
            "خواهرم و خونوادش در مسافرتی بودند.",
            "مقاومت بوربون در کالابری به سرعت فروپاشید."
        ]) {
            assert.deepStrictEqual((await page(t)).spelling, [], t);
        }
    });
});

describe("1.6.4: the spaced compounds", function () {
    this.timeout(60000);
    it("a number and what it counts, and the pairs read as two words: no card", async () => {
        for (const t of [
            "یک گونه از پرندگان است.",
            "پنج روز بستری بود.",
            "او سی و یک ساله بود.",
            "درش رو باز بذار تا آب اضافه‌اش تبخیر بشه.",
            "اما من بعد از عصب‌کشی دندانم رفتم.",
            "گالری‌های مجموعه دارای طرح‌هایی است.",
            "این آمونیاک در زیر سطح قمر پنهان است.",
            "به پرفروش‌ترین کتاب بین‌المللی تبدیل شد."
        ]) {
            assert.deepStrictEqual((await page(t)).compounds, [], t);
        }
    });
    it("the compounds stay: «دانش آموزان» red, «تخم مرغ» and «یک بار» yellow", async () => {
        assert.deepStrictEqual((await page("دانش آموزان آمدند.")).compounds, ["R دانش آموزان→دانش‌آموزان"]);
        assert.deepStrictEqual((await page("تخم مرغ را بزنید.")).compounds, ["Y تخم مرغ→تخم‌مرغ"]);
        assert.deepStrictEqual((await page("حتی یک بار هم به روی خودش نیاورد.")).compounds, ["Y یک بار→یک‌بار"]);
    });
});
