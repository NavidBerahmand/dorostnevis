import TextLintTester from "textlint-tester";
import rule from "../src/rules/redundancy";
import { inv } from "./helpers";

new TextLintTester().run("redundancy", rule, {
    valid: ["بازگشت او", "تکرار کرد", "سایر کشورها و دیگر نهادها", "پیشرفت کرد", "روی میز", "بر روی میز", "دیگر بازگشت"],
    invalid: [
        inv("بازگشت مجدد او", "بازگشت او"),
        inv("دوباره تکرار کرد", "تکرار کرد"),
        inv("مجدداً بازگشتند", "بازگشتند"),
        inv("سایر کشورهای دیگر", "سایر کشورهای"),
        inv("سایر کشورها دیگر", "سایر کشورها"),
        inv("پیشرفت رو به جلو", "پیشرفت")
    ]
});
