import TextLintTester from "textlint-tester";
import rule from "../src/rules/spaced-compounds";
import { inv, z } from "./helpers";

new TextLintTester().run("spaced-compounds", rule, {
    valid: [z("رئیس‹جمهور"), z("جمع‹آوری"), "رئیس دفتر", "جمع و آوری"],
    invalid: [
        inv("رئیس جمهور آمد", z("رئیس‹جمهور آمد")),
        inv("رئیس جمهوری", z("رئیس‹جمهوری")),
        // the 2nd edition of دستور خط writes it joined, the farhang with a ZWNJ: the book wins
        {
            text: "بخش نامه",
            output: "بخشنامه",
            errors: [{ message: "این ترکیب یک کلمه است و پیوسته نوشته می‌شود: «بخشنامه» (دستور خط (ویراست جدید)؛ فرهنگ املایی، ص ۹۹، «بخش‌نامه» دارد)" }]
        },
        inv(z("جمع آوری‹ها"), z("جمع‹آوری‹ها")),
        inv("سازمان بین المللی", z("سازمان بین‹المللی"))
    ]
});
