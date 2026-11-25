import assert from "assert";
import { scoresForTest, raScoresForTest } from "../src/util/ezafe-model";
import fixture from "./fixtures/ezafe-parity.json";
import raFixture from "./fixtures/ra-parity.json";

// The TypeScript features must match scripts/ezafe-model/features.py exactly,
// or the model's weights mean something else. The fixture holds Python's scores.
describe("ezafe-model parity with features.py", () => {
    it("scores every fixture sentence like Python", () => {
        let checked = 0;
        for (const [text, expected] of fixture as Array<[string, Array<[string, number]>]>) {
            const got = scoresForTest(text);
            assert.deepStrictEqual(got.map(([w]) => w), expected.map(([w]) => w), text);
            got.forEach(([, p], i) => assert.ok(Math.abs(p - expected[i][1]) < 1e-4, `${text}: ${p} vs ${expected[i][1]}`));
            checked += got.length;
        }
        assert.ok(checked > 300);
    });
});

describe("«را» model parity with features.py", () => {
    it("scores every fixture sentence like Python", () => {
        let checked = 0;
        for (const [text, expected] of raFixture as Array<[string, Array<[string, number]>]>) {
            const got = raScoresForTest(text);
            assert.deepStrictEqual(got.map(([w]) => w), expected.map(([w]) => w), text);
            got.forEach(([, p], i) => assert.ok(Math.abs(p - expected[i][1]) < 1e-4, `${text}: ${p} vs ${expected[i][1]}`));
            checked += got.length;
        }
        assert.ok(checked > 100);
    });
});
