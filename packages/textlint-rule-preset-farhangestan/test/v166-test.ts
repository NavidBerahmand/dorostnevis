import TextLintTester from "textlint-tester";
import miPrefix from "../src/rules/mi-prefix";
import punctuation from "../src/rules/punctuation";
import { inv, z } from "./helpers";

/*
 * 1.6.6: Latin digits are a recommendation (blue, the book has no rule on digits), never fixed by themselves;
 * and «می می‌» is never «می‌می‌»: «می میرم» ← «می‌میرم», not «می‌می‌رم» (the end-to-end benchmark found it).
 */
const tester = new TextLintTester();
const one = (text: string, count = 1) => ({ text, output: text, errors: Array.from({ length: count }, () => ({})) });

tester.run("1.6.6: Latin digits, reported without a fix", punctuation, {
    valid: ["نسخه 4.2.0 منتشر شد.", "آدرس 192.168.1.1 است.", "ساعت 12:30 رسیدم.", "Windows 10 نصب شد.", "سال ۱۴۰۲ بود."],
    invalid: [one("سال 1402 بود."), one("نمره‌اش 4.5 شد."), one("قیمت 1,000 بود.")]
});

tester.run("1.6.6: a verb that starts with «می» after a lone «می»", miPrefix, {
    valid: [z("من می‹میرم."), z("او را می‹میراند."), z("نمی‹میرد"), "می می", "او می میل دارد"],
    invalid: [
        inv("من می میرم.", z("من می‹میرم.")),
        inv("او هم می میرد.", z("او هم می‹میرد.")),
        inv("او را می میراند.", z("او را می‹میراند.")),
        inv("او نمی میرد.", z("او نمی‹میرد.")),
        inv("من میمیرم.", z("من می‹میرم.")),
        // a «می» typed twice: the second is fixed, the lone one left as it is (never «می‌می‌باشد»)
        inv("بالا می میباشد", z("بالا می می‹باشد")),
        inv("بالا می می باشد", z("بالا می می‹باشد"))
    ]
});
