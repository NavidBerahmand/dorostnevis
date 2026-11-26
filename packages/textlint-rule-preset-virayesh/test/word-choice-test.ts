import TextLintTester from "textlint-tester";
import rule from "../src/rules/word-choice";

const fix = (text: string, output: string) => ({ text, output, errors: [{}] });
new TextLintTester().run("word-choice", rule, {
    valid: ["جنگ جهانی اول", "سده‌های میانه", "مسجد درب امام", "میدان درب شازده", "قطعاً خیر!", "در ضمن"],
    invalid: [
        fix("پس از جنگ دوم جهانی", "پس از جنگ جهانی دوم"),
        fix("در قرون وسطی", "در سده‌های میانه"),
        fix("درب ورودی بسته بود.", "در ورودی بسته بود."),
        fix("درب را بست.", "در را بست."),
        fix("درب‌ها را بستند.", "درها را بستند."),
        fix("ضمناً فردا تعطیل است.", "در ضمن فردا تعطیل است."),
        fix("قطعاً می‌آید.", "به‌طور قطع می‌آید.")
    ]
});
