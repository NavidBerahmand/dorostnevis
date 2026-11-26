// The site for Cloudflare Pages (vajban.com): the page build, plus
// - the Kahroba font, which the repository holds only encrypted (assets/kahroba.woff2.enc,
//   AES-256-GCM): the key is the Pages secret FONT_KEY, so the licensed file is never public
//   in the repository but is served on the licensed site;
// - a full HTML document around index.html (claude.ai adds that wrapper itself);
// - cache headers.
import { createDecipheriv } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

await import("./build.mjs");
const here = (p) => new URL(p, import.meta.url);

const key = process.env.FONT_KEY;
if (key && existsSync(here("./assets/kahroba.woff2.enc"))) {
    const blob = readFileSync(here("./assets/kahroba.woff2.enc"));
    const d = createDecipheriv("aes-256-gcm", Buffer.from(key, "base64"), blob.subarray(0, 12));
    d.setAuthTag(blob.subarray(12, 28));
    writeFileSync(here("./dist/kahroba.woff2"), Buffer.concat([d.update(blob.subarray(28)), d.final()]));
    console.log("kahroba.woff2 decrypted");
} else if (!existsSync(here("./dist/kahroba.woff2"))) {
    console.warn("FONT_KEY not set: the page falls back to Vazirmatn");
}

const page = readFileSync(here("./index.html"), "utf8");
const head = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="واج‌بان، نگهبان سخن: املا و نگارش فارسی را طبق دستور خط فرهنگستان بررسی و درست می‌کند.">
<meta property="og:title" content="واج‌بان، نگهبان سخن">
<meta property="og:description" content="املا و نگارش فارسی را طبق دستور خط فرهنگستان بررسی و درست می‌کند.">
<meta property="og:url" content="https://vajban.com/">
<meta property="og:locale" content="fa_IR">
<meta name="theme-color" content="#f5f2e8">
<link rel="canonical" href="https://vajban.com/">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%235f6549'/%3E%3Ctext x='32' y='44' font-size='34' text-anchor='middle' fill='%23f5f2e8' font-family='Tahoma'%3E%D9%88%3C/text%3E%3C/svg%3E">
<style>html,body{margin:0}</style>
`;
writeFileSync(here("./dist/index.html"), head + page + "\n</html>\n");
writeFileSync(here("./dist/_headers"), `/app.js
  Cache-Control: public, max-age=3600
/spelling-lexicon.json
  Cache-Control: public, max-age=86400
/kahroba.woff2
  Cache-Control: public, max-age=31536000, immutable
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`);
console.log("dist/index.html written");
