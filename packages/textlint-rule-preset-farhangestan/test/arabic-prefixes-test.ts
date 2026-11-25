import TextLintTester from "textlint-tester";
import rule from "../src/rules/arabic-prefixes";
import { inv } from "./helpers";

new TextLintTester().run("arabic-prefixes", rule, {
    valid: ["سوءاستفاده، ضدزنگ، غیراصولی", "غیر از این", "بر ضد او قیام کردند", "ضد آن"],
    invalid: [
        inv("سوء استفاده", "سوءاستفاده"),
        inv("کاری غیر قانونی", "کاری غیرقانونی"),
        inv("رنگ ضد زنگ", "رنگ ضدزنگ")
    ]
});
