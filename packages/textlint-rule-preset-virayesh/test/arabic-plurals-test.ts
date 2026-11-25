import TextLintTester from "textlint-tester";
import rule from "../src/rules/arabic-plurals";
import { inv, z } from "./helpers";

new TextLintTester().run("arabic-plurals", rule, {
    valid: ["والدین و طرفین", "استادان و درویشان", "مسلمین", "کارخانجات و دهات", z("گزارش‹ها")],
    invalid: [
        inv("اساتید دانشگاه", "استادان دانشگاه"),
        inv("گزارشات رسید", z("گزارش‹ها رسید")),
        inv("مسئولین شهر", "مسئولان شهر"),
        inv("دراویش و فرامین", z("درویشان و فرمان‹ها"), 2),
        inv("داوطلبین آمدند", "داوطلبان آمدند")
    ]
});
