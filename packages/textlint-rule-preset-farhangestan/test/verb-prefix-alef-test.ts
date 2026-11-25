import TextLintTester from "textlint-tester";
import rule from "../src/rules/verb-prefix-alef";
import { inv } from "./helpers";

new TextLintTester().run("verb-prefix-alef", rule, {
    valid: [
        "اقتصاد بازاری",
        "بینجامد، بینداز، بینگیخت، میفکن، نیفتاد، بیاموز، میازار، نیافرید", // p. 38
        "بایست، نایستد",               // ایستادن keeps its alef
        "نیافت، بیابد، نامه، بالا، باشد، ماند"
    ],
    invalid: [
        inv("سنگ را بانداز", "سنگ را بینداز"),
        inv("بیانداز", "بینداز"),
        inv("نافتاد", "نیفتاد"),
        inv("بآموز", "بیاموز")
    ]
});
