import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import { DEFAULT_SETTINGS, Msg, isCertainMsg, isAuto, isBlue, makeLint, conflictsOf, outranked, oneAnswerPerSpan, applyFix } from "../src/lint-setup";

/*
 * 1.6.3 (the owner: «کسرۀ اضافه رو درست کن»): the ezafe cards, measured on cards judged by hand on blog and
 * Wikipedia text. The certain pronoun check («خانه من» ← «خانۀ من», red) only where nothing else can be
 * read; the model's guess (yellow) from 80% in a written sentence, and in a spoken line only for the words
 * that were right every time; no card on names, counters after a number, verbs, «با این همه»…;
 * «فرمانده‌ی سپاه» is a choice, not the red «فرماندهی».
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
    return { text, shown, ezafe: shown.filter((m) => m.ruleId === "ezafe-he").map((m) => `${colour(m)} ${at(text, m)}→${m.fix?.text ?? ""}`) };
}

describe("1.6.3: the ezafe before a pronoun («خانه من» ← «خانۀ من»)", function () {
    this.timeout(60000);
    it("is a suggestion (yellow), no longer red: whether a word is in the ezafe is a reading", async () => {
        assert.deepStrictEqual((await page("خانه من بزرگ است.")).ezafe, ["Y خانه→خانۀ"]);
        assert.deepStrictEqual((await page("این نامه او است.")).ezafe, ["Y نامه→نامۀ"]);
        assert.deepStrictEqual((await page("همه ما می‌دانیم.")).ezafe, ["Y همه→همۀ"]);
    });

    it("no card where the words read otherwise (Wikipedia and blog cards judged wrong in 1.6.2)", async () => {
        for (const t of [
            "با این همه وی به شرکت هند شرقی پیوست.",
            "در نتیجه او در مقابل روانکاوان ایستاد.",
            "پس از این حمله او یک چشم خود را از دست داد.",
            "بله من بودم.",
            "اعوذ بالله من الشیطان الرجیم",
            "اگه اره من چیکار کنم؟"
        ]) {
            assert.deepStrictEqual((await page(t)).ezafe, [], t);
        }
    });

    it("never red where the words read otherwise", async () => {
        for (const t of [
            "با این همه وی به شرکت هند شرقی پیوست.", // «با این همه»: nevertheless
            "در نتیجه او در مقابل روانکاوان ایستاد.", // «در نتیجه»: so
            "پس از این حمله او یک چشم خود را از دست داد.", // «این حمله» ends the phrase
            "پس از اشغال فرانسه او به فعالیت مخفی ادامه داد.", // a country
            "از آنجا که هم‌نام مادرش بود، اعضای خانواده او را «نانی» صدا می‌زدند.", // «او را»: the object
            "کوتاه‌ترین راه، جاده ما بین دو شهر بود.", // «ما بین»: «مابین»
            "بله من بودم.", // an interjection
            "هر دفعه من میومدم بزنم یکی دیگه می‌زد!", // «هر دفعه»: every time
            "چهارشنبه تو راه مدرسه بودم." // spoken «تو»: in
        ]) {
            assert.deepStrictEqual((await page(t)).ezafe.filter((x) => x.startsWith("R")), [], t);
        }
    });
});

describe("1.6.3: the ezafe written «ی» («خانه ی من» ← «خانۀ من», red)", function () {
    this.timeout(60000);
    it("stays red on a noun", async () => {
        assert.deepStrictEqual((await page("کلید خانه ی دوستم را گم کردم.")).ezafe, ["R خانه ی→خانۀ"]);
    });
    it("not on a verb, a spoken preposition, a letter, or a word of the colloquial bank", async () => {
        for (const t of ["اگر قسطی بشه ی کمک بزرگی به ما می‌شه.", "دقیقاً واسه ی ۴شنبه بود.", "سراغ ن و ه ی می‌ره.", "می‌تونی کلید خونه ی عموتو بیاری؟"]) {
            assert.deepStrictEqual((await page(t)).ezafe, [], t);
        }
    });
});

describe("1.6.3: the model's guess (yellow)", function () {
    this.timeout(60000);
    it("in a written sentence from 80%", async () => {
        assert.deepStrictEqual((await page("خانه قبلی را فروخت.")).ezafe, ["Y خانه→خانۀ"]);
        assert.deepStrictEqual((await page("نتیجه نهایی را نشان داد.")).ezafe, ["Y نتیجه→نتیجۀ"]);
    });

    it("in a spoken line only for «همه، درباره، ادامه، زمینه، نسخه»", async () => {
        assert.deepStrictEqual((await page("وقتی وبلاگ جدیدمو بسازم درباره این قضیه می‌خوام بنویسم.")).ezafe, ["Y درباره→دربارۀ"]);
        for (const t of [
            "رفتم به راننده گفتم آقا نگه دار.", // a verb next
            "یه نقشه کشیدن که به همه نسبت بدن.", // an object before its verb
            "شاید یه بسته شایدم بیشتر کشید.",
            "تا هاله جون شیرینی رو نیاورد ول نکرد.", // a name
            "خاله فاطمه اومد پیش من.", // a kinship word before a name
            "ایده ال خود شما چیه؟", // «ایده‌آل» written apart
            "تقریباً ۲ ساله ول معطل این دانشگاهم." // «ساله» after a number
        ]) {
            assert.deepStrictEqual((await page(t)).ezafe, [], t);
        }
    });

    it("no card on a counter after a number, nor before a verb, in writing", async () => {
        for (const t of ["کل بنا از ۲۴ قطعه سنگ ساخته شده است.", "آن‌ها هر روز دو حلقه فیلم کمدی داشتند.", "او را شیفته خود کرده است."]) {
            assert.deepStrictEqual((await page(t)).ezafe, [], t);
        }
    });
});

describe("1.6.3: «فرمانده‌ی سپاه»", function () {
    this.timeout(60000);
    it("before a word: a choice between «فرماندهِ» (the ezafe) and «فرماندهی», never red", async () => {
        const p = await page("فرمانده‌ی سپاه آمد.");
        const on = p.shown.filter((m) => at(p.text, m) === "فرمانده‌ی");
        assert.ok(on.length >= 1 && on.every((m) => colour(m) === "Y"), JSON.stringify(on));
        assert.deepStrictEqual(on.map((m) => m.fix!.text).sort(), ["فرماندهِ", "فرماندهی"].sort());
    });
    it("before a mark it is the word «فرماندهی» (red, as before)", async () => {
        const p = await page("مقام فرمانده‌ی.");
        assert.deepStrictEqual(p.shown.filter((m) => at(p.text, m) === "فرمانده‌ی").map((m) => `${colour(m)} ${m.fix!.text}`), ["R فرماندهی"]);
    });
});
