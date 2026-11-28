import TextLintTester from "textlint-tester";
import assert from "assert";
import spelling from "../src/rules/spelling";
import spacedCompounds from "../src/rules/spaced-compounds";
import punctuation from "../src/rules/punctuation";
import { spellingCheck } from "../src/util/speller";
import { z } from "./helpers";

/*
 * 1.6.5 (the owner: «انجام بده»): what 1.6.4 left. Spelling on held-out Wikipedia was right 86.4% of the time,
 * most wrong cards names; the spaced compounds' wrong yellow cards were mostly a noun with its ezafe; and 1.6.4
 * had dropped some real typos with the wrong guesses. Also: straight quotes typed against the wrong word.
 */
const tester = new TextLintTester();
const one = (text: string) => ({ text, output: text, errors: [{}] });
const first = (w: string, spoken = false) => {
    const r = spellingCheck(w, spoken);
    return r && "suggestions" in r ? r.suggestions[0] : null;
};

describe("1.6.5: the spelling checker", function () {
    it("a written sentence: a neighbouring key or a look-alike only for a word of ≈ 2,000 occurrences", () => {
        // «پنیر»، «یانگ»، «کاترین» are under it: «پخیر»، «یانج»، «کاثرین» were names
        for (const w of ["پخیر", "یانج", "کاثرین", "پوترن", "قباب"]) assert.strictEqual(first(w), null, w);
        // a frequent word still («محمع» → «مجمع»، «نطارت» → «نظارت»); in a spoken sentence as before («پخیر» → «پنیر»)
        assert.strictEqual(first("محمع"), "مجمع");
        assert.strictEqual(first("نطارت"), "نظارت");
        assert.strictEqual(first("پخیر", true), "پنیر");
    });
    it("a vowel letter typed twice is a foreign «ee/oo» below ≈ 1,000 occurrences", () => {
        assert.strictEqual(first("انجییر"), null);
        assert.strictEqual(first("سییا"), null);
        assert.strictEqual(first("تعبییر"), "تعبیر");
    });
    it("a letter too many beside the key next to it, in a spoken sentence, in a word of six letters and more", () => {
        assert.strictEqual(first("مستعطیل", true), "مستطیل");
        assert.strictEqual(first("استدالال", true), "استدلال");
        // not in a written sentence («آمهاری» is Amharic), not in a shorter word, not two words of their own
        for (const w of ["آمهاری", "اسکاپن", "مستعطیل"]) assert.strictEqual(first(w), null, w);
        for (const w of ["ماهلر", "خامک", "ماهیران"]) assert.strictEqual(first(w, true), null, w);
    });
    it("a first letter a look-alike, for a frequent word, when nothing keeps the first letter", () => {
        assert.strictEqual(first("ذانشگاه"), "دانشگاه");
        assert.strictEqual(first("حیابان"), "خیابان");
        // not a neighbouring key of another shape («پخیر» is no «اخیر»، «اشکر» no «لشکر»)
        assert.notStrictEqual(first("پخیر"), "اخیر");
        assert.notStrictEqual(first("اشکر"), "لشکر");
    });
    it("two nouns run together: both frequent, four letters, no compound part", () => {
        assert.strictEqual(first("قراردادکاری"), "قرارداد کاری");
        assert.strictEqual(first("امتیازویژه"), "امتیاز ویژه");
        for (const w of ["وجودنامه", "پردیدگاه", "پولورود", "چاهدراز"]) assert.ok(!first(w)?.includes(" "), w);
    });
    it("two words run together keep the word's own ZWNJs (no loop with the plural «ها»)", () => {
        assert.strictEqual(first("ازماشین\u200cهای"), "از ماشین\u200cهای");
    });
    it("«خود» and a participle are one word", () => {
        assert.ok(!first("خودنامیده")?.includes(" "));
        assert.strictEqual(first("خودداشتند"), "خود داشتند");
    });
});

