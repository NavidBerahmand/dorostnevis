import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import { DEFAULT_SETTINGS, Msg, lintText, isCertainMsg, isTentative, splitMessage, isAuto, applyCertain } from "../src/lint-setup";

/*
 * What the page shows (since 1.4.0): every yellow or blue item carries its replacement (a
 * button), one per alternative its message names; a homograph is never red; the same error is
 * found the same way wherever it stands.
 */
const kernel = new TextlintKernel();
const lint = async (t: string, s = DEFAULT_SETTINGS) => lintText(kernel, t, s);
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

    it("silent fixes: «هٔ» → «ۀ» (since 1.5.0), a missing tanvin, a comma before another mark, the dash, no-break spaces", async () => {
        const text = "خانهٔ او ایضا هستند،: علی و ساختمان—مثل کوه به ۲۰ درصد در ۲۵ مهر (ص ۲۳۹)";
        const auto = (await lint(text)).filter((m) => isAuto(m, text)).map((m) => m.fix!.text);
        for (const want of ["ۀ", "ایضاً", ":", " —\u00A0", "\u00A0"]) assert.ok(auto.includes(want), `${want} in ${JSON.stringify(auto)}`);
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

    it("1.5.0: the user's spoken text: nothing absurd, only its spoken spelling and the book's shekaste rules", async () => {
        const text = [
            "میرم سمت صندوق و کارت رو میدم به خانم صندوقدار با لبخند میگه: مبارکت باشه عزیزم رمزت رو وارد کن لطفاً. کارت رو پس می‌گیرم. از سه هفته پیش ۲۰۰ تومان گرون تر شده.",
            "میگم: خانما همگی خسته نباشید خدا نگهدار.",
            "از در خروجی سالن اومدم بیرون. باد سرد زد توصورتم. برای بار هزارم چمدون‌های تامی و تیلی هر دو روی لحاف و زیر پامون"
        ].join("\n");
        const shown = (await lint(text)).filter((m) => !isAuto(m, text));
        const marks = shown.map((m) => `${m.ruleId}:${text.slice(m.range[0], m.range[1])}→${m.fix?.text ?? ""}`);
        // no typo guess at all («نمونهای»، «تمدنهای»، «خانم»، «خان ما» before 1.5.0)
        assert.deepStrictEqual(shown.filter((m) => m.ruleId === "spelling").map((m) => m.message), []);
        const allowed = new Set(["میرم", "میدم", "میگه", "میگم", "رو", "گرون", "خانما", "اومدم", "توصورتم"]);
        const odd = shown.filter((m) => !allowed.has(text.slice(m.range[0], m.range[1])));
        assert.deepStrictEqual(odd.map((m) => `${m.ruleId}: ${splitMessage(m).text}`), [], marks.join(" | "));
        for (const w of ["میرم", "میدم", "میگه", "میگم"]) assert.ok(shown.some((m) => text.slice(m.range[0], m.range[1]) === w && m.fix?.text === w.replace(/^می/, "می\u200c")), w);
        assert.ok(shown.some((m) => m.fix?.text === "تو صورتم"));
        // «گرون تر» → «گرون‌تر»: a silent typing fix, in its spoken form
        assert.ok((await lint(text)).some((m) => isAuto(m, text) && m.fix?.text === "گرون\u200cتر"));
    });

    it("1.5.0: spoken words in a written sentence: the written form, blue; no typo guess", async () => {
        const text = "در جلسهٔ امروز گرون شدن قیمت‌ها بررسی شد و نتیجه را اعلام کردند. مأموران چمدون‌های مسافران را گشتند.";
        const shown = (await lint(text)).filter((m) => !isAuto(m, text));
        const blue = shown.filter((m) => m.ruleId === "spoken-word");
        assert.deepStrictEqual(blue.map((m) => m.fix?.text), ["گران", "چمدان\u200cهای"]);
        assert.ok(blue.every((m) => isTentative(m) && m.message.startsWith("\u2064")));
        assert.deepStrictEqual(shown.filter((m) => m.ruleId === "spelling"), []);
    });

    it("1.5.0: written prose with a spoken quotation: shekaste rules inside the quotation only", async () => {
        const text = "او به خانه رفت و در را بست. مادرش گفت: «کجا بودی؟ دیگه نمیدونم باهات چیکار کنم.» پسر جواب نداد.";
        const msgs = await lint(text);
        const q = text.indexOf("«");
        const shek = msgs.filter((m) => ["over-broken", "may-break", "spoken-spelling"].includes(m.ruleId));
        assert.ok(shek.length > 0 && shek.every((m) => m.range[0] > q && m.range[0] < text.indexOf("»")), JSON.stringify(shek.map((m) => m.range)));
        assert.ok(!msgs.some((m) => m.ruleId === "spoken-word"));
    });

    it("1.5.1: in dialogue, a spoken word written in another form is yellow; its half-space is red", async () => {
        const text = "ـ خانما، دیروز اومدم دنبالت و یه کتابو آوردم. میگه نمیدونم. رفتم پیش خالهم.";
        const msgs = await lint(text);
        const at = (w: string) => msgs.filter((m) => m.ruleId === "over-broken" && text.slice(m.range[0], m.range[1]) === w);
        for (const [w, want] of [["خانما", "خانم\u200cها"], ["اومدم", "آمدم"], ["یه", "یک"], ["کتابو", "کتاب را"]]) {
            const ms = at(w);
            assert.ok(ms.length && ms.every((m) => !isCertainMsg(m) && !isAuto(m, text) && isTentative(m)), w);
            assert.ok(ms.some((m) => m.fix?.text === want), `${w} → ${want}`);
        }
        // «درست‌کن» leaves the spoken words as they are
        const fixed = applyCertain(text, msgs);
        for (const w of ["خانما", "اومدم", "یه", "کتابو"]) assert.ok(fixed.includes(w), fixed);
        // the spelling of the spoken form stays red: «میگه» → «می‌گه»، «خالهم» → «خاله‌م»
        assert.ok(msgs.some((m) => isCertainMsg(m) && m.fix?.text === "می\u200cگه"));
        assert.ok(at("خالهم").some((m) => isCertainMsg(m) && m.fix?.text === "خاله\u200cم"));
    });

    it("recommendations are blue and never red", async () => {
        const msgs = await lint("شباهتهای آنها و این خانه توسط پدرم ساخته شد.");
        const ha = msgs.find((m) => m.ruleId === "plural-ha")!;
        assert.ok(isTentative(ha) && ha.message.startsWith("⁤"));
    });
});
