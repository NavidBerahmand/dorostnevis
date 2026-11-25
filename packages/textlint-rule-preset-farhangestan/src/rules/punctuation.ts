/*
 * نشانه‌گذاری و حروف‌چینی
 *
 * دستور خط دربارهٔ نشانه‌گذاری قاعده‌ای ندارد. این قاعده قراردادهای رایج
 * نگارش فارسی را اجرا می‌کند (همان‌هایی که ویراستار و ویراستیار هم اجرا
 * می‌کنند)، و فقط در متن فارسی: کنار حروف لاتین، عدد انگلیسی، نشانی
 * اینترنتی و ایمیل دست نمی‌زند.
 *
 * - «,» «;» «?» ← «،» «؛» «؟»
 * - گیومهٔ انگلیسی ("…"، '…'، ''…''، “…”) ← «…»
 * - «...» ← «…»
 * - فاصله پیش از نشانه‌ها حذف، پس از آن‌ها یک فاصله؛ فاصلهٔ داخل پرانتز و گیومه حذف
 * - «؟؟؟» ← «؟»، «!!!» ← «!»، «!؟»/«?!» ← «؟!»
 * - چند فاصلهٔ پشت سر هم ← یک فاصله
 * - «--» و «---» ← «–» و «—»؛ کشیده‌ای که به‌جای خط فاصله آمده («ـ که») ← «–»
 * - رقم انگلیسی در متن فارسی ← رقم فارسی («12%» ← «۱۲٪»، «4.7» ← «۴٫۷»، «12,543» ← «۱۲٬۵۴۳»)
 *
 * هر بخش را می‌شود خاموش کرد: { "digits": false }، { "quotes": false }…
 */
import { createPatternRule, PatternResult } from "../util/pattern-rule";
import { toPersianDigits } from "../util/persian";

export interface Options {
    marks?: boolean;
    dashes?: boolean;
    quotes?: boolean;
    ellipsis?: boolean;
    spacing?: boolean;
    repeated?: boolean;
    digits?: boolean;
}

const SOURCE = "قراردادهای رایج نشانه‌گذاری فارسی (در دستور خط نیامده)";
const FA = "\\u0600-\\u06FF";
const FA_LETTER = "[\\u0621-\\u063A\\u0641-\\u064A\\u0671-\\u06D3\\u06CC\\u06A9\\u06AF\\u067E\\u0686\\u0698]";

