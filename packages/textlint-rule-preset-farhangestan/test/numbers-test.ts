import TextLintTester from "textlint-tester";
import rule from "../src/rules/numbers";
import { inv, z } from "./helpers";

new TextLintTester().run("numbers", rule, {
    valid: [
        z("یک‹صد، چهارصد، شش‹صد، دوهزار، یازده‹هزار، یک‹میلیون، صدمیلیارد، نهصد، سیصد"), // p. 65
        "بیست و یک، نود و پنج، هزار و دویست و شصت و سه",
        z("یک‹چهارم، دوپنجم، پنج‹گانه، سی‹ام"),
        "۲ هزار نفر",
        "دوگانه، چهارگانه"                     // after a non-joining letter: no ZWNJ
    ],
    invalid: [
        inv("دو هزار", "دوهزار"),
        inv("یک میلیون", z("یک‹میلیون")),
        inv("نه صد", "نهصد"),
        inv("یک چهارم", z("یک‹چهارم")),
        inv("پنجگانه", z("پنج‹گانه")),
        inv("ده گانه", z("ده‹گانه")),
        inv("سی امین", z("سی‹امین")),
        inv(z("بیست‹و‹یک"), "بیست و یک"),
        inv("بیستویک", "بیست و یک"),
        inv("۴۷ سالگی", "۴۷سالگی")
    ]
});
