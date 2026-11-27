import assert from "assert";
import { TextlintKernel } from "@textlint/kernel";
import { DEFAULT_SETTINGS, Msg, isCertainMsg, isAuto, isBlue, makeLint, conflictsOf, outranked, oneAnswerPerSpan, applyFix } from "../src/lint-setup";
import { pingPong } from "./ping-pong";

/*
 * 1.6.1: a precision release. The false red marks 1.6.0 left behind (each one's cause, fixed for its
 * whole class), fewer wrong yellow guesses, fewer blue cards, one card per change.
 */
const kernel = new TextlintKernel();
const at = (t: string, m: Msg) => t.slice(m.range[0], m.range[1]);
const colour = (m: Msg) => (isCertainMsg(m) ? "R" : isBlue(m) ? "B" : "Y");

/** What the page shows after its automatic typing fixes: not silent, not outranked, one answer per word. */
async function page(text0: string) {
    const lint = makeLint(kernel, DEFAULT_SETTINGS);
    const alint = makeLint(kernel, DEFAULT_SETTINGS, false, true);
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
const reds = (ms: Msg[]) => ms.filter(isCertainMsg);

describe("1.6.1: the false reds 1.6.0 left", function () {
    this.timeout(60000);

    it("«لبهام» (my lips): both readings, a judgement, not «لبه‌ام» in red", async () => {
        for (const t of ["لبهام خشک شده بود و دستام می‌لرزید.", "لبهام رو گاز گرفتم دیگه.", "چشمهام درد می‌کنه، نمی‌دونم چرا."]) {
            const p = await page(t);
            const w = t.split(" ")[0];
            assert.deepStrictEqual(reds(p.on(w)), [], t);
            const fixes = p.on(w).map((m) => m.fix?.text);
            assert.ok(fixes.length === 2 && fixes.every((f) => f && f.includes("‌")), `${t}: ${fixes}`);
            assert.ok(fixes[0]!.includes("‌ها"), `the plural first: ${fixes}`);
        }
        // a written sentence, a word no one says so («خان‌هام»): still the book's red
        const p = await page("من از خانهام بیرون آمدم.");
        assert.deepStrictEqual(reds(p.on("خانهام")).map((m) => m.fix?.text), ["خانه‌ام"]);
    });

    it("«پسرو»، «گلوش»، «چشمشو»، «جلوش»: a word with a pronoun or the spoken «را», no compound of the farhang", async () => {
        for (const [t, w] of [["پسرو دیدم که داشت میومد.", "پسرو"], ["گلوش درد می‌کنه.", "گلوش"], ["چشمشو بست و خوابید.", "چشمشو"], ["از جلوش رد شدم.", "جلوش"], ["دستشو گرفت و رفتیم.", "دستشو"]]) {
            const p = await page(t);
            assert.deepStrictEqual(p.on(w).map((m) => [m.ruleId, m.fix?.text]), [], t);
        }
        // the compounds themselves still: «خوشرو» → «خوش‌رو»
        const p = await page("او آدم خوشرو و مهربانی است.");
        assert.ok(reds(p.on("خوشرو")).some((m) => m.fix?.text === "خوش‌رو"));
    });

    it("«همتون، همشون» are «همه‌تون، همه‌شون»: never «هم‌تون»", async () => {
        for (const t of ["همتون رو دوست دارم.", "همشون اومدن خونه‌مون.", "دست هممون درد نکنه."]) {
            const p = await page(t);
            const w = t.split(" ").find((x) => x.startsWith("هم"))!;
            assert.ok(!p.shown.some((m) => m.fix?.text.startsWith("هم‌")), `${t}: ${p.shown.map((m) => m.fix?.text)}`);
            assert.deepStrictEqual(reds(p.on(w)), [], t);
        }
        // in a written sentence the written form, a recommendation: «همه‌تان»
        const p = await page("همتون در جلسه حضور داشتید و گزارش را خواندید.");
        assert.deepStrictEqual(p.on("همتون").map((m) => [m.fix?.text, colour(m)]), [["همه‌تان", "B"]]);
    });

    it("«باورم» (my belief) is no «بیاورم»; «بانداز» still «بینداز»", async () => {
        assert.deepStrictEqual((await page("باورم نمی‌شه که اومدی.")).on("باورم"), []);
        assert.deepStrictEqual((await page("باورش کن.")).on("باورش"), []);
        assert.deepStrictEqual(reds((await page("سنگ را بانداز.")).on("بانداز")).map((m) => m.fix?.text), ["بینداز"]);
    });

    it("«ضد زیر»، «غیر احمد»: «ضد/غیر» before a phrase or a name is no prefix; «غیر قانونی» still joins", async () => {
        assert.deepStrictEqual((await page("یادش نمیومد ... ضد زیر گریه که بگو.")).shown.filter((m) => m.ruleId === "arabic-prefixes"), []);
        assert.deepStrictEqual((await page("هلیکوپترهای ضد زیر دریایی پرواز کردند.")).shown.filter((m) => m.ruleId === "arabic-prefixes"), []);
        assert.deepStrictEqual((await page("غیر احمد کسی نیامد.")).shown.filter((m) => m.ruleId === "arabic-prefixes"), []);
        const p = await page("این کار غیر قانونی است.");
        assert.deepStrictEqual(reds(p.shown).map((m) => m.fix?.text), ["غیرقانونی"]);
    });

    it("the idiom «از این رو به آن رو» is not the conjunction «ازاین‌رو»", async () => {
        for (const t of ["از این رو به اون رو شد.", "یک دفعه از این رو به آن رو شدید.", "زندگیم از این رو به اونرو شد."]) {
            assert.ok(!(await page(t)).shown.some((m) => m.fix?.text === "ازاین‌رو"), t);
        }
        const p = await page("باران آمد؛ از این رو به خانه برگشتیم.");
        assert.ok(reds(p.shown).some((m) => m.fix?.text === "ازاین‌رو"));
    });

    it("version numbers, addresses, times, ranges in Latin digits are left whole", async () => {
        for (const t of ["نسخه 4.2.0 منتشر شد و خطای 0x80070005 داد.", "آدرس 192.168.1.1 را باز کنید.", "ساعت 12:30 رسیدم.", "ارسال شده در 07:36 PM است.", "از 10..20 درصد کم شد.", "ورژن ویبولتین 4.2.2 است.", "نسخهٔ 2.5 آمد."]) {
            const p = await page(t);
            assert.deepStrictEqual(p.shown.filter((m) => /[0-9]/.test(at(p.text, m))).map((m) => at(p.text, m)), [], t);
        }
        // a number standing alone still gets Persian digits (red, never silent)
        const p = await page("در سال 2020 رفتم.");
        assert.deepStrictEqual(reds(p.on("2020")).map((m) => m.fix?.text), ["۲۰۲۰"]);
        assert.ok(!(await makeLint(kernel, DEFAULT_SETTINGS)("در سال 2020 رفتم.")).some((m) => isAuto(m, "در سال 2020 رفتم.")));
    });

    it("«یک..دو..سه»: two dots between words are a pause or a stop, the writer's choice (yellow, «…» first)", async () => {
        const p = await page("شمردم یک..دو..سه و پریدم.");
        const dots = p.shown.filter((m) => at(p.text, m) === "..");
        assert.ok(dots.length >= 2);
        assert.deepStrictEqual(reds(dots), []);
        assert.strictEqual(dots[0].fix?.text, "… ");
        // at the end of a sentence still a full stop typed twice (red)
        assert.ok(reds((await page("خیلی خوبه..")).shown).some((m) => m.fix?.text === "."));
    });

    it("«الحمدالله» is red again: the farhang prints «الحمدلله» (p. 71, the «لله» ligature)", async () => {
        const p = await page("الحمدالله که خوبی.");
        assert.deepStrictEqual(reds(p.on("الحمدالله")).map((m) => m.fix?.text), ["الحمدلله"]);
        assert.deepStrictEqual((await page("الحمدلله که خوبی.")).shown, []);
        assert.deepStrictEqual((await page("بارک‌الله به تو.")).shown, []);
    });

    it("found in judging the 1.6.1 samples: «بالاخره من»، «آخه ای خدا»، «ناهارم»، «ساعت 5.30»، «22,23»، «همسره»، «همرام»", async () => {
        for (const [t, w] of [
            ["امید جان بالاخره من این رو استفاده کنم؟", "بالاخره"],
            ["چه روباه خوشگلی هم هست آخه ای خدا", "آخه ای"],
            ["باوجودی که ناهارم دیر شد", "ناهارم"],
            ["ساعت 5.30 رفتم سر کار", "5.30"],
            ["کدوم بهتره واسه 22,23 سال؟", "22,23"],
            ["ب نظرم دست آوردن قلق همسره و بس", "همسره"],
            ["از اینکه گوشیم همرام نبود ناراحت شدم", "همرام"]
        ]) {
            assert.deepStrictEqual(reds((await page(t)).on(w)), [], t);
        }
        // «دیگه ای» is still «دیگه‌ای» (another)
        assert.ok(reds((await page("الان به مشکل دیگه ای برخوردم.")).on("دیگه ای")).some((m) => m.fix?.text === "دیگه‌ای"));
        // «با خوندن مطالب»: the infinitive first
        const p = await page("همه دوستان که با خوندن مطالب خوشحال میشن و میرن.");
        assert.strictEqual(p.on("خوندن")[0]?.fix?.text, "خواندن");
    });

    it("«حال ندارم» is a verb, not the compound «حال‌ندار»", async () => {
        assert.deepStrictEqual((await page("چند روزیه حال ندارم.")).shown.filter((m) => m.ruleId === "spaced-compounds"), []);
    });
});

describe("1.6.1: fewer wrong yellow cards", function () {
    this.timeout(60000);

    it("no ezafe guess on a spoken verb, a pronoun ending written apart, a light verb, a word said twice", async () => {
        for (const [t, w] of [
            ["مورد علاقه تونو می‌گیرین و میرین.", "علاقه"],
            ["دیگه نه علاقه ش برام مونده نه فرصتش.", "علاقه"],
            ["مرحله مرحله توضیح می‌دم.", "مرحله"],
            ["و بعد اجازه بدن مردم خودشان حکومت کنند.", "اجازه"],
            ["برای جبران اون همه خواب آلودگی باید تاوان بدید.", "همه"],
            ["حال می‌ده و عاشقانه ست، اما بارون آلوده‌ست.", "عاشقانه"]
        ]) {
            const p = await page(t);
            assert.deepStrictEqual(p.shown.filter((m) => m.ruleId === "ezafe-he" && at(p.text, m) === w).map((m) => m.fix?.text), [], t);
        }
        // a likely ezafe still asked
        const p = await page("خانه قبلی ما بزرگ بود.");
        assert.ok(p.shown.some((m) => m.ruleId === "ezafe-he" && m.fix?.text === "خانۀ"));
    });

    it("no two-letters-away spelling guess («وعمدی» → «واحدی»); «و» or «که» run in are split", async () => {
        const p = await page("اگه کسی بی دلیل وعمدی بهتون نزدیک بشه ناراحت میشین.");
        assert.deepStrictEqual(p.on("وعمدی").map((m) => m.fix?.text), ["و عمدی"]);
        const q = await page("در حالتیکه به نت متصل میشید حدود 80 مگ رو اشغال می‌کنه.");
        assert.deepStrictEqual(q.on("حالتیکه").map((m) => m.fix?.text), ["حالتی که"]);
    });

    it("spoken inflections are no typos: «میسازنا، ننداخته، گفتینو، شدتون، میومدن، دستامو»", async () => {
        for (const t of ["اینا رو با مقاومت میسازنا!", "مطمئنی ریفر بهمون ننداخته باشن؟", "کاری که شما گفتینو کردم.", "مرغ سرخ شدتون رو اضافه کنید.", "آدما هی میومدن باهام حرف میزدن.", "دلم واسه دستای گرمت که دستامو فشار میداد تنگ شده."]) {
            assert.deepStrictEqual((await page(t)).shown.filter((m) => m.ruleId === "spelling"), [], t);
        }
    });

    it("brackets: a list run on («2)»), a run of one bracket, ornaments are no unpaired brackets", async () => {
        for (const t of ["برخورد با لجبازی: 1) هماهنگ بودن پدر و مادر2) داشتن برنامه", "حالم خوب شه ((((((((((((", "مبارک [گل]*(¸.•*¨(¸.•*¨ ¸.•*´¨)¸.•*[گل]", "خیلی خوبه پاپه))!! دیگه"]) {
            assert.deepStrictEqual((await page(t)).shown.filter((m) => /[()[\]]/.test(at(t, m))), [], t);
        }
        assert.ok((await page("او (که دیر آمد گفت.")).shown.some((m) => at("او (که دیر آمد گفت.", m) === "("));
    });

    it("«اینتر»، «اینقد»، «اینجام» are not «این» + a word; «هم» in speech is «also»", async () => {
        for (const [t, w] of [["هر امتیازی که اینتر ازدست می‌ده.", "اینتر"], ["من اینقد گمراه شدم.", "اینقد"], ["اینجام حالشو بگیره.", "اینجام"]]) {
            assert.deepStrictEqual((await page(t)).on(w), [], t);
        }
        assert.deepStrictEqual((await page("مامانش نمی‌تونه حتی از دو تا پله هم بالا بره.")).on("هم بالا"), []);
    });
});

describe("1.6.1: blue and one card per change", function () {
    this.timeout(60000);

    it("«رو»، «اون»، «اونو» get no card; «یه»، «دیگه» keep theirs; «بهش، بهشون» none", async () => {
        const t = "اون کتاب رو یه بار دیگه بده بهش، اونو هم بده بهشون.";
        const p = await page(t);
        for (const w of ["رو", "اون", "اونو", "بهش", "بهشون"]) assert.deepStrictEqual(p.on(w), [], w);
        assert.deepStrictEqual(p.on("یه").map((m) => [m.fix?.text, colour(m)]), [["یک", "B"]]);
        assert.deepStrictEqual(p.on("دیگه").map((m) => [m.fix?.text, colour(m)]), [["دیگر", "B"]]);
    });

    it("no space asked between a number and an adjective made with it («4کاناله»، «۵کیلویی»): the book joins «۵ساله»", async () => {
        const t = "دوتا جفت بگیرید که 4کاناله بشه و یه ۵کیلویی هم بخرید.";
        assert.deepStrictEqual((await page(t)).shown.filter((m) => m.ruleId === "punctuation" && /کاناله|کیلویی/.test(at(t, m))), []);
    });

    it("the same change on the same letters is one card («منو» had «من را» twice, «بیرحم» a red and a yellow)", async () => {
        for (const t of ["امیدوارم منو ببخشید ولی دیگه نمیشه.", "دخترهایی که اونقدر بیرحم بودن.", "عمر جهان بینهایت باشه."]) {
            const p = await page(t);
            const keys = p.shown.filter((m) => m.fix).map((m) => `${m.range}|${m.fix!.range}|${m.fix!.text}`);
            assert.strictEqual(new Set(keys).size, keys.length, `${t}: ${keys}`);
        }
    });

    it("no ping-pong on the new cases, and the garbled guillemets and «؟ . . .» settle", async () => {
        const texts = [
            "لبهام خشک شده بود و دستام می‌لرزید.", "پسرو دیدم که داشت میومد.", "از این رو به اون رو شد.", "شمردم یک..دو..سه و پریدم.",
            "پیام شناگر زن ایرانی‌: » :»»تسلیم حرف زور نمی‌شم»", "حالا ما باید به چه صورت استفاده کنیم؟ . . .", "الحمدالله که خوبی."
        ];
        for (const t of texts) for (const register of ["auto", "spoken"] as const) assert.deepStrictEqual(await pingPong(t, { ...DEFAULT_SETTINGS, register }), [], t);
    });
});
