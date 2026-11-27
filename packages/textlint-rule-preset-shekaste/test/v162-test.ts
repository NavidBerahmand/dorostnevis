import TextLintTester from "textlint-tester";
import spokenRa from "../src/rules/spoken-ra";
import spokenSpelling from "../src/rules/spoken-spelling";
import { inv, z } from "./helpers";

/** 1.6.2: «رو»، «اون»، «اونو» (a recommendation: no fix on the command line) and «میتونید» → «می‌تونید». */
const ask = (text: string, count = 1) => ({ text, output: text, errors: Array.from({ length: count }, () => ({})) });

new TextLintTester().run("spoken-ra", spokenRa, {
    valid: [
        "از این رو باید رفت", z("از این‹ رو باید رفت"), "ازین رو آمد", "به همین رو", "خانه رو به دریا بود", "رو در رو نشستند",
        "همه را زیر و رو کردند", "برنامه‌های پیش رو", "به اسلام رو آوردند", "کوچ رو هستند", "واژۀ «رو»", z("اون‹ها رفتند"), "اون Wilson"
    ],
    invalid: [ask("کتاب رو بده"), ask("رو میز بود"), ask("اون رفت"), ask("اونو بردم"), ask("کتاب رو آوردم"), ask("خدا رو شکر"), ask("اون کتاب رو بده", 2)]
});
new TextLintTester().run("spoken-spelling (1.6.2)", spokenSpelling, {
    valid: [z("می‹تونید بیاید")],
    invalid: [inv("میتونید بیاید", z("می‹تونید بیاید"))]
});
