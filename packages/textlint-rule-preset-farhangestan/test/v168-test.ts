import TextLintTester from "textlint-tester";
import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import textPlugin from "@textlint/textlint-plugin-text";
import ezafe from "../src/rules/ezafe-he";
import typingShortcuts from "../src/rules/typing-shortcuts";
import { barePresent } from "../src/util/ezafe-model";

/*
 * 1.6.8 (the owner: «خانه من» ← «خانۀ من», with «ۀ»): the ezafe that is certain is red, so «درست‌کن» makes it.
 * «درباره»، «به» + «گفته، وسیله، اندازه، مثابه…»، «در/از/به/تا» + «دوره، سده، زمینه، مرحله…» (the model at least 70%);
 * written sentences only, never before a verb written without «می» or a pronoun. Everything else as in 1.6.7.
 */
const tester = new TextLintTester();
const kernel = new TextlintKernel();
const RED = /^نشانۀ اضافه پس از «ه»ی غیرملفوظ «ۀ» است: «/;

async function messages(text: string, formal = true) {
    const r = await kernel.lintText(text, {
        ext: ".txt",
        plugins: [{ pluginId: "text", plugin: textPlugin }],
        rules: [{ ruleId: "ezafe-he", rule: ezafe, options: { formal } }]
    });
    return r.messages;
}
/** The certain ezafe card on `word`, if any (no «احتمال»، no «اگر»: red on the page). */
async function red(text: string, word: string, formal = true) {
    const at = text.indexOf(word);
    return (await messages(text, formal)).filter((m) => m.range[0] === at && RED.test(m.message) && m.fix).map((m) => m.fix!.text);
}

tester.run("ezafe-he (1.6.8): the certain ezafe is fixed", ezafe, {
    valid: [
        // «در میانه» at a phrase's end, «از رده خارج»: the model is unsure, no card
        "محرابی در میانه وجود داشت.",
        "این هواپیما از رده خارج شد."
    ],
    invalid: [
        { text: "این کتاب درباره تاریخ ایران است.", output: "این کتاب دربارۀ تاریخ ایران است.", errors: [{}] },
        { text: "به گفته رئیس دانشگاه، کلاس‌ها تعطیل است.", output: "به گفتۀ رئیس دانشگاه، کلاس‌ها تعطیل است.", errors: [{}] },
        { text: "حمله به وسیله دو فروند هواپیما انجام شد.", output: "حمله به وسیلۀ دو فروند هواپیما انجام شد.", errors: [{}] },
        { text: "آن را به اندازه کافی خوردیم.", output: "آن را به اندازۀ کافی خوردیم.", errors: [{}] },
        { text: "او در زمینه فناوری کار می‌کند.", output: "او در زمینۀ فناوری کار می‌کند.", errors: [{}] },
        { text: "این بنا در دوره صفوی ساخته شد.", output: "این بنا در دورۀ صفوی ساخته شد.", errors: [{}] },
        { text: "در سده هشتم میلادی ساخته شد.", output: "در سدۀ هشتم میلادی ساخته شد.", errors: [{}] }
    ]
});

describe("ezafe-he (1.6.8): which ezafe is red", function () {
    this.timeout(60000);
    it("red: «درباره»، «به» + BE_HEADS, «در/از/به/تا» + PREP_HEADS", async () => {
        assert.deepStrictEqual(await red("این کتاب درباره تاریخ ایران است.", "درباره"), ["دربارۀ"]);
        assert.deepStrictEqual(await red("به گفته رئیس دانشگاه، کلاس‌ها تعطیل است.", "گفته"), ["گفتۀ"]);
        assert.deepStrictEqual(await red("نظریه به مثابه یک نیاز ملی دیده شد.", "مثابه"), ["مثابۀ"]);
        assert.deepStrictEqual(await red("این بنا در دوره صفوی ساخته شد.", "دوره"), ["دورۀ"]);
    });
    it("not red: the model alone, however sure («خانه قبلی»، «نوک سینه»)", async () => {
        assert.deepStrictEqual(await red("او خانه قبلی را فروخت.", "خانه"), []);
        const m = await messages("او خانه قبلی را فروخت.");
        assert.ok(m.some((x) => /احتمال/.test(x.message)), "still a suggestion");
    });
    it("not red: before a pronoun or a verb with no «می», in a spoken sentence", async () => {
        assert.deepStrictEqual(await red("به گفته او، کلاس‌ها تعطیل است.", "گفته"), []);
        assert.deepStrictEqual(await red("تا زمانی که خطر رفع شد ما پا به عرصه گذاریم.", "عرصه"), []);
        assert.deepStrictEqual(await red("میخوام درباره این فیلم یه چیزی بگم.", "درباره", false), []);
    });
    it("barePresent: a present verb with no «می», not a noun", () => {
        assert.deepStrictEqual(["گذاریم", "دارد", "شود", "کتاب", "زبان", "مانند"].map(barePresent), [true, true, true, false, false, false]);
    });
});

/*
 * 1.6.8 (the owner: «سی جلسه با شهریه  ی مناسب»): the ezafe written as a separate «ی» across any run of spaces,
 * no-break spaces and ZWNJs, and after a long vowel too («شهریه»، «حاشیه»، «سایه»: the «ه» is silent); a pronounced
 * «ه» («فقیه»، «گروه») and spoken «یه» are left alone; no «ی» → «یک» guess on that «ی».
 */
tester.run("ezafe-he (1.6.8): the written ezafe across extra spaces, after «ی/و»", ezafe, {
    valid: ["فقیه ی بزرگی بود.", "گروه ی کوچکی آمد.", { text: "یه ی دونه بده.", options: { formal: false } }],
    invalid: [
        { text: "سی جلسه با شهریه  ی مناسب به", output: "سی جلسه با شهریۀ مناسب به", errors: [{}] },
        { text: "سی جلسه با شهریه ی مناسب به", output: "سی جلسه با شهریۀ مناسب به", errors: [{}] },
        { text: "کلید خانه  ی دوستم را گم کردم.", output: "کلید خانۀ دوستم را گم کردم.", errors: [{}] },
        { text: "کلید خانه\u00a0ی دوستم را گم کردم.", output: "کلید خانۀ دوستم را گم کردم.", errors: [{}] },
        { text: "کلید خانه\u200c ی دوستم را گم کردم.", output: "کلید خانۀ دوستم را گم کردم.", errors: [{}] },
        { text: "در حاشیه\u200cی کتاب نوشت.", output: "در حاشیۀ کتاب نوشت.", errors: [{}] },
        { text: "زیر سایه ی درخت نشست.", output: "زیر سایۀ درخت نشست.", errors: [{}] }
    ]
});

tester.run("typing-shortcuts (1.6.8): no «یک» guess on an ezafe «ی» after two spaces", typingShortcuts, {
    valid: ["سی جلسه با شهریه  ی مناسب به", "کلید خانه  ی دوستم را گم کردم."],
    invalid: [{ text: "دیروز ی کتاب خریدم.", errors: [{}] }]
});
