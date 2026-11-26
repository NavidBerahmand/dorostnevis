// Drop the new entries of src/dict/spaced-compounds.json («more») whose spaced form another
// rule of the book already reports across the space («هیچ کس»: the book's list; «کتاب ها»:
// plural-ha; «هم کلاسی»: «هم» as a prefix). The other rule's own reading wins there.
// Usage (from the package directory, which has the tsconfig): node scripts/lists/check-compound-overlap.cjs [--dry]
const path = require("path");
const fs = require("fs");
const ROOT = path.resolve(__dirname, "..", "..", "..");
const top = (m) => require(require.resolve(m, { paths: [path.resolve(ROOT, "..")] }));
const babelConfig = top("textlint-scripts/configs/babel.config");
top("@babel/register")({
    cwd: ROOT,
    babelrc: false,
    configFile: false,
    plugins: babelConfig.plugins,
    presets: babelConfig.presets,
    extensions: [".js", ".ts", ".json"],
    only: [ROOT],
    ignore: [/node_modules/]
});
const { TextlintKernel } = top("@textlint/kernel");
const textPlugin = top("@textlint/textlint-plugin-text");
const preset = require("../../src/index.ts").default;

const FILE = path.join(__dirname, "..", "..", "src", "dict", "spaced-compounds.json");
// statistical guesses and the spelling checker do not make a spaced form theirs
const IGNORE = new Set(["spaced-compounds", "spelling", "ezafe-he", "dictionary"]);
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
const rules = Object.entries(preset.rules)
    .filter(([id]) => !IGNORE.has(id))
    .map(([ruleId, rule]) => ({ ruleId, rule }));
const opts = { ext: ".txt", plugins: [{ pluginId: "text", plugin: textPlugin.default ?? textPlugin }], rules };

(async () => {
    const kernel = new TextlintKernel();
    const lines = data.more.map((r) => r[0]);
    const text = lines.join("\n\n");
    const starts = [];
    let p = 0;
    for (const l of lines) {
        starts.push(p);
        p += l.length + 2;
    }
    const res = await kernel.lintText(text, opts);
    const drop = new Map();
    for (const m of res.messages) {
        if (/احتمال/.test(m.message)) continue;
        const [s, e] = m.fix ? [Math.min(m.range[0], m.fix.range[0]), Math.max(m.range[1], m.fix.range[1])] : m.range;
        // which line, and does it span a space of the compound?
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (starts[mid] <= s) lo = mid;
            else hi = mid - 1;
        }
        const line = lines[lo];
        const a = s - starts[lo];
        const b = e - starts[lo];
        const spaces = [...line].map((c, i) => (c === " " ? i : -1)).filter((i) => i >= 0);
        if (spaces.some((i) => a <= i && b > i)) drop.set(line, m.ruleId);
    }
    const byRule = {};
    for (const r of drop.values()) byRule[r] = (byRule[r] || 0) + 1;
    console.error("covered by another rule:", drop.size, byRule);
    if (process.argv.includes("--dry")) {
        for (const [l, r] of drop) console.log(r, l);
        return;
    }
    data.more = data.more.filter((r) => !drop.has(r[0]));
    fs.writeFileSync(FILE, JSON.stringify(data));
})();
