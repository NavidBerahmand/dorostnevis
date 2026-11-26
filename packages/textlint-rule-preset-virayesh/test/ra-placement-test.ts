import TextLintTester from "textlint-tester";
import rule from "../src/rules/ra-placement";

const one = (text: string) => ({ text, output: text, errors: [{}] });
new TextLintTester().run("ra-placement", rule, {
    valid: [
        "کتابی را که به من داده بودی خواندم.",
        "مصریان قدیم شوید را مثل سبزی می‌خوردند.",
        "زلزلهٔ بسیار شدید را پیش‌بینی کردند.",
        "دست و پای شوی را بست.",
        "هست و نیست را از دست داد.",
        "خرید را انجام داد."
    ],
    invalid: [
        one("کتابی که به من داده بودی را خواندم."),
        one("کسی که اموال مسروقه می‌خرید را دستگیر کردند."),
        one("آنچه لازم است را بنویس."),
        one("گروهی که به جزیره آمده‌اند را نشان می‌دهد."),
        one("چیزهایی که در آن سقوط می کند را ذخیره می‌کنند.")
    ]
});
