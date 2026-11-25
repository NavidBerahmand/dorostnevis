import TextLintTester from "textlint-tester";
import rule from "../src/rules/calques";

const one = (text: string) => ({ text, errors: [{}] });
new TextLintTester().run("calques", rule, {
    valid: ["دربارهٔ این موضوع", "در رابطهٔ ما", "چالش بزرگی بود", "راستای خیابان"],
    invalid: [
        { text: "در رابطه با این موضوع", output: "دربارۀ این موضوع", errors: [{}] },
        { text: "در رابطه با این موضوع", output: "دربارهٔ این موضوع", errors: [{}], options: { ezafe: "he-hamza" } },
        one("او قدرت را به چالش کشید"), one("در راستای اهداف")
    ]
});
