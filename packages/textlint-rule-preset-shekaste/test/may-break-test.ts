import TextLintTester from "textlint-tester";
import rule from "../src/rules/may-break";
import { z } from "./helpers";

const one = (text: string) => ({ text, errors: [{}] });
new TextLintTester().run("may-break", rule, {
    valid: [z("می‹خورم، می‹خوابم"), "علی آقا خانه است", "بابا طبقهٔ بالاست"],
    invalid: [one(z("می‹روم")), one(z("نمی‹توانم")), one("هوا سرد است"), one("صدایم گرفته"), one("چگونه")]
});
