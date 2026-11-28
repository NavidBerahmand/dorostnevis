import TextLintTester from "textlint-tester";
import assert from "assert";
import spelling from "../src/rules/spelling";
import spacedCompounds from "../src/rules/spaced-compounds";
import { spellingCheck, editKind, closedPair } from "../src/util/speller";
import { z } from "./helpers";

/*
 * 1.6.4 (the owner: «اون دو تا رو هم درست کن»): the spelling checker and the spaced compounds, the two
 * sources of wrong yellow cards 1.6.3 left, narrowed on cards judged by hand on blog and Wikipedia text.
 */
const tester = new TextLintTester();
const one = (text: string) => ({ text, output: text, errors: [{}] });

describe("1.6.4: what kind of edit a suggestion is", function () {
    it("a letter left out, a homophone, a neighbouring key, two letters swapped, a letter typed twice", () => {
        assert.strictEqual(editKind("مشمل", "مشتمل"), "missing");
        assert.strictEqual(editKind("سراق", "سراغ"), "homophone");
        assert.strictEqual(editKind("مٶسسه", "مؤسسه"), "homophone");
        assert.strictEqual(editKind("دقبق", "دقیق"), "near");
        assert.strictEqual(editKind("تعیبر", "تعبیر"), "swap");
        assert.strictEqual(editKind("اصللا", "اصلا"), "double");
    });
    it("a letter too many and any other letter changed are names or wrong guesses: not offered", () => {
        assert.strictEqual(editKind("ماهلر", "ماهر"), "extra");
        assert.strictEqual(editKind("سنح", "سطح"), "other");
        for (const w of ["ماهلر", "طاقک", "دانلودز", "سنح", "دخیا"]) {
            const r = spellingCheck(w);
            assert.ok(!r || !("suggestions" in r) || !r.suggestions.some((c) => ["ماهر", "طاق", "دانلود", "سطح", "دریا"].includes(c)), w + JSON.stringify(r));
        }
    });
    it("the likelier edit first, not the more frequent word", () => {
        assert.deepStrictEqual(spellingCheck("مشمل")?.["suggestions" as never]?.[0], "مشتمل");
        assert.deepStrictEqual(spellingCheck("تفاون")?.["suggestions" as never]?.[0], "تفاوت");
        assert.deepStrictEqual(spellingCheck("رئس")?.["suggestions" as never]?.[0], "رئیس");
        assert.deepStrictEqual(spellingCheck("سراق")?.["suggestions" as never]?.[0], "سراغ");
    });
    it("a tanvin typed as «آ» or «أ»: the word with «اً»", () => {
        assert.deepStrictEqual(spellingCheck("واقعآ"), { suggestions: ["واقعاً"] });
        assert.deepStrictEqual(spellingCheck("قبلأ"), { suggestions: ["قبلاً"] });
        assert.deepStrictEqual(spellingCheck("حدودآ", true), { suggestions: ["حدوداً"] });
    });
    it("«و» run into a frequent four-letter word: «وقصه» → «و قصه»", () => {
        assert.deepStrictEqual(spellingCheck("وقصه"), { suggestions: ["و قصه"] });
    });
    it("two frequent words run together: with a closed-class word or a verb, not two nouns or a name", () => {
        assert.ok(closedPair("تنها", "محصول") && closedPair("فکر", "کنم") && closedPair("باور", "دارند") && closedPair("امید", "که"));
        assert.ok(!closedPair("چاه", "دراز") && !closedPair("اسکندر", "شهر") && !closedPair("ها", "کارت") && !closedPair("خزر", "یا") && !closedPair("حسین", "در"));
        assert.deepStrictEqual(spellingCheck("تنهامحصول"), { suggestions: ["تنها محصول"] });
        const r = spellingCheck("چاهدراز");
        assert.ok(!r || !("suggestions" in r), JSON.stringify(r));
    });
});

