import { build } from "esbuild";
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The spelling lexicon (3 MB) is not bundled: the page fetches it after it loads.
const lexiconStub = fileURLToPath(new URL("./src/shims/empty-lexicon.json", import.meta.url));
const lazyLexicon = {
    name: "lazy-lexicon",
    setup(b) {
        b.onResolve({ filter: /spelling-lexicon\.json$/ }, () => ({ path: lexiconStub }));
    }
};
await build({
    entryPoints: ["src/app.ts"],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    minify: true,
    // Persian word lists stay as UTF-8 (the default escapes each letter as \uXXXX, ~3x larger)
    charset: "utf8",
    outfile: "dist/app.js",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: { "node:assert": "./src/shims/assert.js", assert: "./src/shims/assert.js" },
    plugins: [lazyLexicon],
    logLevel: "info"
});
copyFileSync(new URL("../textlint-rule-preset-farhangestan/src/dict/spelling-lexicon.json", import.meta.url), new URL("./dist/spelling-lexicon.json", import.meta.url));

// The Kahroba typeface is licensed (fontiran.com), so it is not in the repository: put
// Kahroba-VF.woff2 in packages/web/fonts/ (git-ignored) and the build serves it beside the page.
const font = new URL("./fonts/Kahroba-VF.woff2", import.meta.url);
if (existsSync(font)) copyFileSync(font, new URL("./dist/kahroba.woff2", import.meta.url));
else console.warn("fonts/Kahroba-VF.woff2 not found: the page falls back to Vazirmatn");
