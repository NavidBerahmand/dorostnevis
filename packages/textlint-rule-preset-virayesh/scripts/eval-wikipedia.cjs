// Run the language-editing rules on held-out Wikipedia text; print counts and samples per rule.
// Usage (from this package): NODE_PATH=../../node_modules node scripts/eval-wikipedia.cjs text.txt [chars]
// Counts each rule's reports on a plain-text sample and prints a dozen of each, for checking by hand.
require("../test/register.cjs");
const { TextlintKernel } = require("@textlint/kernel");
const textPlugin = require("@textlint/textlint-plugin-text");
const preset = require("../src/index.ts").default;
const fs = require("fs");
(async () => {
  const text = fs.readFileSync(process.argv[2], "utf8").slice(0, Number(process.argv[3] || 3e6));
  const k = new TextlintKernel();
  const rules = Object.entries(preset.rules).map(([ruleId, rule]) => ({ ruleId, rule, options: true }));
  const res = await k.lintText(text, { ext: ".txt", plugins: [{ pluginId: "text", plugin: textPlugin.default ?? textPlugin }], rules });
  const by = {};
  for (const m of res.messages) (by[m.ruleId] ??= []).push(m);
  const words = text.split(/\s+/).length;
  console.log("words", words);
  for (const [r, ms] of Object.entries(by)) {
    console.log(`\n== ${r}: ${ms.length}`);
    const step = Math.max(1, Math.floor(ms.length / 12));
    for (let i = 0; i < ms.length && i / step < 12; i += step) {
      const m = ms[i]; const [s, e] = m.range;
      console.log("  …" + text.slice(Math.max(0, s - 40), s).replace(/\n/g, " ") + "⟦" + text.slice(s, e) + "⟧" + text.slice(e, e + 30).replace(/\n/g, " ") + (m.fix ? "  → " + m.fix.text : ""));
    }
  }
})();
