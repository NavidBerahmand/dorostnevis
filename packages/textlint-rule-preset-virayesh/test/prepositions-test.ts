import TextLintTester from "textlint-tester";
import rule from "../src/rules/prepositions";

const one = (text: string) => ({ text, errors: [{}] });
new TextLintTester().run("prepositions", rule, {
    valid: [
        "جهت باد عوض شد", "در جهت حفظ محیط زیست", "جهت حرکت را دید", "در این جهت پیش رفتیم", "تغییر جهت داد", "از این جهت درست است", "هم‌جهت",
        "این کار توسط او", "توسط"
    ],
    invalid: [
        one("جهت اطلاع شما"), one("این نامه را جهت بررسی فرستادم"), one("جهت رفاه حال مسافران"),
        one("نامه توسط مدیر نوشته شد."), one("این خانه توسط پدرم ساخته شده است")
    ]
});
