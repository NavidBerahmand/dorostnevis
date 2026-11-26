import TextLintTester from "textlint-tester";
import rule from "../src/rules/dictionary";
import { inv, z } from "./helpers";

new TextLintTester().run("dictionary", rule, {
    valid: [
        "روانپزشکی و سیاستمدار",
        z("نبضگاه، نبض‹گاه"),                 // «/» in the dictionary: both valid (p. 600)
        z("آب‹پاش، آبپاش"),                   // «ـ»: rule form and common form (p. 24)
        z("هم‹رأی، همرأی"),                   // «،»: both listed (p. 640)
        z("زبان‹شناسی، نبات‹شناس"),
        "کتابی که خواندم",                     // not in the dictionary
        z("آبرو، آب‹رو"),                      // two entries, two meanings: both valid
        "آشکار، بینا، بلبل، شیء",              // ordinary words sharing letters with a compound
        "بیهوش",                               // joined exception in دستور خط, which wins
        z("دایرة‹المعارف، دایرةالمعارف")        // ZWNJ after «ة» is invisible
    ],
    invalid: [
        // a homograph is never red: «کمکم» is also «کمک» + «م» (1.4.0); no automatic fix
        {
            text: "حالا کمکم کن",
            output: "حالا کمکم کن",
            errors: [{ message: "اگر منظور «کم‌کم» است، «کم‌کم» نوشته می‌شود؛ «کمکم» («کمک» + «م») هم درست است (فرهنگ املایی خطّ فارسی، ص ۵۱۱)" }]
        },
        { text: "دندانهای او", output: "دندانهای او", errors: [{}] },

        inv("زندگینامه او", z("زندگی‹نامه او")),
        inv("فیلمسازی", z("فیلم‹سازی")),
        inv("زبانشناسی", z("زبان‹شناسی")),
        inv("نباتشناس", z("نبات‹شناس")),
        inv(z("آب‹دارخانه"), "آبدارخانه"),
        inv("همدرد", z("هم‹درد")),              // dictionary «همدرد», 2nd edition «هم‌درد» (closed list, p. 40)
        inv("ترشیجات", z("ترشی‹جات"))           // dictionary joined, 2nd edition «-جات» with ZWNJ (p. 60)
    ]
});
