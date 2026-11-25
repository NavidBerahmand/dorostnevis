import TextLintTester from "textlint-tester";
import rule from "../src/rules/compound-verbs";
import { inv, z } from "./helpers";

new TextLintTester().run("compound-verbs", rule, {
    valid: [
        z("دربرمی‹گرفت"),
        z("فیلم‹برداری"),
        "اختصاص دادن، سخن گفتن، صحبت کرد", // p. 68
        z("تصمیم‹گیرنده، فیلم‹برداری، ساخته‹شده، تمام‹شده"), // tabsare 1: derived forms keep ZWNJ
        "عملکرد، رویکرد",
        z("می‹شد، نمی‹شود"),
        z("برون‹رفت، بیرون‹شد"),
        z("جهان‹گرد، جهان‹نما"),
        z("مى‹شود")                              // Arabic «ى»: still the verb «می‌شود»
    ],
    invalid: [
        inv(z("با او صحبت‹کرد."), "با او صحبت کرد."),
        inv(z("کار تمام‹شد."), "کار تمام شد."),
        inv(z("ما صحبت‹می‹کنیم"), z("ما صحبت می‹کنیم")),
        inv(z("استفاده‹کردن"), "استفاده کردن"),
        inv(z("باید با او صحبت‹کنم"), "باید با او صحبت کنم"),
        inv(z("باید ساخته‹شود"), "باید ساخته شود"),
        inv(z("اختصاص‹دادن"), "اختصاص دادن"),
        inv(z("سخن‹گفتم"), "سخن گفتم")
    ]
});
