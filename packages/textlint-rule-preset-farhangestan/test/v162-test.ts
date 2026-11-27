import assert from "assert";
import { writtenForm, registerSegments, scoreOf } from "../src/util/colloquial";
import { inBank, bankFormal, BANK_SIZE } from "../src/util/colloquial-bank";
import { z } from "./helpers";

/*
 * 1.6.2: the colloquial word bank (util/colloquial-bank.ts): spoken forms spelled as they should be; their
 * written form only where it is reliable; a bank word counts as spoken for the register.
 */
describe("1.6.2: the colloquial word bank", function () {
    it("holds correctly spelled spoken words, not their misspellings", () => {
        assert.ok(BANK_SIZE > 2000);
        for (const w of ["دیگه", "اگه", "خونه", z("می‹دونم"), z("می‹خوام"), "بذار", "تموم", "کتابا", "آره", "باشه"]) assert.ok(inBank(w), w);
        for (const w of ["میدونم", "میخوام", "میخام", "بزار", "اره", "واقعن", "تاحالا", "اونموقع", "بلاخره", "بیوفته", "رو", "اون", "اونو"]) assert.ok(!inBank(w), w);
        // «ي/ك» are read as «ی/ک»
        assert.ok(inBank("ديگه"));
    });

    it("the written form: the bank's, else none for a bank word; not a non-word like «بایهایشان»", () => {
        assert.strictEqual(writtenForm("دیگه"), "دیگر");
        assert.strictEqual(writtenForm(z("می‹خوام")), z("می‹خواهم"));
        assert.strictEqual(writtenForm("تموم"), "تمام");
        // two readings, or a name in a written text
        for (const w of ["منم", "یه", "چی", "نیس", "ازت", "روزا", "بگین", "باهاشون"]) assert.strictEqual(writtenForm(w), null, w);
        assert.deepStrictEqual(bankFormal("نون"), []);
        // «میتونید»: with the half-space of «می»
        assert.ok([null, z("می‹توانید")].includes(writtenForm("میتونید")));
    });

    it("bank words count for the register, written words the bank also has do not", () => {
        assert.ok(scoreOf("هنوز تموم نشده").sure >= 1);
        assert.ok(registerSegments("هنوز تموم نشده.")[0].spoken);
        assert.ok(!registerSegments("چنان شنیدم که پسرم آمد.")[0].spoken);
        assert.ok(!registerSegments("زنگ تفریح که خورد، سارا دوید سمتش.")[0].spoken);
    });
});
