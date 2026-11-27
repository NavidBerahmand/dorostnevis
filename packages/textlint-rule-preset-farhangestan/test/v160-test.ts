/*
 * 1.6.0: informal Persian (the study of 2.9 million sentences of blogs and forums).
 */
import assert from "assert";
import TextLintTester from "textlint-tester";
import typingShortcuts from "../src/rules/typing-shortcuts";
import misspellings from "../src/rules/misspellings";
import wordSpacing from "../src/rules/word-spacing";
import lexicon from "../src/rules/lexicon";
import copulaAttachment from "../src/rules/copula-attachment";
import punctuation from "../src/rules/punctuation";
import miPrefix from "../src/rules/mi-prefix";
import normalizeCharacters from "../src/rules/normalize-characters";
import dictionary from "../src/rules/dictionary";
import joinedWords from "../src/rules/joined-words";
import { spellingCheck, spokenInflection } from "../src/util/speller";
import { missingMadd } from "../src/util/madd";
import { inv, z } from "./helpers";

/** A report without a fix on the command line (a judgement or a recommendation on the page). */
const ask = (text: string, count = 1) => ({ text, output: text, errors: Array.from({ length: count }, () => ({})) });

new TextLintTester().run("typing-shortcuts (1.6.0)", typingShortcuts, {
    valid: [
        "سی ان ان گزارش داد.", "دی ان ای انسان", "ان شاء الله", "اشهد ان لا اله", "هـمـان روز", // «ان»: not here
        "دستگاه اره برقی", "با اره بریدم", // the saw
        "نزار قبانی شاعر بود.", "تن نزار", // the poet, gaunt
        "خاسته از دل", "برخاست و رفت", // «خاستن» (to rise)
        "خنده: خخخخ و هههههه", // laughter
        "اسرائیل و پروتئین", "خدائی", // the book's hamza words; the ending «ی» is copula-attachment's
        "خانم ب آمد.", "ویتامین ک دارد.", // an initial, a vitamin
        "یکم صبر کن"
    ],
    invalid: [
        ask("ان روز رفتم."), // a written sentence: yellow
        inv("ان روز رفتم خونه، نمیدونستم.", "آن روز رفتم خونه، نمیدونستم."), // a spoken one: red
        inv("اب خوردم.", "آب خوردم."),
        inv("ارزو دارم.", "آرزو دارم."),
        inv("اینده روشن است.", "آینده روشن است."),
        ask("اره من میام."),
        inv("بزار ببینم.", "بذار ببینم."),
        inv("میزارم و نزاشتم.", z("می‹ذارم و نذاشتم."), 2),
        inv("من میخام برم.", z("من می‹خوام برم.")),
        inv("نمیخاد بیای.", z("نمی‹خواد بیای.")),
        inv("خاهش میکنم، خابیدم.", "خواهش میکنم، خوابیدم.", 2),
        ask("وای چ خوب بود."),
        ask("فقط بش بگو."),
        ask("یبار دیدمش."),
        ask("خیلیییی خوب بود."),
        ask("سلاااام دوستان"),
        ask("پائین رفت."),
        ask("بنا ب دلیل کار رفتم.") // the book's compound at once (yellow in a written sentence)
    ]
});

describe("missing «آ» (1.6.0)", function () {
    it("«ادما»، «ارزو»: the list; «ارزان»، «استان‌ها»: not", () => {
        assert.strictEqual(missingMadd("ادما"), "آدما");
        assert.strictEqual(missingMadd("ارزو"), "آرزو");
        assert.strictEqual(missingMadd("اینده"), "آینده");
        for (const w of ["ارزان", "استانها", "اینکه", "ان", "اب"]) assert.strictEqual(missingMadd(w), null, w);
    });
});

new TextLintTester().run("misspellings: homophone letters (1.6.0)", misspellings, {
    valid: ["حاضر و ضبط و زمینه", "نسبت و متفاوت", "نماز را می‌گزارم", "گذاشتم و گذشته"],
    invalid: [
        inv("من حاظرم.", "من حاضرم."),
        inv("ظبط کردم در این ضمینه", "ضبط کردم در این زمینه", 2),
        inv("نصبت به او متفاوط است.", "نسبت به او متفاوت است.", 2),
        inv("گزاشتم و گزشته", "گذاشتم و گذشته", 2),
        inv("گذارش داد.", "گزارش داد."),
        inv("مطمعن نیستم.", "مطمئن نیستم.")
    ]
});

new TextLintTester().run("word-spacing (1.6.0)", wordSpacing, {
    valid: ["وقتی آمد و وزیر رفت ولی وبا آمد", "واسه من", "حمل‌ونقل", "راهم بسته بود.", "توهم است.", "درمورد این کتاب", "ازطریق اینترنت",
        "یکسان و یکدیگر", "دوستون", "بلکه آنکه اینکه"],
    invalid: [
        inv("ومن رفتم وبعد گفتم.", "و من رفتم و بعد گفتم.", 2),
        inv("وحتی وفقط", "و حتی و فقط", 2),
        inv("ماهم رفتیم و شماهم.", "ما هم رفتیم و شما هم.", 2),
        inv("اگرهم بیاید", "اگر هم بیاید"),
        ask("دریک روز ازمن پرسید.", 2),
        ask("باتوجه به این", 1),
        ask("یکماه و دوسال و چندروز", 3),
        inv("منکه نمی‌دانم.", "من که نمی‌دانم.")
    ]
});

