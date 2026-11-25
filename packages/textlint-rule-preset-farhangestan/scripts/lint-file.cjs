// Lint a plain-text file with the built preset and print a per-rule summary.
// Usage: node scripts/lint-file.cjs <file.txt> [--show rule-id] [--summary rule-id] [--fix out.txt]
const fs = require("fs");
const { TextlintKernel } = require("@textlint/kernel");
const textPlugin = require("@textlint/textlint-plugin-text");
const preset = require("../lib/index.js").default ?? require("../lib/index.js");

const [file, ...args] = process.argv.slice(2);
const show = args.includes("--show") ? args[args.indexOf("--show") + 1] : null;
const fixOut = args.includes("--fix") ? args[args.indexOf("--fix") + 1] : null;
const summary = args.includes("--summary") ? args[args.indexOf("--summary") + 1] : null;
const text = fs.readFileSync(file, "utf8");
const kernel = new TextlintKernel();
const opts = {
    ext: ".txt",
    plugins: [{ pluginId: "text", plugin: textPlugin.default ?? textPlugin }],
    rules: Object.entries(preset.rules).map(([ruleId, rule]) => ({ ruleId, rule }))
};
(async () => {
    const result = await kernel.lintText(text, opts);
    const counts = {};
    for (const m of result.messages) counts[m.ruleId] = (counts[m.ruleId] || 0) + 1;
    console.log(counts);
    if (show) {
        const vis = (s) => s.replace(/‌/g, "‹").replace(/‏/g, "®");
        for (const m of result.messages.filter((m) => m.ruleId === show)) {
            const [s, e] = m.range;
            const ctx = vis(text.slice(Math.max(0, s - 15), e + 15)).replace(/\n/g, " ");
            console.log(`${m.line}:${m.column}\t${vis(m.fix ? m.fix.text : "-")}\t${ctx}`);
        }
    }
    if (summary) {
        // «original → fix» pairs with counts
        const vis = (s) => s.replace(/\u200C/g, "‹");
        const pairs = {};
        for (const m of result.messages.filter((m) => m.ruleId === summary)) {
            const k = `${vis(text.slice(m.range[0], m.range[1]))} → ${m.fix ? vis(m.fix.text) : "(—)"}`;
            pairs[k] = (pairs[k] || 0) + 1;
        }
        const list = Object.entries(pairs).sort((a, b) => b[1] - a[1]);
        console.log(list.map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(" | "));
    }
    if (fixOut) {
        const fixed = await kernel.fixText(text, opts);
        fs.writeFileSync(fixOut, fixed.output);
    }
})();
