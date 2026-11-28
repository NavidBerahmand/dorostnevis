import TextLintTester from "textlint-tester";
import ezafe from "../src/rules/ezafe-he";
import dictionary from "../src/rules/dictionary";
import { z } from "./helpers";

/*
 * 1.6.3 (the owner: «کسرۀ اضافه رو درست کن»): the ezafe checks narrowed on cards judged by hand on blog and
 * Wikipedia text, and «فرمانده‌ی سپاه» no longer turned into «فرماندهی».
 */
const tester = new TextLintTester();

tester.run("ezafe-he (1.6.3)", ezafe, {
    valid: [
        // the ezafe written «ی» on a spoken verb + «یه»، a spoken «برای»، a single letter
        { text: "اگر قسطی بشه ی کمک بزرگی به ما می‌شه.", options: { formal: false } },
        { text: "دقیقاً واسه ی چهارشنبه بود.", options: { formal: false } },
        "سراغ ن و ه ی رفت.",
        // a word of the colloquial bank is spelled as said: no card
        { text: "کلید خونه ی عموتو بیار.", options: { formal: false } },
        // before a pronoun, where the words read otherwise
        "با این همه وی به شرکت رفت.",
        "در نتیجه او در مقابل روانکاوان ایستاد.",
        "پس از این حمله او یک چشم خود را از دست داد.",
        "بله من بودم.",
        "اعوذ بالله من الشیطان الرجیم",
        // the model: a counter after a number, a verb next, a name, one word written apart
        "کل بنا از ۲۴ قطعه سنگ ساخته شده است.",
        { text: "تا هاله جون شیرینی رو نیاورد ول نکرد.", options: { formal: false } },
        { text: "ایده ال خود شما چیه؟", options: { formal: false } },
        // in a spoken sentence only «همه، درباره، ادامه، زمینه، نسخه» are suggested
        { text: "رفتم به راننده گفتم آقا نگه دار.", options: { formal: false } }
    ],
    invalid: [
        // 1.6.10: «شیفتۀ خود کردن» does take the ezafe; the retrained model suggests it (88%), no automatic fix
        { text: "او را شیفته خود کرده است.", output: "او را شیفته خود کرده است.", errors: [{}] },
        { text: "کلید خانه ی دوستم را گم کردم.", output: "کلید خانۀ دوستم را گم کردم.", errors: [{}] },
        { text: "وقتی وبلاگ جدیدمو بسازم درباره این قضیه می‌خوام بنویسم.", output: "وقتی وبلاگ جدیدمو بسازم دربارۀ این قضیه می‌خوام بنویسم.", errors: [{}], options: { formal: false } }
    ]
});

tester.run("dictionary (1.6.3)", dictionary, {
    valid: [],
    invalid: [
        // before a word: «فرمانده» + an ezafe written «ی» or «فرماندهی»: a choice, no automatic fix
        { text: z("فرمانده‹ی سپاه آمد."), output: z("فرمانده‹ی سپاه آمد."), errors: [{ message: "اگر «فرمانده» در حالت اضافه است، کسره می‌گیرد: «فرماندهِ»؛ اگر یک کلمه است: «فرماندهی» (دستور خط، «کسرۀ اضافه»، ص ۴۷)" }] },
        // before a mark: the word «فرماندهی» (as before)
        { text: z("مقام فرمانده‹ی."), output: "مقام فرماندهی.", errors: [{}] }
    ]
});