new TextLintTester().run("lexicon (1.6.0)", lexicon, {
    valid: ["درس خوندم و راس میگی دیگه."], // «راس» in a spoken sentence is «راست»
    invalid: [
        inv("واقعن خوب بود و اصلن نمی‌دانم.", "واقعاً خوب بود و اصلاً نمی‌دانم.", 2),
        inv("مثلن یا حتمن", "مثلاً یا حتماً", 2),
        inv("ایشالا میام.", z("ان‹شاءالله میام.")),
        inv("انشاله درست شود.", z("ان‹شاءالله درست شود.")),
        inv("مسولین مطمن نیستند.", "مسئولین مطمئن نیستند.", 2),
        inv("تاتر و پروتین", "تئاتر و پروتئین", 2),
        inv("زمانیکه رفتم", "زمانی که رفتم"),
        inv("کسانیکه آمدند", "کسانی که آمدند"),
        inv("در حالیکه خوب بود", z("درحالی‹که خوب بود")),
        inv("رأس و راس ساعت هشت رسید.", "رأس و رأس ساعت هشت رسید.")
    ]
});

new TextLintTester().run("copula-attachment: spoken pronouns apart (1.6.0)", copulaAttachment, {
    valid: ["همه‌شون اومدن", "بان کی مون دبیرکل سازمان ملل است."], // a written sentence: a name
    invalid: [ask("همه شون اومده بودن"), ask("دست تون درد نکنه، نمیدونم چی بگم"), ask("خونه شون کجاست؟ نمیدونم.")]
});

new TextLintTester().run("punctuation (1.6.0)", punctuation, {
    valid: ["خوبه :)))) بد شد :( خیلی (: باشه ;) دیدم :-) آره", "این (مثال): درست است.", "بخواب! ۸) خیلی سال بعد"],
    invalid: [inv("چرا!؟", "چرا؟!"), inv("واقعاً؟!!", "واقعاً؟!")]
});

new TextLintTester().run("mi-prefix: spoken forms with a space (1.6.0)", miPrefix, {
    valid: ["جام می کهنه"],
    invalid: [inv("هر کاری می کنه", z("هر کاری می‹کنه")), inv("نمی شه کاری کرد", z("نمی‹شه کاری کرد")), inv("می تونن بیان", z("می‹تونن بیان"))]
});

new TextLintTester().run("normalize-characters: Persian on an Arabic keyboard (1.6.0)", normalizeCharacters, {
    valid: [],
    invalid: [
        // three «ال» words, but «است، را، این» and «گ»: Persian, fixed like any other
        inv("الحكومة الايرانية و المجلس الاعلي در اين باره گفته است كه اين كار را انجام مي دهد.", "الحکومة الایرانیة و المجلس الاعلی در این باره گفته است که این کار را انجام می دهد.", 9),
        // an Arabic phrase: a question
        ask("العلم خير من المال الكثير", 3)
    ]
});

new TextLintTester().run("dictionary and joined-words: «خونده»، «نیکخواه» (1.6.0)", dictionary, { valid: ["درس خونده بود.", "آقای نیکخواه آمد."], invalid: [] });
new TextLintTester().run("joined-words: «نیکخواه» (1.6.0)", joinedWords, { valid: ["آقای نیکخواه آمد."], invalid: [] });

describe("spelling on informal text (1.6.0)", function () {
    it("spoken inflections of known words are never «not in the dictionary»", () => {
        for (const w of ["بازیکنا", "گوشیمو", "سایتشون", "رکوردشو", "خیلیا", "هوادارا", "نندازی", "بفهمن", "نمیذاشت", "چشاتون", "اصن", "یوزر"]) {
            assert.ok(spokenInflection(w) || spellingCheck(w, true) === null, w);
            assert.strictEqual(spellingCheck(w, true), null, w);
        }
    });
    it("a candidate keeps the first letter and the shape of a verb", () => {
        const r = spellingCheck("نمیباشت");
        const s = r && "suggestions" in r ? r.suggestions : [];
        assert.ok(s.every((c) => c.startsWith("نمی") && c.endsWith("ت")), String(s));
        const h = spellingCheck("حروم");
        assert.ok(!(h && "suggestions" in h) || h.suggestions.every((c) => c.startsWith("ح")));
    });
    it("homophone and missing-letter candidates first: «مطمن» → «مطمئن» before «مزمن»", () => {
        const r = spellingCheck("مطمنی");
        const s = r && "suggestions" in r ? r.suggestions : [];
        assert.ok(!s.length || !s[0].startsWith("مزمن"), String(s));
    });
});
