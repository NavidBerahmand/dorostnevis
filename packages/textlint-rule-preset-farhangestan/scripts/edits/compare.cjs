// Compare human orthographic edits (extract_edits.py output) with what the preset does.
//
// For each edit «before → after» in its line, the preset runs on the line as it was:
//   agree    the automatic fixes turn «before» into «after»
//   flagged  no automatic fix gives «after», but a report covers the word (a suggestion)
//   other    the preset changes the word into something else
//   missed   the preset says nothing about the word
// and on the line as the editor left it:
//   undone   the preset would change the editor's «after» again
//
// Usage: node scripts/edits/compare.cjs edits.jsonl out-prefix   (after npm run build)
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "../../../..");
const { TextlintKernel } = require(path.join(root, "node_modules/@textlint/kernel"));
const tp = require(path.join(root, "node_modules/@textlint/textlint-plugin-text"));
const preset = require(path.join(__dirname, "../../lib/index.js")).default;

const kernel = new TextlintKernel();
const opts = {
    ext: ".txt",
    plugins: [{ pluginId: "text", plugin: tp.default ?? tp }],
    // Wikipedia writes the ezafe mark as «هٔ»: compare in that style
    rules: Object.entries(preset.rules).map(([ruleId, rule]) => ({ ruleId, rule, options: ruleId === "ezafe-he" ? { style: "he-hamza" } : true }))
};

/** Apply, round after round, only the automatic fixes that touch [s, e). */
async function fixRegion(text, s, e) {
    let t = text;
    for (let round = 0; round < 3; round++) {
        const msgs = (await kernel.lintText(t, opts)).messages.filter((m) => m.fix && m.fix.range[0] < e && m.fix.range[1] > s - (m.fix.range[0] === m.fix.range[1] ? 1 : 0));
        if (!msgs.length) break;
        // apply from the end; skip overlapping fixes
        msgs.sort((a, b) => b.fix.range[0] - a.fix.range[0]);
        let limit = Infinity;
        for (const m of msgs) {
            const [a, b] = m.fix.range;
            if (b > limit) continue;
            t = t.slice(0, a) + m.fix.text + t.slice(b);
            e += m.fix.text.length - (b - a);
            limit = a;
        }
    }
    return t;
}

(async () => {
    const [input, prefix] = process.argv.slice(2);
    const lines = fs.readFileSync(input, "utf8").split("\n").filter(Boolean);
    const out = fs.createWriteStream(prefix + ".annotated.jsonl");
    const counts = {};
    let n = 0;
    for (const line of lines) {
        const e = JSON.parse(line);
        const i = e.context.indexOf(e.after);
        if (i < 0) continue;
        const ctxAfter = e.context;
        const ctxBefore = ctxAfter.slice(0, i) + e.before + ctxAfter.slice(i + e.after.length);
        const s = i;
        const eBefore = i + e.before.length;
        const fixed = await fixRegion(ctxBefore, s, eBefore);
        const lint = await kernel.lintText(ctxBefore, opts);
        const touching = lint.messages.filter((m) => m.range[0] < eBefore && m.range[1] > s);
        const L = ctxBefore.slice(Math.max(0, s - 12), s);
        const R = ctxBefore.slice(eBefore, eBefore + 12);
        let verdict;
        if (fixed.includes(L + e.after + R)) verdict = "agree";
        else if (fixed !== ctxBefore) verdict = "other";
        else if (touching.length) verdict = "flagged";
        else verdict = "missed";
        // would the preset change the editor's result?
        const lintAfter = await kernel.lintText(ctxAfter, opts);
        const undone = lintAfter.messages.some((m) => m.fix && m.range[0] < i + e.after.length && m.range[1] > i);
        counts[verdict] = (counts[verdict] ?? 0) + 1;
        if (undone) counts.undone = (counts.undone ?? 0) + 1;
        out.write(JSON.stringify({ ...e, verdict, undone, rules: [...new Set(touching.map((m) => m.ruleId))], fixed }) + "\n");
        if (++n % 2000 === 0) process.stderr.write(`${n}\n`);
    }
    out.end();
    fs.writeFileSync(prefix + ".counts.json", JSON.stringify({ total: n, ...counts }, null, 1));
    console.log(JSON.stringify({ total: n, ...counts }));
})();
