import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import {
    DEFAULT_SETTINGS, Msg, lintText, lintOptions, baseRule, isCertainMsg, isAuto, isTentative, splitMessage, makeLint,
    conflictsOf, outranked, oneAnswerPerSpan, contradict, severity, wordAround, applyCertain, Settings
} from "../src/lint-setup";
import { RULE_LABELS, explainChange, visible } from "../src/labels";
import { pingPong } from "./ping-pong";
import { readFileSync } from "fs";
import { join } from "path";

/*
 * 1.5.2: the user's reports from the live site (card order, a raw rule id as a chip, an ezafe on a
 * verb, two red cards that contradict on «اینهمه», guillemets typed backwards, «..», «ک/ب/ی/اگ»,
 * the missing «آ», «به» + pronoun, names, changes that look the same on both sides).
 */
const kernel = new TextlintKernel();
const lint = (t: string, s: Settings = DEFAULT_SETTINGS) => lintText(kernel, t, s);
const at = (t: string, m: Msg) => t.slice(m.range[0], m.range[1]);

/** What the page shows: not silent, not outranked (noPingPong), one answer per word (oneAnswerPerSpan). */
async function shown(text: string, s: Settings = DEFAULT_SETTINGS) {
    const l = makeLint(kernel, s);
    const msgs = await l(text);
    const keep: Msg[] = [];
    for (const m of msgs) {
        if (isAuto(m, text)) continue;
        if (m.fix && outranked(m, await conflictsOf(l, text, m, msgs))) continue;
        keep.push(m);
    }
    return oneAnswerPerSpan(l, text, keep);
}

const USER_SPOKEN = "خلاصه باید اول نامه رو از دفترخونه گرفته بره اداره کف، بعد کف قبول میکنه مدارک رو و میگه باید اونجا هم تأیید بشه. اگه امضا نداشته باشه نامه باطل بشه و باید دوباره بری.";

