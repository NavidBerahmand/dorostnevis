# Third-party notices / منابع و مجوز داده‌ها

The code in this package is MIT-licensed (see `LICENSE`). The data files below
come from other sources and keep their own terms. A build or package that
includes them is bound by those terms too: in particular, the Farhangestan data
allows **free, non-commercial use with attribution** only.

کد این بسته با مجوز MIT است. فایل‌های دادهٔ زیر از منابع دیگرند و شرایط خودشان را دارند؛
هر نسخه یا بسته‌ای که آن‌ها را در بر دارد تابع همین شرایط است. به‌ویژه دادهٔ فرهنگستان
فقط برای **استفادهٔ رایگان و غیرتجاری با ذکر منبع** است.

| فایل | منبع | شرایط |
| --- | --- | --- |
| `src/dict/farhang-emlaei.json`، `src/dict/farhang-v2-overrides.json` | [فرهنگ املایی خطّ فارسی](https://apll.ir/wp-content/uploads/2018/10/F-E-1394.pdf)، فرهنگستان زبان و ادب فارسی، ۱۳۹۴ | استفادهٔ رایگان و غیرتجاری با ذکر منبع، به اجازهٔ فرهنگستان |
| `src/dict/multi-spelling.json`، `book-joined.json`، `compounds.json`، `arabic.json`، `hamza.json`، و مثال‌ها و ارجاع‌های قاعده‌ها | [دستور خطّ فارسی (ویراست جدید)](https://apll.ir/wp-content/uploads/2023/07/Dastour-e-Khat-17.04.1402.pdf)، فرهنگستان زبان و ادب فارسی، ۱۴۰۱ | همان |
| `src/dict/spelling-lexicon.json` (بسامد واژه‌ها)، `src/dict/ezafe-model.json` و `src/dict/ra-model.json` (وزن‌های مدل)، `scripts/ezafe-model/hand-labels*.jsonl` (جمله‌های برچسب‌خورده) | ویکی‌پدیای فارسی (fa.wikipedia.org)، به قلم ویرایشگرانش | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)؛ این فایل‌ها با همین مجوز منتشر می‌شوند |
| `src/dict/spaced-compounds.json` | ترکیب‌های فرهنگ املایی (فرهنگستان) که با شمارش متن ویکی‌پدیای فارسی برگزیده شده‌اند؛ فقط واژه‌ها و شمارها، بی‌متن ویکی‌پدیا | شرایط دادهٔ فرهنگستان |
| `src/dict/hazm-*.json`، `src/dict/ezafe-pos.json` | [Hazm](https://github.com/roshan-research/hazm) | MIT (متن زیر) |
| قاعده‌های حالت گفت‌وگو (`textlint-rule-preset-shekaste`) | اصول شکسته‌نویسی، علی صلح‌جو | فقط ارجاع؛ متنی از کتاب در مخزن نیست |

Persian Wikipedia: text by Wikipedia contributors, https://fa.wikipedia.org,
licensed CC BY-SA 4.0. The lexicon holds word forms with their frequency
buckets; the models hold feature weights learnt from article text; the
hand-label files quote short sentences. Changes: text extracted from the dump,
tokenised and counted or used as training examples.

## Hazm

`src/dict/hazm-*.json` and `src/dict/ezafe-pos.json`
are derived from the data files of Hazm (https://github.com/roshan-research/hazm),
used under the following licence:

```
The MIT License (MIT)

Copyright (c) 2013 Alireza Nourian

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
