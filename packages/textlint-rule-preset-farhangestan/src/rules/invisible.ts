/*
 * فاصله‌های ویژه و نویسه‌های نادیدنی
 *
 * فاصله‌های ویژهٔ یونیکد و نویسه‌های نادیدنی (معمولاً از متنِ کپی‌شده می‌آیند) دیده
 * نمی‌شوند ولی جست‌وجو، پیوستگی حروف و شکستن سطر را خراب می‌کنند.
 *
 * - فاصلهٔ باریک، فاصلهٔ کامل چینی و دیگر فاصله‌های یونیکد (U+2000–U+200A، U+202F، U+205F، U+3000) ← فاصلهٔ معمولی
 * - فاصلهٔ نشکن (U+00A0): فقط پیشنهاد، چون جاهایی (عدد و واحد، نام) درست است
 * - فاصلهٔ بی‌عرض (ZWSP، U+200B) میان دو حرف ← نیم‌فاصله؛ جای دیگر ← حذف
 * - BOM (U+FEFF) و word joiner (U+2060) در میان متن ← حذف
 * - اتصال مجازی (ZWJ، U+200D) میان دو حرف فارسی: فقط پیشنهاد، چون برای نشان دادن
 *   شکل پیوستهٔ یک حرف («ه‍») به کار می‌رود
 * - فاصله در آغاز و پایان پاراگراف ← حذف (فقط در متن ساده: در Markdown دو فاصلهٔ
 *   پایانی شکستن سطر است)
 */
import type { TextlintRuleModule } from "@textlint/types";
import { LETTER, ZWNJ } from "../util/persian";
import { SUGGESTION, KIND_SUGGESTION } from "../util/pattern-rule";
import { nbspBelongs } from "../util/nbsp";

const SOURCE = "قراردادهای رایج حروف‌نگاری فارسی (در دستور خط نیامده)";
const FA = /[؀-ۿ]/;
const LETTER_RE = new RegExp(LETTER);

const reporter: TextlintRuleModule = (context, rawOptions) => {
    const options = rawOptions as { suggestions?: boolean } | undefined;
    const { Syntax, RuleError, report, getSource, fixer, locator } = context;
    return {
        [Syntax.Paragraph](node) {
            const text = getSource(node);
            if (!FA.test(text)) return;
            const add = (start: number, end: number, message: string, replacement?: string) => {
                report(node, new RuleError(message, {
                    padding: locator.range([start, end]),
                    ...(replacement !== undefined ? { fix: fixer.replaceTextRange([start, end], replacement) } : {})
                }));
            };
            // NBSP and ZWJ may be meant: on the page they come with a suggested replacement (yellow)
            const suggest = (start: number, end: number, message: string, replacement: string, advice = false) =>
                options?.suggestions
                    ? report(node, new RuleError((advice ? KIND_SUGGESTION : "") + SUGGESTION + message, { padding: locator.range([start, end]), fix: fixer.replaceTextRange([start, end], replacement) }))
                    : add(start, end, message);
            const isLetter = (i: number) => i >= 0 && i < text.length && LETTER_RE.test(text[i]);

            for (const m of text.matchAll(/[ -   　]+/g)) {
                add(m.index!, m.index! + m[0].length, `اینجا یکی از فاصله‌های ویژهٔ یونیکد آمده است؛ میان واژه‌ها فاصلهٔ معمولی به کار می‌رود (${SOURCE})`, " ");
            }
            for (const m of text.matchAll(/ +/g)) {
                // meant to be no-break (since 1.4.0): a dash's inner side, a number and its unit, «ص ۲۳۹», «۲۵ مهر»
                if (m[0].length === 1 && nbspBelongs(text, m.index!)) continue;
                suggest(m.index!, m.index! + m[0].length, `اینجا فاصلهٔ نشکن آمده است؛ فقط جایی لازم است که دو طرفش نباید در دو سطر بیفتند (عدد و واحد، نام)؛ وگرنه فاصلهٔ معمولی (${SOURCE})`, " ", true);
            }
            for (const m of text.matchAll(/​+/g)) {
                const s = m.index!;
                const e = s + m[0].length;
                const between = isLetter(s - 1) && isLetter(e);
                add(s, e, between
                    ? `اینجا «فاصلهٔ بی‌عرض» (ZWSP) آمده است؛ به‌جای آن نیم‌فاصله به کار می‌رود (${SOURCE})`
                    : `اینجا «فاصلهٔ بی‌عرض» (ZWSP) آمده است که دیده نمی‌شود و کاری نمی‌کند؛ باید حذف شود (${SOURCE})`, between ? ZWNJ : "");
            }
            for (const m of text.matchAll(/[﻿⁠]+/g)) {
                add(m.index!, m.index! + m[0].length, `اینجا نویسه‌ای نادیدنی (${m[0][0] === "﻿" ? "BOM" : "word joiner"}) آمده است؛ باید حذف شود (${SOURCE})`, "");
            }
            for (const m of text.matchAll(/‍+/g)) {
                const s = m.index!;
                if (!(isLetter(s - 1) && isLetter(s + m[0].length))) continue;
                suggest(s, s + m[0].length, `اینجا «اتصال مجازی» (ZWJ) آمده که دو حرف را به هم می‌چسباند؛ اگر منظور نیم‌فاصله است، نیم‌فاصله بگذارید (${SOURCE})`, ZWNJ);
            }

            // paragraph edges, only in plain text (all children are Str)
            const plain = (node.children ?? []).every((c: { type: string }) => c.type === Syntax.Str);
            if (plain) {
                const lead = text.match(/^[ \t]+(?=\S)/);
                if (lead) add(0, lead[0].length, `در آغاز پاراگراف فاصله نمی‌آید؛ تورفتگی را با تنظیمات پاراگراف بدهید (${SOURCE})`, "");
                const trail = text.match(/(?<=\S)[ \t]+$/);
                if (trail) add(trail.index!, text.length, `در پایان پاراگراف فاصله نمی‌آید (${SOURCE})`, "");
            }
        }
    };
};

export default { linter: reporter, fixer: reporter };
