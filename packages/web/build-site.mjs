// The site for Cloudflare Pages (vajban.com): the page build, plus
// - the Kahroba font, which the repository holds only encrypted (assets/kahroba.woff2.enc,
//   AES-256-GCM): the key is the Pages secret FONT_KEY, so the licensed file is never public
//   in the repository but is served on the licensed site;
// - a full HTML document around index.html (claude.ai adds that wrapper itself);
// - cache headers.
import { createDecipheriv } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";

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

// a new name for app.js on every build, so a cached old script never runs with a new page
const { createHash } = await import("node:crypto");
const hash = createHash("sha256").update(readFileSync(here("./dist/app.js"))).digest("hex").slice(0, 10);
// the version shown at the foot of every page (package.json), in Persian digits
const pkg = JSON.parse(readFileSync(here("./package.json"), "utf8"));
const version = pkg.version.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

/** A page as a full HTML document (claude.ai used to add this wrapper itself). */
function writePage(src, out, { description, url }) {
    let page = readFileSync(here(src), "utf8").replaceAll("{{VERSION}}", version);
    if (src === "./index.html") {
        page = page.replace(/src="app\.js"/, `src="app.js?v=${hash}"`);
        if (!page.includes(`app.js?v=${hash}`)) throw new Error("index.html: the app.js script tag was not found");
    }
    const title = page.match(/<title>([^<]*)<\/title>/)?.[1] ?? "واج‌بان";
    const head = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="${description}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="fa_IR">
<meta name="theme-color" content="#f5f2e8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1a1c15" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-title" content="واج‌بان">
<meta name="application-name" content="واج‌بان">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="canonical" href="${url}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%235f6549'/%3E%3Ctext x='32' y='44' font-size='34' text-anchor='middle' fill='%23f5f2e8' font-family='Tahoma'%3E%D9%88%3C/text%3E%3C/svg%3E">
<style>html,body{margin:0}</style>
`;
    writeFileSync(here(out), head + page + "\n</html>\n");
    console.log(`${out} written (version ${pkg.version})`);
}
writePage("./index.html", "./dist/index.html", {
    description: "واج‌بان، نگهبان سخن: املا و نگارش فارسی را طبق دستور خط فرهنگستان بررسی و درست می‌کند.",
    url: "https://vajban.com/"
});
writePage("./about.html", "./dist/about.html", {
    description: "واج‌بان چیست، رنگ‌ها یعنی چه، متن شما کجا می‌رود، و منابع و مجوزها.",
    url: "https://vajban.com/about"
});
// the home-screen app (1.5.2): its name is «واج‌بان», not the page title; icons rendered from
// «و» in Vazirmatn (OFL) on the site's colours (assets/*.png)
for (const f of ["apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]) copyFileSync(here(`./assets/${f}`), here(`./dist/${f}`));
writeFileSync(
    here("./dist/manifest.webmanifest"),
    JSON.stringify(
        {
            name: "واج‌بان",
            short_name: "واج‌بان",
            description: "املا و نگارش فارسی طبق دستور خط فرهنگستان",
            lang: "fa",
            dir: "rtl",
            start_url: "/",
            scope: "/",
            display: "standalone",
            theme_color: "#5f6549",
            background_color: "#f5f2e8",
            icons: [
                { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
                { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
                { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
                { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
            ]
        },
        null,
        1
    )
);
writeFileSync(here("./dist/_headers"), `/manifest.webmanifest
  Content-Type: application/manifest+json; charset=utf-8
  Cache-Control: public, max-age=86400
/*.png
  Cache-Control: public, max-age=604800
/app.js
  Cache-Control: public, max-age=31536000, immutable
/spelling-lexicon.json
  Cache-Control: public, max-age=86400
/kahroba.woff2
  Cache-Control: public, max-age=31536000, immutable
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`);
