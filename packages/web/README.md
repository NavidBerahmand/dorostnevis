# صفحهٔ واج‌بان

textlint و همهٔ قواعد `textlint-rule-preset-farhangestan` (با واژه‌نامه‌ها) در یک فایل جاوااسکریپت و کاملاً در مرورگر اجرا می‌شوند؛ متن کاربر به هیچ سروری فرستاده نمی‌شود.

```sh
npm install          # در ریشهٔ مخزن
npm run build -w packages/web
# خروجی: packages/web/dist/app.js، کنار packages/web/index.html
```

`index.html` بدون `<html>/<head>/<body>` نوشته شده (برای انتشار به‌صورت Artifact در claude.ai)؛ برای اجرای محلی، آن را داخل یک اسکلت HTML بگذارید یا مستقیم در مرورگر باز کنید.

- `src/shims/assert.js`: جایگزین کوچک `node:assert` که یکی از وابستگی‌های textlint در مرورگر لازم دارد.

## vajban.com (Cloudflare Pages)

The site is the Cloudflare Pages project `vajban`, built from this repository on every push to `main`:

- root directory `packages/web`, build command `cd ../.. && npm ci && npm run build:site -w packages/web`, output `dist`;
- `functions/api/report.js` stores «این پیشنهاد غلط است» reports in the D1 database `vajban-reports` (binding `DB`);
- the Kahroba font is in the repository only encrypted (`assets/kahroba.woff2.enc`); the build decrypts it with the Pages secret `FONT_KEY`.
