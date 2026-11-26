# صفحهٔ واج‌بان

textlint و همهٔ قواعد `textlint-rule-preset-farhangestan` (با واژه‌نامه‌ها) در یک فایل جاوااسکریپت و کاملاً در مرورگر اجرا می‌شوند؛ متن کاربر به هیچ سروری فرستاده نمی‌شود.

```sh
npm install          # در ریشهٔ مخزن
npm run build -w packages/web
# خروجی: packages/web/dist/app.js، کنار packages/web/index.html
```

`index.html` بدون `<html>/<head>/<body>` نوشته شده (برای انتشار به‌صورت Artifact در claude.ai)؛ برای اجرای محلی، آن را داخل یک اسکلت HTML بگذارید یا مستقیم در مرورگر باز کنید.

- `src/shims/assert.js`: جایگزین کوچک `node:assert` که یکی از وابستگی‌های textlint در مرورگر لازم دارد.
- `src/lint-setup.ts`: قاعده‌هایی که صفحه اجرا می‌کند، اصلاح خودکار ایرادهای تایپی (`AUTO_FIX`)، ترتیب تقدّم قاعده‌ها (`rank`) و بررسی «پینگ‌پنگ» (`conflictsOf`)؛ بی DOM، تا آزمون همان چیزی را بسنجد که صفحه نشان می‌دهد.
- `npm test -w packages/web`: `tsc` و آزمون «پینگ‌پنگ» (`test/no-ping-pong-test.ts`): هیچ قاعده‌ای نباید اصلاح قاعدهٔ دیگری (یا خودش) را پس بگیرد، «اعمال همه» باید به پایان برسد و روی اصلاح‌های خودش علامت قرمز نگذارد، و اصلاح خودکار نباید چرخه بسازد. قاعدهٔ تازه‌ای که با دیگری تعارض داشته باشد این آزمون را می‌شکند؛ در تعارض، قاعدهٔ پایین‌تر ساکت می‌ماند (دستور خط و فرهنگ املایی > دیگر قاعده‌های کتاب > ویرایش زبانی > قراردادهای «در دستور خط نیامده» > غلط‌یاب).

## vajban.com (Cloudflare Pages)

The site is the Cloudflare Pages project `vajban`, built from this repository on every push to `main`:

- root directory `packages/web`, build command `cd ../.. && npm ci && npm run build:site -w packages/web`, output `dist`;
- `functions/api/report.js` stores «این پیشنهاد غلط است» reports in the D1 database `vajban-reports` (binding `DB`);
- the Kahroba font is in the repository only encrypted (`assets/kahroba.woff2.enc`); the build decrypts it with the Pages secret `FONT_KEY`.
