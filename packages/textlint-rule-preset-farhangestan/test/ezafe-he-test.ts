import TextLintTester from "textlint-tester";
import rule from "../src/rules/ezafe-he";
import { inv, z } from "./helpers";

new TextLintTester().run("ezafe-he", rule, {
    valid: [
        "او خسته بود و رفت.", // no ezafe: the model stays quiet
        "در اداره کار می‌کند.",
        "این‌گونه واژه‌ها را نوشت.",
        { text: "خانه قبلی", options: { model: false } },
        // the one form of the ezafe since 1.4.0: «هٔ» (the book's «ۀ» with "he-yeh")
        "برنامهٔ روزانه، بندهٔ خدا، خانهٔ او، رانندهٔ ماهر",
        { text: "برنامۀ روزانه، بندۀ خدا، خانۀ او، رانندۀ ماهر", options: { style: "he-yeh" } }, // p. 47
        "راه یکی است.",
        "خانهٔ او",
        // «کتابه» as the definite marker in dialogue: not an ezafe
        { text: "این کتابه خوب بود.", options: { formal: false } },
        "این کتابه که خریدم.",
        "خونه من", // spoken «خانه»: another rule's job
        // a past participle is not «نزد» + ezafe; and before other words the check is off (1.4.0)
        "قسمت آخر را خوب نزده ولی دو بخش اول را خوب زده.",
        "کار را کرده و رفت",
        "دوسته علی آمد.",
        "از نصرالله میرزا با سپاهی ۱۵۰۰۰ نفره او را شکست داد",
        "خسته من", // ends in a silent ه: a real word
        "فرماندهٔ سپاه و گرهٔ کور", // pronounced «ه»: the final-he rule's
        "فرماندۀ سپاه"
    ],
    invalid: [
        inv("خانه ی من", "خانهٔ من"),
        inv(z("نامه‹ی او"), "نامهٔ او"),
        { text: "خانهٔ او", output: "خانۀ او", options: { style: "he-yeh" }, errors: [{}] },
        // «کتابه من»: a suggestion only (since 1.4.0)
        { text: "کتابه من را بده.", output: "کتابه من را بده.", errors: [{}] },
        inv("خانه من بزرگ است.", "خانهٔ من بزرگ است."),
        inv("این نامه او است.", "این نامهٔ او است."),
        // a verb after the pronoun: the sentence may split there («در خانه، من نبودم»)
        { text: "در خانه من نبودم.", output: "در خانه من نبودم.", errors: [{}] },
        { text: "دوسته شما آمد.", output: "دوسته شما آمد.", errors: [{}] },
        // «ۀ» → «هٔ»: the page makes it silently, with the typing fixes
        {
            text: "خانۀ او و برنامۀ روزانه",
            output: "خانهٔ او و برنامهٔ روزانه",
            errors: [{ message: "شکل یکدستِ نشانهٔ اضافه «هٔ» است (دستور خط، «کسرۀ اضافه»، ص ۴۷)" }, {}]
        },
        // the model: a missing ezafe before another word
        inv("نتیجه نهایی را نشان داد.", "نتیجهٔ نهایی را نشان داد."),
        // less sure (0.55–0.9): a suggestion, no automatic fix
        { text: "این نامه رسمی است.", output: "این نامه رسمی است.", errors: [{}] }, // «این نامهٔ رسمی» or «این نامه رسمی است»
        inv("این روستا در دهستان قلعه شاهین قرار دارد.", "این روستا در دهستان قلعهٔ شاهین قرار دارد."),
        inv("خانه قبلی را فروخت.", "خانهٔ قبلی را فروخت."),
        inv("همه دفترها را جمع کرد.", "همهٔ دفترها را جمع کرد."),
        // a compound written with a space: the compound is suggested, no ezafe
        { text: "از کارهای جامعه شناسانی همچون او", output: "از کارهای جامعه شناسانی همچون او", errors: [{}] },
        inv("به هر بهانهء ممکن", "به هر بهانهٔ ممکن"),
        inv("به هر بهانه ء ممکن", "به هر بهانهٔ ممکن"),
        inv(z("خانه‹\u0654 پدری"), "خانهٔ پدری")
    ]
});
