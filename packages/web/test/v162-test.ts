import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import {
    DEFAULT_SETTINGS, Settings, Msg, isCertainMsg, isAuto, isBlue, makeLint, conflictsOf, outranked, oneAnswerPerSpan, applyFix, lintText,
    undoesJustApplied, editsOf
} from "../src/lint-setup";
import { inBank, bankFormal, BANK_SIZE } from "../../textlint-rule-preset-farhangestan/src/util/colloquial-bank";
import { registerSegments } from "../../textlint-rule-preset-farhangestan/src/util/colloquial";
import { pingPong } from "./ping-pong";

/*
 * 1.6.2, the owner's decisions: the syllable rule of «اصول شکسته‌نویسی» is not followed; a colloquial
 * word bank (correct in spoken sentences, blue with its written form in written ones); «رو»، «اون»، «اونو»
 * blue everywhere; «کل متن محاوره‌ای است» (the setting `colloquialText`); a fix never hides another
 * rule's mark on the corrected word (the iPhone bug).
 */
const kernel = new TextlintKernel();
const at = (t: string, m: Msg) => t.slice(m.range[0], m.range[1]);
const colour = (m: Msg) => (isCertainMsg(m) ? "R" : isBlue(m) ? "B" : "Y");

/** What the page shows after its automatic typing fixes: not silent, not outranked, one answer per word. */
async function page(text0: string, s: Settings = DEFAULT_SETTINGS) {
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
    return { text, shown, on: (w: string) => shown.filter((m) => at(text, m) === w) };
}

describe("1.6.2: the syllable rule of «اصول شکسته‌نویسی» is not followed", function () {
    this.timeout(60000);

    it("spoken words in a spoken sentence get no card: «اون، دیگه، اگه، خونه، نون، همون، یه، نیس، منو، کتابو…»", async () => {
        const texts: Array<[string, string[]]> = [
            ["دیگه اگه بیای خونه همون نون رو می‌خوریم.", ["دیگه", "اگه", "خونه", "همون", "نون"]],
            ["من می‌دونم که فردا بخونمش، ولی اون موند.", ["می‌دونم", "بخونمش", "موند"]],
            ["دیروز اومدم و کتابا رو دیدم، دکترا هم بودن.", ["اومدم", "کتابا", "دکترا"]],
            ["منو یادت نره، اینو هم بگیر، کتابو بده.", ["منو", "اینو", "کتابو"]],
            ["یه چیزی هس که هنوزم نیس، بازم میگم.", ["یه", "هس", "هنوزم", "نیس", "بازم"]],
            ["بفرمایین تو، چی کار می‌کنین؟ بچه‌ها خارجن.", ["بفرمایین", "می‌کنین", "خارجن"]],
            ["اونا می‌خورن و می‌گن که رفته‌ان.", ["می‌خورن", "می‌گن", "رفته‌ان"]]
        ];
        for (const [t, words] of texts) {
            const p = await page(t);
            for (const w of words) assert.deepStrictEqual(p.on(w).map((m) => `${m.ruleId}:${m.fix?.text}`), [], `${t}: ${w}`);
            assert.ok(!p.shown.some((m) => m.ruleId === "over-broken"), t);
        }
    });

    it("the spelling of a spoken form is still an error: «خالهم، تهش، میگه، بزار، میخام، واقعن، میتونید، همه شون»", async () => {
        const cases: Array<[string, string, string]> = [
            ["رفتم پیش خالهم دیگه.", "خالهم", "خاله‌م"],
            ["تهش چیزی نموند دیگه.", "تهش", "ته‌ش"],
            ["من بزار برم دیگه.", "بزار", "بذار"],
            ["من میخام برم دیگه.", "میخام", "می‌خوام"],
            ["خب میتونید بیاید دیگه؟", "میتونید", "می‌تونید"]
        ];
        for (const [t, w, want] of cases) {
            const msgs = await lintText(kernel, t, DEFAULT_SETTINGS);
            assert.ok(msgs.some((m) => isCertainMsg(m) && at(t, m).includes(w.slice(0, 2)) && applyFix(t, m.fix!).includes(want)), `${t}: ${w} → ${want}`);
        }
        // the typing fixes, silent: «میگه» → «می‌گه»، «واقعن» → «واقعاً»، «همه شون» stays a judgement
        const p = await page("میگه واقعن خوب بود دیگه.");
        assert.ok(p.text.includes("می‌گه") && p.text.includes("واقعاً"), p.text);
        const q = await page("همه شون اومده بودن دیگه.");
        assert.ok(q.on("همه شون").some((m) => m.fix?.text === "همه‌شون"), JSON.stringify(q.shown));
    });
});

