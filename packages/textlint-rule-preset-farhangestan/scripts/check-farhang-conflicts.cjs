// Find where فرهنگ املایی (1394, based on the 1st edition of دستور خط)
// disagrees with the 2nd edition, and record the 2nd-edition spelling.
//
// Usage: npm run build && node scripts/check-farhang-conflicts.cjs
//
// Two sources of conflicts:
// 1. Every rule of this preset (except `dictionary` itself) is run over each
//    dictionary form. Whatever a rule changes is a conflict, and the rule's
//    output wins.
// 2. «هم-»: the 2nd edition gives a closed list of joined exceptions (ص ۴۰);
//    every other «هم» + word is written with ZWNJ. The dictionary writes many
//    of them joined («همدرد»).
//
// Writes src/dict/farhang-v2-overrides.json and docs/farhang-conflicts.md
// (at the repository root).
const fs = require("fs");
const path = require("path");
const { TextlintKernel } = require("@textlint/kernel");
const textPlugin = require("@textlint/textlint-plugin-text");

const ROOT = path.join(__dirname, "..");
const DICT = path.join(ROOT, "src", "dict");
const ZWNJ = "‌";

// start from no overrides, so the rules see the dictionary as it is
fs.writeFileSync(path.join(DICT, "farhang-v2-overrides.json"), JSON.stringify({ overrides: {} }) + "\n");
for (const k of Object.keys(require.cache)) if (k.includes(`${path.sep}lib${path.sep}`)) delete require.cache[k];
const preset = require(path.join(ROOT, "lib", "index.js")).default;

const farhang = JSON.parse(fs.readFileSync(path.join(DICT, "farhang-emlaei.json"), "utf8")).entries;
const bookJoined = JSON.parse(fs.readFileSync(path.join(DICT, "book-joined.json"), "utf8"));
const hazm = new Set(JSON.parse(fs.readFileSync(path.join(DICT, "hazm-words.json"), "utf8")).words);

const HAM_EXCEPTIONS = bookJoined.groups.find((g) => g.source.startsWith("«هم»")).words;
// «هم» here is not the prefix (places, other words)
const NOT_HAM_PREFIX = new Set([
    "همدان", "همدانی", "همهمه", "همگان", "همگانی", "همگی", "همانا", "همزه", "همیشه", "همیشگی", "همت", "همتی",
    "همدگر" // variant of «همدیگر», which is on the exception list
]);
const NOT_HAM_PREFIX_START = ["همبرگر"]; // hamburger

function hamForm(word) {
    if (!word.startsWith("هم") || word[2] === ZWNJ || NOT_HAM_PREFIX.has(word)) return null;
    if (NOT_HAM_PREFIX_START.some((p) => word.startsWith(p))) return null;
    // exceptions and their derivatives («همکاری» from «همکار», «همسایگی» from «همسایه»)
    for (const e of HAM_EXCEPTIONS) {
        if (word.startsWith(e) || (e.endsWith("ه") && word.startsWith(e.slice(0, -1) + "گ"))) return null;
    }
    const rest = word.slice(2);
    if (rest.length < 3 || rest.startsWith("ه")) return null;
    const known = hazm.has(rest) || rest in farhang;
    return known ? "هم" + ZWNJ + rest : null;
}

// ترکیب‌ها، الف-۱، تبصرهٔ ۴: these suffixes always take ZWNJ (the joined forms
// in footnotes 39 and 41 are «رایج», so they stay valid)
const ZWNJ_SUFFIXES = ["جات", "آسا", "آگین", "باره", "فام", "وش"];
const SUFFIX_JOINED_OK = new Set(["حوالجات", "سبزیجات", "قبالجات", "کارخانجات", "پریوش", "مهوش"]);
function suffixForm(word) {
    if (word.includes(ZWNJ) || SUFFIX_JOINED_OK.has(word)) return null;
    for (const suf of ZWNJ_SUFFIXES) {
        if (!word.endsWith(suf)) continue;
        const stem = word.slice(0, -suf.length);
        if (stem.length < 2 || "اآأدذرزژوۀ".includes(stem[stem.length - 1])) continue;
        if (hazm.has(stem) || stem in farhang) return stem + ZWNJ + suf;
    }
    return null;
}

(async () => {
    const keys = Object.keys(farhang).filter((k) => farhang[k][0]);
    const forms = keys.map((k) => farhang[k][0]);
    const rules = Object.entries(preset.rules)
        .filter(([id]) => id !== "dictionary")
        .map(([ruleId, rule]) => ({ ruleId, rule }));
    const kernel = new TextlintKernel();
    const opts = { ext: ".txt", plugins: [{ pluginId: "text", plugin: textPlugin.default ?? textPlugin }], rules };
    const text = forms.join("\n\n");
    const lint = await kernel.lintText(text, opts);
    const fixed = (await kernel.fixText(text, opts)).output.split("\n\n");
    if (fixed.length !== forms.length) throw new Error("line count changed while fixing");

    const byLine = new Map();
    for (const m of lint.messages) {
        const i = Math.floor((m.line - 1) / 2);
        if (!byLine.has(i)) byLine.set(i, new Set());
        byLine.get(i).add(m.ruleId);
    }

    const overrides = {};
    const report = [];
    forms.forEach((form, i) => {
        let target = fixed[i] !== form ? fixed[i] : null;
        let why = target ? [...(byLine.get(i) ?? [])].join("، ") : null;
        const suffixed = suffixForm(target ?? form);
        if (suffixed) {
            target = suffixed;
            why = "ترکیب‌ها، الف-۱، تبصرهٔ ۴ (ص ۶۰)";
        }
        const ham = hamForm(target ?? form);
        if (ham) {
            target = ham;
            why = why ? `${why}، فهرست بستهٔ «هم-»` : "فهرست بستهٔ «هم-» (ص ۴۰)";
        }
        if (target && target !== form) {
            overrides[keys[i]] = target;
            report.push(`| ${form} | ${target} | ${why} | ${farhang[keys[i]][2]} |`);
        }
    });

    fs.writeFileSync(
        path.join(DICT, "farhang-v2-overrides.json"),
        JSON.stringify(
            {
                source: "scripts/check-farhang-conflicts.cjs: dictionary forms the 2nd edition of دستور خط writes differently",
                overrides
            },
            null,
            0
        ) + "\n"
    );
    const docs = path.join(ROOT, "..", "..", "docs");
    fs.mkdirSync(docs, { recursive: true });
    fs.writeFileSync(
        path.join(docs, "farhang-conflicts.md"),
        [
            "# تعارض‌های فرهنگ املایی (۱۳۹۴) با ویراست دوم دستور خط",
            "",
            "این فهرست خودکار با `scripts/check-farhang-conflicts.cjs` ساخته می‌شود. در همهٔ این موارد شکل ستون «ویراست دوم» به کار می‌رود.",
            "",
            `تعداد: ${report.length} از ${forms.length} مدخل یک‌کلمه‌ای`,
            "",
            "| فرهنگ املایی | ویراست دوم | قاعده | صفحهٔ فرهنگ |",
            "|---|---|---|---|",
            ...report
        ].join("\n") + "\n"
    );
    console.log(`${report.length} conflicts out of ${forms.length} entries`);
})();
