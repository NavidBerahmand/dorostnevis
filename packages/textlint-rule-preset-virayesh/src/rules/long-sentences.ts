/*
 * جملۀ خیلی بلند و «که»ی پی‌درپی (پیشنهاد، بدون اصلاح خودکار)
 *
 * - جمله‌ای با بیش از maxWords کلمه (پیش‌فرض ۴۰): شکستن آن به دو جمله
 *   خواندن را آسان می‌کند.
 * - سه «که» یا بیشتر در یک جمله: «کتابی که دوستی که در شهری که…».
 *
 * جمله تا نشانه‌های «. ! ؟ ؛» و پایان سطر حساب می‌شود.
 */
import type { TextlintRuleModule } from "@textlint/types";
import { SOURCE } from "../shared";

type Options = { maxWords?: number; maxKe?: number };
const fa = (n: number) => n.toLocaleString("fa-IR");

const rule: TextlintRuleModule<Options> = (context, options = {}) => {
    const { Syntax, RuleError, report, getSource, locator } = context;
    const maxWords = options.maxWords ?? 40;
    const maxKe = options.maxKe ?? 2;
    const source = SOURCE("ساختار جمله");
    return {
        [Syntax.Str](node) {
            const text = getSource(node);
            const re = /[^.!?؟؛\n]+/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(text)) !== null) {
                const sentence = m[0];
                const words = sentence.match(/[^\s،,:«»()]+/g) ?? [];
                const lead = sentence.match(/^\s*/)![0].length;
                const firstWord = sentence.slice(lead).match(/^\S+/)?.[0] ?? "";
                if (words.length > maxWords) {
                    const start = m.index + lead;
                    report(node, new RuleError(
                        `این جمله ${fa(words.length)} کلمه دارد؛ اگر به دو یا چند جمله شکسته شود، خواندنش آسان‌تر است (${source})`,
                        { padding: locator.range([start, start + firstWord.length]) }
                    ));
                }
                const kes = [...sentence.matchAll(/(?<![^\s،,«(])که(?![^\s،,.»)])/g)];
                if (kes.length > maxKe) {
                    const k = kes[maxKe];
                    const start = m.index + k.index!;
                    report(node, new RuleError(
                        `${fa(kes.length)} «که» در یک جمله آمده است؛ جمله‌های وابستۀ تودرتو را می‌شود جدا کرد (${source})`,
                        { padding: locator.range([start, start + 2]) }
                    ));
                }
            }
        }
    };
};
export default rule;
