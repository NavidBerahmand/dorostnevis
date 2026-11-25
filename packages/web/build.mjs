import { build } from "esbuild";
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
    logLevel: "info"
});
