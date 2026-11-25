import TextLintTester from "textlint-tester";
import rule from "../src/rules/zwnj-cleanup";
import { inv, z } from "./helpers";

new TextLintTester().run("zwnj-cleanup", rule, {
    valid: [z("می‹روم، کتاب‹ها، بی‹تردید"), "پرفروش، مادربزرگ، هوادار"],
    invalid: [
        inv(z("یک‹‹به‹‹یک"), z("یک‹به‹یک"), 2),
        inv(z("چهرۀ‹ مکتوب"), "چهرۀ مکتوب"),
        inv(z("جدا‹نویسی"), "جدانویسی"),
        inv(z("پر‹فروش"), "پرفروش")
    ]
});
