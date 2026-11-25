import TextLintTester from "textlint-tester";
import rule from "../src/rules/repeated-words";
import { inv } from "./helpers";

new TextLintTester().run("repeated-words", rule, {
    valid: ["کم کم آمد", "آرام آرام رفت", "تک تک آن‌ها", "او و ما", "رادیو و تلویزیون"],
    invalid: [
        inv("کتاب را را برداشت", "کتاب را برداشت"),
        inv("من و و تو", "من و تو"),
        inv("خوب است است", "خوب است")
    ]
});