tester.run("spelling (1.6.5)", spelling, {
    valid: [
        // a word that comes back elsewhere in the text (another paragraph, the title) is a name or a term
        "باباکو\n\nمانند پاپایا، باباکو به دلیل میوه‌های خوراکی پرورش می‌یابد.",
        "گذرداد شبکه\n\nگاهی گذرداد نرمال سنجیده می‌شود.",
        // also with a plural ending: «اسکارن» … «اسکارنهایی»
        "اسکارن\n\nاسکارنهایی که توسط واکنش بین لایه‌ها ایجاد شده‌اند.",
        // strong signs of a name even for a function word run into a word: a first name before it, «روستایی» after it,
        // a hyphen, alone in quotes
        "سرپرستی را نخست علیرضا وحدی بر عهده گرفت.",
        "دردوک، روستایی در دهستان حومه است.",
        "خط راه‌آهن تاجان- مشهد- سرخس ساخته شد.",
        "این بانک تحت عنوان «وخاور» در بورس گشایش یافت.",
        // «و» before a «w/v» sound, or (written) before a word the lexicon only takes apart: a foreign name
        "ووفورد بلافاصله پس از صحبت با او رفت.",
        "او در سال ۱۹۹۰ در ولینگبی، حومۀ استکهلم، زاده شد.",
        // names: the end of an Arabic name, «به نام»، «موسوم به»
        "پس از او ملک رکن الدین کیهن کرت پسر شمس‌الدین محمد نشست.",
        "یک ریاضیدان فرانسوی به نام اولیور رامار ثابت کرد.",
        // «را» only after a word
        "پیش از مدونا، اکثر مگاستارهای موسیقی، راکرهای مرد بودند.",
        // a written word of three letters not on the closed list
        "الگ توسط ژنرال خزر پسخ شکست خورد."
    ],
    invalid: [
        // the closed list of three-letter misspellings
        { text: "فیلسوف و بنیان‌گذار مذب رواقی بود.", output: "فیلسوف و بنیان‌گذار مذب رواقی بود.", errors: [{ message: "«مذب» در واژه‌نامه نیست؛ شاید «مذهب» (غلط‌یاب (واژه‌نامۀ ساخته‌شده از ویکی‌پدیای فارسی؛ در دستور خط نیامده))" }] },
        one("ففط من این را دیدم."),
        one("این تسط او نوشته شد."),
        // recovered: a letter too many (spoken), two nouns run together, a frequent closed word run into a word
        one("بعد بلافاصله مجدادا با دست راست انجامش بدید تا خوب یاد بگیره"),
        one("اگر به ۸ سال رسید قراردادکاری را تمدید کنید."),
        one("منم دو هفته ای پستتوسط مدیر دیدم."),
        // «و» run into a word the lexicon has
        one("از چوب برای ساخت در ورودی، پنجره وضریح استفاده شده است.")
    ]
});

tester.run("spaced-compounds (1.6.5)", spacedCompounds, {
    valid: [
        // the ezafe reading: an adjective with a pronoun, a time word with a pronoun; free phrases out of the list
        "مصطلحات هر فلسفه در زبان اصلی خودش بود.",
        "هرچه می‌خواهد دل تنگت بگو.",
        "او پادشاه بود تا روز مرگش.",
        // a number counting on after «یا»
        "دو یا چند گونه از انواع سه‌گانه را ترکیب می‌کنند.",
        // a name
        "هنگ دومی به فرماندهی آقا جان‌خان فراخوانده شد.",
        // free phrases out of the list
        "فیلم‌ها را با زبان اصلی نمایش می‌دهند.",
        "انگلس در سال ۱۸۹۵، یعنی سال مرگ او، درگذشت."
    ],
    invalid: [
        // the lexicalised number compounds are back (the book, ص ۵۸ بند ۱۰ الف)
        one("او یک کلام گفت نه."),
        one("سفره هفت سین را چیدیم."),
        one("روز سیزده بدر به باغ رفتیم."),
        { text: "دانش آموزان آمدند.", output: z("دانش‹آموزان آمدند."), errors: [{}] },
        // a reflexive after it is no ezafe reading: «کپی‌رایت خودم»، «موردنظر خود»; «فشارقوی» (high voltage) stays
        one("می‌تونم کپی رایت خودم رو بزارم؟"),
        one("کاربر لغات مورد نظر خود را می‌یابد."),
        one("از جریان مستقیم فشار قوی استفاده می‌شود.")
    ]
});

tester.run("punctuation (1.6.5): straight quotes paired by order", punctuation, {
    valid: [
        // a tanvin typed as «"», an escaped quote, an inch mark: not quotes
        'او حتما" می‌آید و معمولا" دیر می‌رسد.',
        'کشاورزی که با \\"نارنجک\\" گردو شکست',
        'صفحه ۵" و ۷" دارد',
        // narration between two quotations, ending in «:»
        'گرما را توضیح دهیم."دانشجو ادامه داد: "و تاریکی؟'
    ],
    invalid: [
        { text: 'مبنی بر اینکه" برو سؤال کن، شاید یادشون رفته" کاشف به عمل آمد.', output: "مبنی بر اینکه «برو سؤال کن، شاید یادشون رفته» کاشف به عمل آمد.", errors: [{}] },
        // a suffix after the closing mark stays attached
        { text: 'صدای "رسا"ی دلواپسان', output: "صدای «رسا»ی دلواپسان", errors: [{}] },
        { text: 'به "نورون"‌ها متصل‌اند', output: "به «نورون»‌ها متصل‌اند", errors: [{}] }
    ]
});