/** Inside a URL, an e-mail address or a Latin word: leave alone. */
function inForeignToken(text: string, index: number): boolean {
    let a = index;
    while (a > 0 && !/\s/.test(text[a - 1])) a--;
    let b = index;
    while (b < text.length && !/\s/.test(text[b])) b++;
    const token = text.slice(a, b);
    if (!/[A-Za-z0-9\u0600-\u06FF]/.test(token)) return false; // a mark on its own
    return /:\/\/|www\.|@|\.(com|org|net|ir|io)\b/i.test(token) || /^[A-Za-z0-9_.,;:?!'"()\-/%]+$/.test(token) && !/[0-9]/.test(token);
}

/** The text around index (same line) has Persian letters. */
function persianContext(text: string, index: number): boolean {
    const lineStart = text.lastIndexOf("\n", index) + 1;
    const lineEnd = text.indexOf("\n", index);
    const line = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
    return new RegExp(FA_LETTER).test(line);
}

/** «بی ـ، می ـ»: a hyphen after these marks an affix, not a dash. */
const AFFIXES = new Set(["ب", "ﺑ", "بی", "می", "نمی", "همی", "هم", "نا", "ن", "م", "به"]);

/** URLs, e-mail addresses, file names, HTML tags and entities: never touched. */
const PROTECTED = /(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w-]+\.[\w.-]+|<[^>\n]*>|&[a-z]+;|&#\d+;/gi;
let protText = "";
let protSpans: Array<[number, number]> = [];
function isProtected(text: string, start: number, end: number): boolean {
    if (text !== protText) {
        protText = text;
        protSpans = [...text.matchAll(PROTECTED)].map((m) => [m.index!, m.index! + m[0].length] as [number, number]);
    }
    return protSpans.some(([a, b]) => start < b && end > a);
}

export default createPatternRule<Options>((options) => {
    const on = (k: keyof Options) => options[k] !== false;
    const checks: Array<{ pattern: RegExp; check: (m: RegExpExecArray) => PatternResult | null }> = [];

    if (on("marks")) {
        checks.push({
            // «,» «;» «?» after a Persian letter or closing mark, not between digits («1,000»)
            // (spaces before it go too: «سلام ,» → «سلام،»)
            pattern: new RegExp(`(?<=[${FA}»)\\]}]) *([,;?])(?![0-9۰-۹])`, "g"),
            check: (m) => {
                if (inForeignToken(m.input, m.index + m[0].length - 1)) return null;
                const fa = ({ ",": "،", ";": "؛", "?": "؟" } as Record<string, string>)[m[1]];
                return { message: `در متن فارسی «${fa}» به کار می‌رود، نه «${m[1]}»`, replacement: fa, source: SOURCE };
            }
        });
    }

    if (on("quotes")) {
        checks.push({
            // a pair of English quotes around Persian text, on one line
            pattern: new RegExp(`(''|"|“|'|\`\`|\`)([^"“”'\`\\n]*${FA_LETTER}[^"“”'\`\\n]*?)(''|"|”|'|\`\`|\`)`, "g"),
            check: (m) => {
                const [, open, inner, close] = m;
                // same kind of quote on both sides (“…” is a pair)
                if (!(open === close || (open === "“" && close === "”"))) return null;
                if (m.input[m.index - 1] === "=") return null; // an HTML attribute: title="…"
                // part of a longer run of quotes (wiki markup), or too long to be a quotation
                if (/['"`]/.test(m.input[m.index - 1] ?? "") || /['"`]/.test(m.input[m.index + m[0].length] ?? "")) return null;
                if (inner.length > 200) return null;
                // an opening quote starts a word and a closing one ends it: «"که اساساً» opens, not closes
                const before = m.input[m.index - 1] ?? " ";
                const after = m.input[m.index + m[0].length] ?? " ";
                if (!/[\s(\[{:،؛]/.test(before) || /^\s/.test(inner) && open !== "''" || /\s$/.test(inner) && open !== "''") return null;
                if (!/[\s)\]}.،؛:!؟?,;]/.test(after)) return null;
                // a single «'» is also an apostrophe: only short, all-Persian quotations
                if (open === "'" && (inner.length > 40 || /[A-Za-z]/.test(inner))) return null;
                if (inForeignToken(m.input, m.index) && !/[؀-ۿ]/.test(inner)) return null;
                return { message: "در متن فارسی گیومهٔ فارسی «» به کار می‌رود", replacement: `«${inner.trim()}»`, source: SOURCE };
            }
        });
    }

    if (on("ellipsis")) {
        checks.push({
            pattern: / *\.{3,}|(?<=\S) +…/g,
            check: (m) => {
                if (!persianContext(m.input, m.index) || inForeignToken(m.input, m.index + m[0].length - 1)) return null;
                return { message: "سه‌نقطه یک نویسه است («…») و بی‌فاصله به کلمهٔ پیش از خود می‌چسبد", replacement: "…", source: SOURCE };
            }
        });
    }

    if (on("repeated")) {
        checks.push({
            pattern: /[!?؟]{2,}/g,
            check: (m) => {
                if (!persianContext(m.input, m.index)) return null;
                const q = /[?؟]/.test(m[0]);
                const e = m[0].includes("!");
                const fixed = q && e ? "؟!" : q ? "؟" : "!";
                if (fixed === m[0]) return null;
                return { message: `نشانه‌های تکراری: «${fixed}» کافی است`, replacement: fixed, source: SOURCE };
            }
        });
    }

    if (on("spacing")) {
        checks.push(
            {
                // space before a mark: «سلام ،» → «سلام،»
                // (closing brackets are the next check's; «...» is the ellipsis check's)
                pattern: new RegExp(`(?<=[${FA}»)\\]…!؟]) +(?=(?:[،؛:!؟…]|\\.(?!\\.))(?![0-9۰-۹]))`, "g"),
                check: (m) => {
                    if (inForeignToken(m.input, m.index - 1)) return null;
                    return { message: "پیش از نشانه فاصله نمی‌آید", replacement: "", source: SOURCE };
                }
            },
            {
                // no space after a mark before a Persian letter: «سلام،جهان» → «سلام، جهان»
                pattern: new RegExp(`(?<=${FA_LETTER})([،؛!؟])(?=${FA_LETTER}|«)`, "g"),
                check: (m) => ({ message: "پس از نشانه یک فاصله می‌آید", replacement: m[1] + " ", source: SOURCE })
            },
            {
                // spaces inside brackets and quotes: «( متن )» → «(متن)»
                pattern: new RegExp(`([(\\[{«]) +(?=\\S)|(?<=\\S) +([)\\]}»])`, "g"),
                check: (m) => {
                    if (!persianContext(m.input, m.index)) return null;
                    return {
                        message: "داخل پرانتز و گیومه، کنار نشانه فاصله نمی‌آید",
                        replacement: m[1] ?? m[2],
                        source: SOURCE
                    };
                }
            },
            {
                // spaces at the end of a line (not at the end of a text node: in Markdown a
                // node ends before a link or emphasis, and that space is real)
                pattern: /(?<=\S)[ \t]+(?=\n)/g,
                check: (m) => (persianContext(m.input, m.index) ? { message: "فاصلهٔ اضافه در پایان سطر", replacement: "", source: SOURCE } : null)
            },
            {
                // several spaces between words
                pattern: /(?<=\S) {2,}(?=\S)/g,
                check: (m) => {
                    if (!persianContext(m.input, m.index)) return null;
                    // a table or aligned columns: the spaces are layout
                    const lineStart = m.input.lastIndexOf("\n", m.index) + 1;
                    const lineEnd = m.input.indexOf("\n", m.index);
                    const line = m.input.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
                    if (line.includes("|") || line.includes("\t") || / {4,}/.test(line)) return null;
                    return { message: "بین دو کلمه یک فاصله کافی است", replacement: " ", source: SOURCE };
                }
            }
        );
    }

    if (on("digits")) {
        checks.push({
            // separators between Persian digits: «۱۲,۵۴۳» → «۱۲٬۵۴۳», «۴.۷» → «۴٫۷»
            pattern: /(?<=[۰-۹])[,.](?=[۰-۹])/g,
            check: (m) => {
                const fixed = m[0] === "," ? "٬" : "٫";
                return { message: `جداکنندهٔ ${m[0] === "," ? "هزارگان" : "اعشار"} در عدد فارسی «${fixed}» است`, replacement: fixed, source: SOURCE };
            }
        });
    }

    if (on("dashes")) {
        checks.push(
            {
                pattern: /(?<=\s|^)-{2,3}(?=\s|$)/gm,
                check: (m) => {
                    if (!persianContext(m.input, m.index)) return null;
                    const fixed = m[0].length === 3 ? "—" : "–";
                    return { message: `خط فاصله یک نویسه است: «${fixed}»`, replacement: fixed, source: SOURCE };
                }
            },
            {
                // a kashida used as a dash: «ـ که …» → «– که …»
                pattern: /(?<=\s|^)ـ(?=\s|$)/gm,
                check: (m) => {
                    if (!persianContext(m.input, m.index)) return null;
                    // «بی ـ، می ـ»: a hyphen marking an affix, not a dash
                    const prev = m.input.slice(0, m.index).trimEnd().split(/\s/).pop() ?? "";
                    if (AFFIXES.has(prev)) return null;
                    return { message: "کشیده (ـ) خط فاصله نیست؛ «–» به کار می‌رود", replacement: "–", source: SOURCE };
                }
            }
        );
    }

    if (on("digits")) {
        checks.push({
            pattern: /(?<=[۰-۹])%/g,
            check: () => ({ message: "نشانهٔ درصد فارسی «٪» است", replacement: "٪", source: SOURCE })
        });
        checks.push({
            // an English number standing on its own in Persian text (not part of a Latin token)
            pattern: /(?<![A-Za-z0-9_\-/.:#%$={^])[0-9]+(?:[.,][0-9]+)*%?(?![A-Za-z0-9_\-/$}])/g,
            check: (m) => {
                if (!persianContext(m.input, m.index) || inForeignToken(m.input, m.index)) return null;
                // the word before or after is Latin: «IBM 96», «Windows 10» stay
                const before = m.input.slice(Math.max(0, m.index - 20), m.index);
                const after = m.input.slice(m.index + m[0].length, m.index + m[0].length + 20);
                if (/[A-Za-z][A-Za-z\-]*\s*$/.test(before) || /^\s*[A-Za-z]/.test(after)) return null;
                let s = m[0];
                // «4.7» → «۴٫۷», «12,543» → «۱۲٬۵۴۳», «%» → «٪»
                s = s.replace(/(\d),(?=\d{3}\b)/g, "$1٬").replace(/(\d)\.(?=\d)/g, "$1٫").replace(/%$/, "٪");
                const fixed = toPersianDigits(s);
                return { message: `در متن فارسی رقم فارسی به کار می‌رود: «${fixed}»`, replacement: fixed, source: SOURCE };
            }
        });
    }

    // nothing inside a URL, an e-mail address or an HTML tag
    const guarded = checks.map(({ pattern, check }) => ({
        pattern,
        check: (m: RegExpExecArray) => (isProtected(m.input, m.index, m.index + m[0].length) ? null : check(m))
    }));
    return { source: SOURCE, checks: guarded };
});