describe("1.5.2", function () {
    it("every rule the page can run has a Persian chip (never a raw id like «spoken-spelling»)", () => {
        const ids = new Set<string>();
        for (const part of ["common", "formal", "spoken"] as const) for (const r of lintOptions(DEFAULT_SETTINGS, false, false, part).rules) ids.add(baseRule(r.ruleId));
        const missing = [...ids].filter((id) => !RULE_LABELS[id] || /^[a-z-]+$/.test(RULE_LABELS[id]));
        assert.deepStrictEqual(missing, []);
        assert.strictEqual(RULE_LABELS["spoken-spelling"], "املای شکسته");
        assert.strictEqual(RULE_LABELS["spoken-word"], "واژۀ محاوره‌ای");
    });

    it("the user's text: «میکنه» gets its red «می‌کنه» and no ezafe; no ezafe on «بره، بشه، باشه، گرفته»", async () => {
        const msgs = await shown(USER_SPOKEN);
        const ez = msgs.filter((m) => m.ruleId === "ezafe-he").map((m) => at(USER_SPOKEN, m));
        for (const w of ["میکنه", "بره", "بشه", "باشه", "گرفته", "نامه"]) assert.ok(!ez.includes(w), `${w} in ${ez}`);
        const mk = msgs.filter((m) => at(USER_SPOKEN, m) === "میکنه");
        assert.deepStrictEqual(mk.map((m) => [m.ruleId, m.fix?.text, severity(m)]), [["spoken-spelling", "می‌کنه", 0]]);
    });

    it("cards in a mark: the red one first (severity, then precedence); the mark's colour is the first card's", async () => {
        // the order oneAnswerPerSpan and the page use: red, yellow, blue
        const red: Msg = { ruleId: "spoken-spelling", message: "x (دستور خط، ص ۳۹)", range: [0, 5], fix: { range: [0, 5], text: "می‌کنه" } };
        const yellow: Msg = { ruleId: "ezafe-he", message: "⁣اگر … (احتمال ۷۲٪) (دستور خط، ص ۴۷)", range: [0, 5], fix: { range: [0, 5], text: "میکنۀ" } };
        const blue: Msg = { ruleId: "spoken-word", message: "⁤y (اصول شکسته‌نویسی)", range: [0, 5], fix: { range: [0, 5], text: "می‌کند" } };
        const sorted = [blue, yellow, red].sort((a, b) => severity(a) - severity(b));
        assert.deepStrictEqual(sorted.map((m) => m.ruleId), ["spoken-spelling", "ezafe-he", "spoken-word"]);
        // the page's own sort (app.ts renderMarks) uses severity first: checked here on the source
        const src = readFileSync(join(__dirname, "..", "src", "app.ts"), "utf8");
        assert.ok(/sp\.items\.sort\(\(a, b\) => cardSeverity\(a\) - cardSeverity\(b\) \|\| cardRank\(a\) - cardRank\(b\)/.test(src));
        assert.ok(/sp\.red = cardSeverity\(sp\.items\[0\]\) === 0/.test(src));
    });

    it("no ping-pong on the user's text, and a moot lower card is left out", async () => {
        assert.deepStrictEqual(await pingPong(USER_SPOKEN, DEFAULT_SETTINGS), []);
        const l = makeLint(kernel, DEFAULT_SETTINGS);
        const t = "بعد کف قبول میکنه مدارک رو";
        const red: Msg = { ruleId: "spoken-spelling", message: "در شکل شکسته هم «می» با نیم‌فاصله به فعل می‌چسبد: «می‌کنه» (دستور خط، «می و همی»، ص ۳۹)", range: [11, 16], fix: { range: [11, 16], text: "می‌کنه" } };
        const ez: Msg = { ruleId: "ezafe-he", message: "⁣اگر «میکنه» در حالت اضافه است (احتمال ۷۲٪)، «میکنۀ» نوشته می‌شود (دستور خط، «کسرۀ اضافه»، ص ۴۷)", range: [11, 16], fix: { range: [11, 16], text: "میکنۀ" } };
        assert.ok(contradict(t, red, ez));
        const out = await oneAnswerPerSpan(l, t, [ez, red]);
        assert.deepStrictEqual(out.map((m) => m.ruleId), ["spoken-spelling"]);
    });

    it("«اینهمه»: one yellow card with «این‌همه» and «این همه», never two red ones", async () => {
        for (const [t, first] of [
            ["اینهمه تلاش کردیم مدارک به موقع برسه", "این‌همه"],
            ["با اینهمه، او نیامد.", "این‌همه"],
            ["اینهمه در یک روز نمی‌گنجد.", "این همه"]
        ]) {
            const msgs = (await shown(t)).filter((m) => at(t, m).includes("همه"));
            assert.ok(msgs.length >= 1 && msgs.every((m) => !isCertainMsg(m)), JSON.stringify(msgs));
            assert.deepStrictEqual([...new Set(msgs.map((m) => m.fix!.text))].sort(), ["این همه", "این‌همه"].sort(), t);
            assert.strictEqual(msgs[0].fix!.text, first, t);
        }
        // the farhang's «این‌قدر/آن‌چنان/این‌چنین»: word-spacing never asks for a space against it
        for (const t of ["اینقدر خسته بود", "آنچنان رفت", "اینچنین گفت", "اینسان ماند"]) {
            const msgs = await shown(t);
            const fixes = new Set(msgs.filter((m) => m.fix && m.range[0] === 0).map((m) => m.fix!.text));
            assert.strictEqual(fixes.size, 1, `${t}: ${[...fixes]}`);
        }
    });

    it("two reports on one word that disagree are one card: oneAnswerPerSpan groups equals, drops the lower", async () => {
        const l = async () => [] as Msg[];
        const a: Msg = { ruleId: "word-spacing", message: "a (دستور خط، ص ۳۴)", range: [0, 6], fix: { range: [0, 6], text: "این همه" } };
        const b: Msg = { ruleId: "dictionary", message: "b (فرهنگ املایی، ص ۸۲)", range: [0, 6], fix: { range: [0, 6], text: "این‌همه" } };
        const out = await oneAnswerPerSpan(async (t) => (t === "این همه" ? [{ ...b, range: [0, 7] }] : t === "این‌همه" ? [{ ...a, range: [0, 7] }] : []), "اینهمه", [a, b]);
        assert.strictEqual(out.length, 2);
        assert.ok(out.every((m) => (m as any).group && !isCertainMsg(m)));
        const low: Msg = { ruleId: "spelling", message: "⁣c (غلط‌یاب (در دستور خط نیامده))", range: [0, 6], fix: { range: [0, 6], text: "این سان" } };
        const out2 = await oneAnswerPerSpan(l, "اینهمه", [b, low]);
        assert.deepStrictEqual(out2.map((m) => m.ruleId), ["dictionary"]);
    });

    it("guillemets: «فلک »حتی» → «فلک» حتی», a backwards pair, «( متن )», «فلک»،»", async () => {
        const fix = async (t: string) => applyCertain(t, await lint(t));
        assert.strictEqual(await fix("او گفت «ای فلک »حتی یک روز آرام نبود."), "او گفت «ای فلک» حتی یک روز آرام نبود.");
        assert.strictEqual(await fix("او گفت »سلام« و رفت."), "او گفت «سلام» و رفت.");
        assert.strictEqual(await fix("( متن ) را خواند."), "(متن) را خواند.");
        assert.deepStrictEqual((await lint("او «فلک»، و «فلک». رفت.")).filter((m) => m.ruleId === "punctuation"), []);
        // typed backwards and paired up: a silent typing fix
        const t = "او گفت »سلام« و رفت.";
        assert.ok((await lint(t)).filter((m) => m.ruleId === "punctuation").every((m) => isAuto(m, t)));
        // a lone one: both readings, one yellow card, the space moved first
        const lone = "فلک »حتی";
        const ms = (await lint(lone)).filter((m) => m.ruleId === "punctuation" && m.fix);
        assert.deepStrictEqual(ms.map((m) => m.fix!.text), ["» ", " «"]);
        assert.ok(ms.every((m) => !isCertainMsg(m)));
    });

    it("«..»: red «.», a second button «…»; «..!» and « ..کلمه»; «...» is a silent fix", async () => {
        for (const [t, want] of [
            ["تو قرار می‌گیری.. دنیا چرخش داره", "."],
            ["انرژی مثبت باشن ..کلمات قدرت دارن", ". "],
            ["تموم شده..! برو", ""],
            ["خدا ..زندگی رو", ". "]
        ]) {
            const ms = (await lint(t)).filter((m) => m.ruleId === "punctuation" && /دو نقطه/.test(m.message));
            assert.ok(ms.length === 2, t);
            assert.strictEqual(ms.find(isCertainMsg)!.fix!.text, want, t);
            assert.ok(ms.some((m) => !isCertainMsg(m) && m.fix!.text.startsWith("…")), t);
        }
        const e = "داره... بیا";
        assert.ok((await lint(e)).some((m) => m.ruleId === "punctuation" && isAuto(m, e) && m.fix!.text === "…"));
    });

    it("a change that looks the same on both sides is said in words", async () => {
        assert.deepStrictEqual(explainChange("داره...", "داره…"), ["سه نقطۀ جدا", "یک نویسۀ سه‌نقطه"]);
        assert.deepStrictEqual(explainChange("علي", "علی"), ["«ی» عربی", "«ی» فارسی"]);
        assert.deepStrictEqual(explainChange("۲۰ درصد", "۲۰ درصد"), ["فاصلۀ معمولی", "فاصلۀ نشکن"]);
        assert.strictEqual(explainChange("میرود", "می‌رود"), null); // the half-space can be seen
        // every card the page could show on these texts: if the two sides look alike, it has words for it
        const text = "خانهٔ او داره... بیا. علي و كتاب و ۲۰ درصد​ و ٤ و سلام‏.\nسال ١٤٠٤ و آنهـا";
        for (const m of await lint(text)) {
            if (!m.fix) continue;
            const [ws, we] = wordAround(text, Math.min(m.range[0], m.fix.range[0]), Math.max(m.range[1], m.fix.range[1]));
            const before = text.slice(ws, we);
            const after = text.slice(ws, m.fix.range[0]) + m.fix.text + text.slice(m.fix.range[1], we);
            if (before === after || visible(before) !== visible(after)) continue;
            const words = explainChange(before, after);
            assert.ok(words && !words.join(" ").includes("U+"), `${m.ruleId}: ${JSON.stringify(before)} → ${JSON.stringify(after)}: ${words}`);
        }
    });

    it("«به» + a pronoun is never marked, in any register", async () => {
        for (const reg of ["auto", "formal", "spoken"] as const) {
            const t = "بهش گفتم، بهشون گفتم، بهت گفتم، بهتون گفتم، بهم گفت، بهمون گفت.";
            const ms = (await lint(t, { ...DEFAULT_SETTINGS, register: reg })).filter((m) => /^به/.test(at(t, m)));
            assert.deepStrictEqual(ms.map((m) => `${m.ruleId}: ${at(t, m)}`), [], reg);
        }
    });

    it("names are not typos: «مهردخت»، «مهرانگیز»، «فرخ‌لقا»، «سیدمحمدرضا»، «رضاپور»", async () => {
        const t = "دیروز مهردخت و مهرانگیز و فرخ‌لقا و سیدمحمدرضا و رضاپور و غلامعلی و آزرمیدخت آمدند.";
        assert.deepStrictEqual((await lint(t)).filter((m) => m.ruleId === "spelling").map((m) => at(t, m)), []);
        // and a typo is still one
        assert.ok((await lint("مفابل خانه ایستاد.")).some((m) => m.ruleId === "spelling"));
    });

    it("chat typing: «ک»، «ب»، «ی»، «اگ»، «همونقدرک»، the missing «آ» («ادما»، «ادم»، «ازارش»)", async () => {
        const t = "قشنگ‌ترین کاری ک ادما میتونن انجام بدن اینه ک انرژی مثبت باشن ..کلمات قدرت عجیبی دارن میتونن ی ادم رو امیدوار کنن. همونقدرک لبخند میزنی بسپار ب خدا. اگ درگیرش بشی ازارش میدی.";
        const ms = await lint(t);
        const fixesOf = (w: string) => ms.filter((m) => at(t, m) === w || (m.ruleId === "typing-shortcuts" && t.slice(m.range[0]).startsWith(w) && m.fix!.text === "آ")).map((m) => m.fix?.text);
        assert.ok(fixesOf("ک").includes("که"));
        assert.ok(fixesOf("ب").includes("به"));
        assert.ok(fixesOf("ی").includes("یه") && fixesOf("ی").includes("یک"));
        assert.ok(fixesOf("اگ").includes("اگه") || fixesOf("اگ").includes("اگر"));
        assert.ok(ms.some((m) => at(t, m) === "همونقدرک" && m.fix?.text === "همونقدر که"));
        for (const w of ["ادما", "ادم", "ازارش"]) assert.ok(ms.some((m) => m.ruleId === "typing-shortcuts" && m.fix?.text === "آ" && t.slice(m.range[0]).startsWith(w)), w);
        // not: a letter's name, a list item, an abbreviation, the ezafe written apart, «اینه»
        const not = "حرف ک و حرف ب و بند ب و الف و ب و ج. ساعت ۵ ب.ظ رفت. خانه ی من. اینه ک گفتم.";
        const bad = (await lint(not)).filter((m) => m.ruleId === "typing-shortcuts" && at(not, m) !== "ک");
        assert.deepStrictEqual(bad.map((m) => at(not, m)), []);
    });

    it("the user's colloquial paragraph: the orthography rules stay on («بی مهری»، «سواستفاده»، «..!»، «اگ»)", async () => {
        const t = "اگر روزی قربانی قضاوت، فریب، تمسخر، دل شکستن، سواستفاده یا بی مهری کسی شدی فکر نکن دنیا همونجا تموم شده..! چون اگ درگیرش بشی خسته میشی. برای مدت ها توی ذهنش موند و زخم ها خوب نشد. کنی.. ببخش و بسپار ب خدا.";
        for (const reg of ["auto", "spoken", "formal"] as const) {
            const ms = await lint(t, { ...DEFAULT_SETTINGS, register: reg });
            const has = (w: string, fix: string) => ms.some((m) => t.slice(m.range[0], m.range[1]).includes(w) && m.fix?.text === fix);
            assert.ok(has("بی ", "بی‌"), reg);
            assert.ok(has("سواستفاده", "سوءاستفاده"), reg);
            assert.ok(has("مدت ها", "مدت‌ها") && has("زخم ها", "زخم‌ها"), reg);
            assert.ok(ms.some((m) => /دو نقطه/.test(m.message) && t.slice(m.range[0], m.range[1]) === ".."), reg);
            assert.ok(has("اگ", "اگه") || has("اگ", "اگر"), reg);
        }
    });

    it("the same string gets the same orthography verdict in a written and in a spoken sentence", async () => {
        const words = ["بی مهری", "سواستفاده", "مدت ها", "کتاب ها", "میرود", "اینهمه", "زکوة", "رييس", "مسئولیت پذیری", "ادم", "بزرگ تر"];
        const formal = (w: string) => `او در این باره گفت که ${w} را باید دید.`;
        const spoken = (w: string) => `اون گفت ${w} رو باید دید دیگه.`;
        const ORTHO = (m: Msg) => !["over-broken", "may-break", "spoken-spelling", "spoken-word", "ezafe-he", "spelling", "typing-shortcuts"].includes(m.ruleId) && !/^(redundant|arabic-plurals|prepositions|calques|redundancy|repeated|long|ra-|comma|word-choice|phrases)/.test(m.ruleId);
        for (const w of words) {
            const verdict = async (t: string) => {
                const i = t.indexOf(w);
                return (await lint(t)).filter((m) => ORTHO(m) && m.range[0] >= i && m.range[1] <= i + w.length && m.fix).map((m) => `${m.ruleId}|${m.fix!.text}|${isCertainMsg(m)}`).sort().join(";");
            };
            assert.strictEqual(await verdict(spoken(w)), await verdict(formal(w)), w);
        }
    });
});
