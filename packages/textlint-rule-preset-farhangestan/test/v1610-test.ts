import assert from "assert";
import { ezafeCandidates } from "../src/util/ezafe-model";

/*
 * 1.6.10: the ezafe model retrained (more articles that mark the ezafe, the marks around the word, the word after next
 * with the head), and words with «ی» or «و» before their silent «ه» are candidates («شیوه، نحوه، سایه، نظریه»).
 */
const cand = (t: string, w: string) => ezafeCandidates(t).find((c) => c.word === w);

describe("ezafe model (1.6.10)", () => {
    it("words in «ـیه»، «ـوه» are candidates, and in the ezafe here", () => {
        for (const [t, w] of [["نحوه انجام کار را توضیح داد.", "نحوه"], ["در سایه این درخت نشستیم.", "سایه"], ["پایه این ساختمان محکم است.", "پایه"], ["شیوه زندگی او ساده بود.", "شیوه"]]) {
            const c = cand(t, w);
            assert.ok(c && c.p >= 0.8, `${t}: ${c?.p}`);
        }
    });
    it("a pronounced «ه» and spoken «یه»، «چیه» are not", () => {
        for (const [t, w] of [["فقیه بزرگی بود.", "فقیه"], ["گروه کوچکی آمد.", "گروه"], ["یه دونه بده.", "یه"], ["این چیه دیگه؟", "چیه"], ["دانش پژوه جوانی است.", "پژوه"]]) assert.strictEqual(cand(t, w), undefined, t);
    });
    it("no ezafe before a verb or at a phrase's end", () => {
        const c = cand("او به خانه رفت.", "خانه");
        assert.ok(!c || c.p < 0.5, String(c?.p));
    });
});