describe("1.6.2: the colloquial word bank", function () {
    this.timeout(60000);

    it("has the spoken words spelled as they should be, and not the misspelled ones", () => {
        assert.ok(BANK_SIZE > 2000, String(BANK_SIZE));
        for (const w of ["دیگه", "اگه", "خونه", "می‌دونم", "می‌خوام", "بذار", "تموم", "جالبه", "کتابا", "منو", "آره", "اون‌ها"]) assert.ok(inBank(w), w);
        // missing half-space, «ز/ذ»، «خا/خوا»، a missing «آ»، tanvin with «ن»، joined words, misspellings
        for (const w of ["میدونم", "میخوام", "میخام", "بزار", "اره", "واقعن", "اونموقع", "بلاخره", "بیوفته", "اسمون", "خوشکل", "تاحالا", "اپدیت"]) assert.ok(!inBank(w), w);
        // «رو، اون، اونو» have their own card
        for (const w of ["رو", "اون", "اونو"]) assert.ok(!inBank(w), w);
    });

    it("gives a written form only where it is reliable", () => {
        assert.deepStrictEqual(bankFormal("دیگه"), ["دیگر"]);
        assert.deepStrictEqual(bankFormal("می‌خوام"), ["می‌خواهم"]);
        assert.deepStrictEqual(bankFormal("تموم"), ["تمام"]);
        // two readings or a name: none
        for (const w of ["منم", "بدم", "نون", "جون", "بارون", "باهاشون"]) assert.deepStrictEqual(bankFormal(w), [], w);
        assert.strictEqual(bankFormal("کتاب"), null);
    });

    it("in a spoken sentence: no spelling, ezafe or register card on a bank word", async () => {
        const t = "خونه ما خیلی قشنگه، کامنتا رو خوندمش و تموم شد دیگه.";
        const p = await page(t);
        for (const w of ["خونه", "قشنگه", "کامنتا", "خوندمش", "تموم", "دیگه"]) assert.deepStrictEqual(p.on(w).map((m) => m.ruleId), [], w);
    });

    it("in a written sentence: blue with the written form; no card where there is none", async () => {
        const t = "این کتاب دیگه در کتابخانه موجود است و من آن را تموم کرده‌ام.";
        const p = await page(t);
        assert.deepStrictEqual(p.on("دیگه").map((m) => [m.fix?.text, colour(m)]), [["دیگر", "B"]]);
        assert.deepStrictEqual(p.on("تموم").map((m) => [m.fix?.text, colour(m)]), [["تمام", "B"]]);
        const q = await page("در این گزارش منم نوشته شده است.");
        assert.deepStrictEqual(q.on("منم"), []);
    });

    it("a bank word counts as spoken for the register: «هنوز تموم نشده.» is a spoken sentence", () => {
        assert.ok(registerSegments("هنوز تموم نشده.").every((s) => s.spoken));
        assert.ok(registerSegments("این فرضیه جالبه.").every((s) => s.spoken));
        // written words the bank also has do not («شنیدم»، «سمتش»، «پسرم»)
        assert.ok(registerSegments("زنگ تفریح که خورد، سارا دوید سمتش.").every((s) => !s.spoken));
        assert.ok(registerSegments("چنان شنیدم که پسرم آمد و رفت.").every((s) => !s.spoken));
    });
});

describe("1.6.2: «رو»، «اون»، «اونو»", function () {
    this.timeout(60000);

    it("blue in every sentence, with the written forms as buttons: «را/روی»، «آن/او»، «آن را/او را»", async () => {
        const p = await page("کتاب رو بده، بذارش رو میز. اون رفت و اونو برد.");
        assert.deepStrictEqual(p.on("رو").map((m) => [m.fix?.text, colour(m)]), [["را", "B"], ["روی", "B"], ["روی", "B"], ["را", "B"]]);
        assert.deepStrictEqual(p.on("اون").map((m) => m.fix?.text), ["آن", "او"]);
        assert.deepStrictEqual(p.on("اونو").map((m) => m.fix?.text), ["آن را", "او را"]);
        // a written sentence too
        const q = await page("این کتاب رو باید در کتابخانه گذاشت.");
        assert.deepStrictEqual(q.on("رو").map((m) => [m.fix?.text, colour(m)]), [["را", "B"], ["روی", "B"]]);
    });

    it("not in the written idioms: «از این رو»، «رو به»، «زیر و رو»، «رو در رو»", async () => {
        for (const t of ["از این رو باید رفت.", "خانه رو به دریا بود.", "همه‌جا را زیر و رو کردند.", "رو در رو نشستند.", "ازین رو آمد."]) {
            assert.ok(!(await lintText(kernel, t, DEFAULT_SETTINGS)).some((m) => m.ruleId === "spoken-ra"), t);
        }
    });

    it("no ping-pong", async () => {
        const texts = ["اون کتاب رو بده بهش.", "رو میز گذاشتمش.", "اونو بردم خونه.", "این کتاب دیگه در کتابخانه موجود است.", "من میخام برم ولی بزار ببینم."];
        for (const t of texts) for (const register of ["auto", "spoken"] as const) assert.deepStrictEqual(await pingPong(t, { ...DEFAULT_SETTINGS, register }), [], t);
        for (const t of texts) assert.deepStrictEqual(await pingPong(t, { ...DEFAULT_SETTINGS, colloquialText: true }), [], t);
    });
});

