import TextLintTester from "textlint-tester";
import rule from "../src/rules/normalize-characters";
import { inv, z } from "./helpers";

new TextLintTester().run("normalize-characters", rule, {
    valid: ["یک کتاب فارسی ۱۲۳", z("کتاب‹ها")],
    invalid: [
        inv("كتاب", "کتاب"),
        inv("علي", "علی"),
        inv("اعضاى", "اعضای"),
        inv("مخاطبـانی", "مخاطبانی"),
        inv("واژه‏ها", z("واژه‹ها")),
        inv("ناﻣﻪ", "نامه", 2),
        inv("سال ١٤٠٤", "سال ۱۴۰۴", 4),
        inv("رییٔس", "رییس".slice(0, 2) + "ئس"),
        inv("حرف\u00adهاست", z("حرف‹هاست")),
        // a Persian sentence that happens to have «البته، الگو»: still a plain fix
        inv("البته الگوی او نيست.", "البته الگوی او نیست."),
        // an Arabic quotation: reported, never fixed automatically
        { text: "قال: «بسم الله الرحمن الرحيم» و رفت.", output: "قال: «بسم الله الرحمن الرحيم» و رفت.", errors: [{}] }
    ]
});
