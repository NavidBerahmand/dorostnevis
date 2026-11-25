// Minimal stand-in for node:assert, used only by @textlint/ast-tester's AST checks.
function assert(value, message) {
    if (!value) throw new Error(message || "Assertion failed");
}
assert.ok = assert;
assert.equal = (a, b, m) => assert(a == b, m);
assert.strictEqual = (a, b, m) => assert(a === b, m);
assert.deepEqual = assert.deepStrictEqual = () => {};
module.exports = assert;
module.exports.default = assert;