describe("1.6.2: «کل متن محاوره‌ای است» (colloquialText)", function () {
    this.timeout(60000);
    const T = "اون ناپدید شد؟\nمن اینجا رو می‌شناسم.\nاین کتاب دیگه در کتابخانه موجود است.\nمن میخام برم.";

    it("without it: register cards on the lines read as written", async () => {
        const p = await page(T);
        assert.ok(p.on("اون").length && p.on("رو").length && p.on("دیگه").length, JSON.stringify(p.shown.map((m) => at(p.text, m))));
    });

    it("with it: no register card anywhere, and the errors stay (red «میخام»)", async () => {
        const s = { ...DEFAULT_SETTINGS, colloquialText: true };
        const p = await page(T, s);
        assert.deepStrictEqual(p.shown.filter((m) => m.ruleId === "spoken-word" || m.ruleId === "spoken-ra").map((m) => at(p.text, m)), []);
        assert.ok(p.on("میخام").some((m) => isCertainMsg(m) && m.fix?.text === "می‌خوام"));
        // which rules run per sentence does not change: the written sentence still gets ویرایش زبانی
        const formal = "در ارتباط با این موضوع باید گفت که او آمد.";
        const a = (await lintText(kernel, formal, DEFAULT_SETTINGS)).map((m) => m.ruleId).sort();
        const b = (await lintText(kernel, formal, s)).map((m) => m.ruleId).sort();
        assert.deepStrictEqual(b, a);
    });
});

describe("1.6.2: a fix never hides another rule's mark on the corrected word (the iPhone bug)", function () {
    this.timeout(60000);
    /** As the page records a fix it just made (app.ts, applyFix). */
    const just = (before: string, fixes: Array<{ range: [number, number]; text: string }>, rank = 0) => {
        let d = 0;
        const spans: Array<[number, number]> = [];
        for (const f of [...fixes].sort((a, b) => a.range[0] - b.range[0])) {
            for (const e of editsOf(before, f.range, f.text)) {
                spans.push([e.pos + d, e.pos + d + e.inserted.length]);
                d += e.inserted.length - e.removed.length;
            }
        }
        let after = before;
        for (const f of [...fixes].sort((a, b) => b.range[0] - a.range[0])) after = applyFix(after, f);
        return { before, after, spans, rank };
    };

    it("«ايرانيها» → «ایرانیها» (auto-fix off): the plural «ها» card on the corrected word stays", async () => {
        const t = "نحوه استفاده ايرانيها از اين قابليتها";
        const msgs = await lintText(kernel, t, DEFAULT_SETTINGS);
        const w = t.indexOf("ايرانيها");
        const reds = msgs.filter((m) => isCertainMsg(m) && m.range[0] >= w && m.range[1] <= w + 8);
        assert.strictEqual(reds.length, 2);
        const j = just(t, reds.map((m) => m.fix!));
        const after = await lintText(kernel, j.after, DEFAULT_SETTINGS);
        const plural = after.filter((m) => m.ruleId === "plural-ha" && at(j.after, m) === "ایرانیها");
        assert.ok(plural.length && plural.every((m) => !undoesJustApplied(m, j)), JSON.stringify(plural));
        // what is left is exactly what a fresh lint of the result shows
        assert.deepStrictEqual(after.filter((m) => !undoesJustApplied(m, j)).length, after.length);
    });

    it("a report that takes the fix back, or a lower rule that changes the letters just put in, is still left out", () => {
        const before = "کتاب ها";
        const j = just(before, [{ range: [4, 5], text: "‌" }]); // «کتاب‌ها»
        // gives the old text back
        assert.ok(undoesJustApplied({ ruleId: "x", message: "⁤⁣…", range: [0, 8], fix: { range: [4, 5], text: " " } }, j));
        // a lower rule replacing the half-space just put in (a flip)
        assert.ok(undoesJustApplied({ ruleId: "spelling", message: "…", range: [0, 8], fix: { range: [4, 5], text: "" } }, j));
        // a lower rule adding something beside it is not a flip
        assert.ok(!undoesJustApplied({ ruleId: "spelling", message: "⁣…", range: [0, 8], fix: { range: [8, 8], text: "ی" } }, j));
    });

    it("«همه»: every identical card's fix in one step leaves the marks a fresh lint gives", async () => {
        const t = "من میخام برم. تو هم میخام بگی. ولی من نمیخام.";
        const msgs = await lintText(kernel, t, DEFAULT_SETTINGS);
        const same = msgs.filter((m) => isCertainMsg(m) && at(t, m) === "میخام");
        assert.strictEqual(same.length, 2);
        const j = just(t, same.map((m) => m.fix!));
        assert.ok(!/(^|[^ن])میخام/.test(j.after) && j.after.includes("نمیخام"), j.after);
        const after = await lintText(kernel, j.after, DEFAULT_SETTINGS);
        assert.ok(after.some((m) => at(j.after, m) === "نمیخام" && isCertainMsg(m)));
        assert.deepStrictEqual(after.filter((m) => undoesJustApplied(m, j)), []);
    });
});
