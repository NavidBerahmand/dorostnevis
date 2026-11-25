# صفحهٔ آزمایشی درست‌نویس

textlint و همهٔ قواعد `textlint-rule-preset-farhangestan` (با واژه‌نامه‌ها) در یک فایل جاوااسکریپت و کاملاً در مرورگر اجرا می‌شوند؛ متن کاربر به هیچ سروری فرستاده نمی‌شود.

```sh
npm install          # در ریشهٔ مخزن
npm run build -w packages/web
# خروجی: packages/web/dist/app.js، کنار packages/web/index.html
```

`index.html` بدون `<html>/<head>/<body>` نوشته شده (برای انتشار به‌صورت Artifact در claude.ai)؛ برای اجرای محلی، آن را داخل یک اسکلت HTML بگذارید یا مستقیم در مرورگر باز کنید.

- `src/shims/assert.js`: جایگزین کوچک `node:assert` که یکی از وابستگی‌های textlint در مرورگر لازم دارد.
