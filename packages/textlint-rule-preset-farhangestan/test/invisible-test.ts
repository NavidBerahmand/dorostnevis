import TextLintTester from "textlint-tester";
import rule from "../src/rules/invisible";
import { inv } from "./helpers";

const one = (text: string) => ({ text, errors: [{}] });
new TextLintTester().run("invisible", rule, {
    valid: ["سلام دنیا.", "کتاب‌ها", "Hello world"],
    invalid: [
        inv("کتاب خوب است.", "کتاب خوب است."),
        inv("کتاب​ها خوب است.", "کتاب‌ها خوب است."),
        inv("کتاب ​خوب است.", "کتاب خوب است."),
        inv("سلام﻿ دنیا.", "سلام دنیا."),
        // plain text (in Markdown the parser already drops a paragraph's leading spaces)
        { ...inv("   سلام دنیا.", "سلام دنیا."), ext: ".txt" },
        inv("سلام دنیا.  ", "سلام دنیا."),
        one("کتاب خوب است."),
        one("او می‍رود.")
    ]
});