tester.run("spelling (1.6.4)", spelling, {
    valid: [
        // a name the lexicon has: «توماس» is not «تو ماس»
        "از جمله توماس کرنمر، اسقف اعظم کانتربری، آمد.",
        // a word the writer joined with a ZWNJ: the book's compound prepositions
        z("با یکشنبۀ نخل (به‹نشان ورود عیسی) آغاز می‌شود."),
        // a name beside a name, after a title or a place word, before its Latin spelling or an Arabic «ال…» word
        "پل شرودر و کارل کیبرگ را ملاقات کرد.",
        "در این دوران با موشا پیژاده آشنا شد.",
        "دو ستارۀ کم‌نورتر را «نیاطی القلب» می‌خواندند.",
        "گرفتال (graftal) یکی از اشکال هندسی است.",
        "بند پیتاب دریاچه‌ای طبیعی است.",
        "عبارت‌اند از: سپیار، کیش، اکشک، لارک و نیوپور.",
        "پایتخت آن هزاله نام داشت.",
        "در گوری که در استپار، استان بورگس، کشف شد.",
        "الگ توسط ژنرال خزر پسخ شکست خورد.",
        "حادثه‌ای برای کارل وندلینگر در موناکو رخ داد.",
        "فریدون حکومت ضحاک را برانداخت و اثرط، پدر گرشاسپ، درگذشت.",
        // a written word of three letters: a name or a term («مذب» is on the closed list of 1.6.5: see v165-test)
        "فیلسوف و بنیان‌گذار پسخ رواقی بود.",
        // words of many blog and forum sites (spoken forms, loanwords, names), of Wikipedia articles and titles
        { text: "خواهرم و خونوادش در مسافرتی بودند.", options: {} },
        "شاید بخواهید با یوزرها صحبت کنید.",
        "این روستا در دهستان شورتپه است.",
        // no card without a replacement
        "پروفسور دایان پکنولد اشاره کرده است.",
        // «و» before a rare word beside a name: the name «Vahide»
        "قراره زهرا (واحیده گوردوم) هم برگرده."
    ],
    invalid: [
        one("کندانسور مشمل بر پنج قطعه است."),
        one("قدرت رقابت با محضول شرکت بورلند را نداشت."),
        one("نماز با این حال واقعآ نماد وقار است."),
        one("اجازه نمی‌ده براش کتاب وقصه بخونم."),
        one("چاروق اکنون درزنجان ساخته می‌شود."),
        one("نخ ابریشم تنهامحصول صادرات بود.")
    ]
});

tester.run("spaced-compounds (1.6.4)", spacedCompounds, {
    valid: [
        // a number and what it counts: pairs running text writes apart nearly always (dropped from the list)
        "یک گونه از پرندگان است.",
        "پنج روز بستری بود.",
        "پایتون یک زبان اسکریپتی است.",
        // a number counting on, the «ی» of «a», a spoken «ه» after a time word
        "او سی و یک ساله بود.",
        "شنونده یک صدای کریستالی خواهید بود.",
        // the spoken «تو» and «رو»; «یه کم»; a preposition's object; the reflexive; a call; a question word
        { text: "کاری به کار من نداشته باش تو کار خودتو بکن.", options: {} },
        "درش رو باز بذار تا آب اضافه‌اش تبخیر بشه.",
        "یه کم آب وارد خونت می‌شه.",
        "اما من بعد از عصب‌کشی دندانم رفتم.",
        "یه دل پر از گلایه دارم.",
        "ترفند این است که سر خود را روی توپ نگه دارد.",
        "ای جان عزیزم!",
        "صدایی مثل چی ازش شنیدم.",
        // the last word with its suffix a word of another kind; a time word in the plural; «تمام … ها»
        "گالری‌های مجموعه دارای طرح‌هایی است.",
        "لایۀ ابری سفید روی بدن بود.",
        "چرا گاهی من به جای ما آمده؟",
        "او میان سال‌های ۱۹۹۶ تا ۱۹۹۸ نخست‌وزیر بود.",
        "تمام کارهای او در سالن پاریس بود.",
        // the last word makes a word with the next: «بین‌المللی»، «ترمزدستی»
        "به پرفروش‌ترین کتاب بین المللی تبدیل شد.",
        z("به پرفروش‌ترین کتاب بین‹المللی تبدیل شد."),
        "چراغ ترمز دستی روشن می‌شود.",
        // a place word after a preposition
        "این آمونیاک در زیر سطح قمر پنهان است.",
        // an imperative before the end of the sentence
        "برو با اسباب‌بازی‌هات بازی کن… دیگه نشین.",
        // the last part goes with «مانند»
        "بیشتر کاندوم‌ها یک سر پستانک مانند دارند.",
        // «یکی»، and «یک» before what it counts
        "این مکان یکی از زیارتگاه‌هاست.",
        "جهان را بر پایه یک اصل می‌دانند.",
        // 1.6.7: the farhang lists both «یک بار» (یک دفعه) and «یک‌بار» (ناگهان): no card (yellow before)
        "حتی یک بار هم به روی خودش نیاورد."
    ],
    invalid: [
        // the book's own compounds and the red ones stay
        { text: "دانش آموزان آمدند.", output: z("دانش‹آموزان آمدند."), errors: [{}] },
        { text: "او جامعه شناس است.", output: z("او جامعه‹شناس است."), errors: [{}] },
        { text: "قبایل سرخ پوست مانند هاپی و زونی.", output: z("قبایل سرخ‹پوست مانند هاپی و زونی."), errors: [{}] },
        one("تخم مرغ را بزنید."),
        one("طول آن حداقل دو برابر حالت عادی است."),
        one("یه سفر چند روزه به رشت داشتیم."),
        one("از هیچ چیز خبر ندارم.")
    ]
});
