import TextLintTester from "textlint-tester";
import rule from "../src/rules/calques";

const one = (text: string) => ({ text, errors: [{}] });
new TextLintTester().run("calques", rule, {
    valid: ["دربارهٔ این موضوع", "در رابطهٔ ما", "چالش بزرگی بود", "راستای خیابان", "تیراندازی کردند", "آتش گرفت"],
    invalid: [
        { text: "در رابطه با این موضوع", output: "دربارهٔ این موضوع", errors: [{}] },
        { text: "در رابطه با این موضوع", output: "دربارۀ این موضوع", errors: [{}], options: { ezafe: "he-yeh" } },
        one("او قدرت را به چالش کشید"), one("در راستای اهداف"),
        { text: "سربازان به روی مردم آتش گشودند.", output: "سربازان به روی مردم تیراندازی کردند.", errors: [{}] },
        { text: "پیش از آتش گشودن", output: "پیش از تیراندازی کردن", errors: [{}] },
        { text: "دستور داد آتش بگشایند", output: "دستور داد تیراندازی کنند", errors: [{}] }
    ]
});
