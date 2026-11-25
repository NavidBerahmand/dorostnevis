import TextLintTester from "textlint-tester";
import rule from "../src/rules/hamza-tanvin";
import { inv, z } from "./helpers";

new TextLintTester().run("hamza-tanvin", rule, {
    valid: [
        "جزئی، سوئی، شیئی، ابتدائاً، استثنائاً، جزئاً، حقیقتاً، نسبتاً، ظاهراً", // pp. 51, 56
        z("دایرة‹المعارف، ثقة‹الاسلام، بقیةالله")
    ],
    invalid: [
        inv("جزءی", "جزئی"),
        inv("جزءاً", "جزئاً"),
        inv("حقیقةً", "حقیقتاً"),
        inv("اصلًا", "اصلاً"),
        { text: "این علاقة", errors: [{}] },
        inv("ابتداءً", "ابتدائاً")
    ]
});
