/*
 * نشانه‌گذاری و حروف‌چینی
 *
 * دستور خط دربارۀ نشانه‌گذاری قاعده‌ای ندارد. این قاعده قراردادهای رایج
 * نگارش فارسی را اجرا می‌کند (همان‌هایی که ویراستار و ویراستیار هم اجرا
 * می‌کنند)، و فقط در متن فارسی: کنار حروف لاتین، عدد انگلیسی، نشانی
 * اینترنتی و ایمیل دست نمی‌زند.
 *
 * - «,» «;» «?» ← «،» «؛» «؟»
 * - گیومۀ انگلیسی ("…"، '…'، ''…''، “…”) ← «…»
 * - «...» ← «…»
 * - فاصله پیش از نشانه‌ها حذف، پس از آن‌ها یک فاصله؛ فاصلۀ داخل پرانتز و گیومه حذف
 * - «؟؟؟» ← «؟»، «!!!» ← «!»، «!؟»/«?!» ← «؟!»
 * - چند فاصلۀ پشت سر هم ← یک فاصله
 * - «((…))» و «<<…>>» ← «…»
 * - دو نشانۀ پشت سر هم («هستند،:»، «.،»، «؛.»، «؟،») ← یکی، قوی‌تر: «؟ !» بر «:»، «:» بر «.»،
 *   «.» بر «؛»، «؛» بر «،» («؟!» می‌ماند)
 * - «؛» در پایان بند ← «.» یا، اگر فهرست یا توضیحی در پی است، «:» (پیشنهاد)
 * - سه‌نقطۀ چسبیده به کلمۀ بعد («آمد…دیوارها») ← «آمد… دیوارها»
 * - خط تیره میان دو واژه «—» با یک فاصله از دو طرف (سمیعی، ص ۲۳۹): «ساختمان—مثل»، «فرقه - حشاشیون»،
 *   «او ـ که» ← «… — …»؛ آغاز گفت‌وگو «— »
 * - گیومۀ “…” درون «…» دست نمی‌خورد (الگوی «“ ”» برای نقل‌قول تودرتو)
 * - گیومه و کمانک بی‌جفت: پیشنهاد، روی خود نشانه؛ گیومۀ باز در پایان جمله بسته می‌شود
 * - پرانتز درون پرانتز: فقط پیشنهاد، توضیحِ درون کمانک در قلاب «[ ]» می‌آید
 * - رقم انگلیسی در متن فارسی ← رقم فارسی («12%» ← «۱۲٪»، «4.7» ← «۴٫۷»، «12,543» ← «۱۲٬۵۴۳»)
 *
 * هر بخش را می‌شود خاموش کرد: { "digits": false }، { "quotes": false }…
 */
import { createPatternRule, PatternResult } from "../util/pattern-rule";
import { toPersianDigits } from "../util/persian";
import { joinsNumber } from "../util/number-compounds";
import { nbspPlaces, isUnit, CITATIONS, LETTERS } from "../util/nbsp";
import { isKnown } from "../util/words";
import commonNouns from "../dict/hazm-common-nouns.json";

const COMMON_NOUNS_P = new Set<string>(commonNouns.words);

export interface Options {
    marks?: boolean;
    dashes?: boolean;
    quotes?: boolean;
    ellipsis?: boolean;
    spacing?: boolean;
    repeated?: boolean;
    digits?: boolean;
    /** Report quotes and brackets that are opened and not closed (or the reverse). */
    pairs?: boolean;
}

const SOURCE = "قراردادهای رایج نشانه‌گذاری فارسی (در دستور خط نیامده)";

/** Inside an open «…» on the same line: “…” there is a nested quotation. */
function insideGuillemets(text: string, index: number): boolean {
    const lineStart = text.lastIndexOf("\n", index) + 1;
    const before = text.slice(lineStart, index);
    return (before.match(/«/g) ?? []).length > (before.match(/»/g) ?? []).length;
}

/** Letters of drawings and decorations around a bracket: «*(¸.•*¨»، «♥)». */
const ORNAMENT = /[¸•*¨´`~^°♥❤☆★✿❀♡]/;
/** Unmatched «» () [] in a text, by position (memoized per text). */
let pairText = "";
let unmatched = new Set<number>();
const OPEN: Record<string, string> = { "«": "»", "(": ")", "[": "]" };
const CLOSE: Record<string, string> = { "»": "«", ")": "(", "]": "[" };
function unmatchedAt(text: string, index: number): boolean {
    if (text !== pairText) {
        pairText = text;
        unmatched = new Set();
        const stack: number[] = [];
        const smiley = new Set<number>();
        for (const [a, b] of smileySpans(text)) for (let k = a; k < b; k++) smiley.add(k);
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (smiley.has(i)) continue;
            // «1) … 2) …» anywhere in a line (a list run on: «پدر و مادر2) داشتن»)
            if (c === ")" && /(?:^|[^0-9۰-۹])[0-9۰-۹]{1,2}$/.test(text.slice(Math.max(0, i - 3), i)) && !/\([^()]*$/.test(text.slice(text.lastIndexOf("\n", i - 1) + 1, i))) continue;
            if (OPEN[c]) stack.push(i);
            else if (CLOSE[c]) {
                // «۱)»، «الف)»: a list marker; «:)»: a smiley
                // (1.6.0: also after a sentence's end, with a space: «بخواب! 8 ) خیلی سال بعد»)
                if (c === ")" && (/(^|\n)\s*\S{1,3}$/.test(text.slice(0, i)) || /[.!؟?]\s+[0-9۰-۹]{1,2} ?$/.test(text.slice(0, i)) || /[:;]$/.test(text.slice(0, i)))) continue;
                const top = stack[stack.length - 1];
                if (top !== undefined && text[top] === CLOSE[c]) stack.pop();
                else unmatched.add(i);
            }
        }
        for (const i of stack) unmatched.add(i);
        // a run of one bracket left without pairs («((((((»، «پاپه))!!!») is emphasis or a smiley, and a
        // bracket in ornaments («*(¸.•*¨») is drawing: not reported (1.6.1)
        for (const i of [...unmatched]) {
            const c = text[i];
            if (text[i - 1] === c || text[i + 1] === c || ORNAMENT.test(text[i - 1] ?? "") || ORNAMENT.test(text[i + 1] ?? "")) unmatched.delete(i);
        }
    }
    return unmatched.has(index);
}
/*
 * Guillemets typed the wrong way round (1.5.2: the keyboard mirrors them, «»سلام«» for «سلام»), and
 * a space on the wrong side of one («فلک »حتی» for «فلک» حتی»). Per line:
 * - balanced as typed: a space inside a quote moves outside (no space inside, one outside, none
 *   before a mark: «فلک»،»);
 * - balanced only with every «» swapped, and the spaces agree (each one opens a word and the other
 *   closes one): typed backwards, swapped (red, with the typing fixes);
 * - neither: a quote with a space on its inner side may be either; one yellow card, both readings.
 */
type QuoteLine = { kind: "ok" | "mirrored" | "unclear"; quotes: number[] };
let quoteText = "";
let quoteLines = new Map<number, QuoteLine>();
const balanced = (cs: string[]) => {
    let d = 0;
    for (const c of cs) if ((d += c === "«" ? 1 : -1) < 0) return false;
    return d === 0;
};
function quoteLine(text: string, index: number): QuoteLine {
    if (text !== quoteText) {
        quoteText = text;
        quoteLines = new Map();
    }
    const start = text.lastIndexOf("\n", index - 1) + 1;
    let q = quoteLines.get(start);
    if (q) return q;
    let end = text.indexOf("\n", start);
    if (end < 0) end = text.length;
    const quotes: number[] = [];
    for (let i = start; i < end; i++) if (text[i] === "«" || text[i] === "»") quotes.push(i);
    const cs = quotes.map((i) => text[i]);
    const swapped = cs.map((c) => (c === "«" ? "»" : "«"));
    // the spaces say «opens» (space or start before, a letter after) or «closes» (the reverse)
    const opens = (i: number) => (i === start || /[\s(\[«—–-]/.test(text[i - 1])) && i + 1 < end && !/\s/.test(text[i + 1]);
    const closes = (i: number) => i > start && !/\s/.test(text[i - 1]) && (i + 1 >= end || /[\s.،؛:!؟…)\]»]/.test(text[i + 1]));
    let kind: QuoteLine["kind"] = "unclear";
    if (balanced(cs)) kind = "ok";
    else if (cs.length >= 2 && balanced(swapped) && quotes.every((i, k) => (swapped[k] === "«" ? !closes(i) : !opens(i)))) kind = "mirrored";
    q = { kind, quotes };
    quoteLines.set(start, q);
    return q;
}
/** The fix for the quote at `i` as `glyph` (opening «, closing »): from the spaces around it to its spacing. */
function quoteFix(text: string, i: number, glyph: string): { from: number; to: number; text: string } {
    let a = i;
    while (a > 0 && text[a - 1] === " ") a--;
    let b = i + 1;
    while (b < text.length && text[b] === " ") b++;
    const before = a > 0 ? text[a - 1] : "\n";
    const after = b < text.length ? text[b] : "\n";
    if (glyph === "«") {
        // one space before it (not at a line's start or after another opening mark), none after
        const sp = /[\n(\[«\u200c]/.test(before) || a === 0 ? "" : " ";
        return { from: a, to: b, text: sp + "«" };
    }
    // none before it, one after (not before a mark or at a line's end)
    const sp = /[\n.،؛:!؟…)\]»]/.test(after) ? "" : " ";
    return { from: a, to: b, text: "»" + sp };
}

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

/**
 * Smileys (1.6.0): «:)»، «:))))»، «:(»، «;)»، «=)»، «:-)»، «:D»، «(:» are neither brackets nor marks:
 * no pair is missing, no space moves, «;» stays. «:(» before a word may open a bracket
 * («پاسخ:(الف)»): only a run that stops at a space, a mark or the end.
 */
const SMILEY = /[:;=][-']?(?:[()]+|[DPp](?![A-Za-z]))|(?<=^|\s)[()]+[:;](?=\s|$)/g;
let smileyText = "";
let smileyList: Array<[number, number]> = [];
function smileySpans(text: string): Array<[number, number]> {
    if (text !== smileyText) {
        smileyText = text;
        smileyList = [];
        for (const m of text.matchAll(SMILEY)) {
            const end = m.index! + m[0].length;
            if (/^[:;=][-']?\(/.test(m[0]) && /[^\s.!؟?،)]/.test(text[end] ?? " ")) continue;
            smileyList.push([m.index!, end]);
        }
    }
    return smileyList;
}

/** URLs, e-mail addresses, file names, HTML tags and entities: never touched. */
const PROTECTED = /(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w-]+\.[\w.-]+|<[^>\n]*>|&[a-z]+;|&#\d+;/gi;
let protText = "";
let protSpans: Array<[number, number]> = [];
function isProtected(text: string, start: number, end: number): boolean {
    if (text !== protText) {
        protText = text;
        protSpans = [...text.matchAll(PROTECTED)].map((m) => [m.index!, m.index! + m[0].length] as [number, number]);
    }
    return protSpans.some(([a, b]) => start < b && end > a) || smileySpans(text).some(([a, b]) => start < b && end >= a);
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
                // a quotation inside «…» keeps its own marks: «او گفت “نه”»
                if (insideGuillemets(m.input, m.index)) return null;
                return { message: "در متن فارسی گیومۀ فارسی «» به کار می‌رود", replacement: `«${inner.trim()}»`, source: SOURCE };
            }
        });
    }

    if (on("quotes")) {
        checks.push({
            // «((…))»، «<<…>>» used as quotation marks
            pattern: new RegExp(`\\(\\(([^()\\n]*${FA_LETTER}[^()\\n]*)\\)\\)|<<([^<>\\n]*${FA_LETTER}[^<>\\n]*)>>`, "g"),
            check: (m) => ({
                message: "«(( ))» و «<< >>» گیومه نیستند؛ گیومۀ فارسی «» به کار می‌رود",
                replacement: `«${(m[1] ?? m[2]).trim()}»`,
                source: SOURCE
            })
        });
    }

    if (on("pairs")) {
        checks.push({
            // reported on the mark itself; the suggestion closes (or opens) it in its sentence
            pattern: /[«»()\[\]]/g,
            check: (m) => {
                if (!persianContext(m.input, m.index) || !unmatchedAt(m.input, m.index)) return null;
                const c = m[0];
                // a guillemet typed backwards, or one the guillemet check asks about (1.5.2): that check's
                if (c === "«" || c === "»") {
                    const line = quoteLine(m.input, m.index);
                    if (line.kind === "mirrored") return null;
                    // «» :»»تسلیم…»»: two or more guillemets without a pair on a line; no telling which go (1.6.1)
                    if (line.quotes.filter((q) => unmatchedAt(m.input, q)).length >= 2) return null;
                    const t = m.input;
                    const i = m.index;
                    const inner = c === "«" ? t[i + 1] === " " : t[i - 1] === " ";
                    const outer = c === "«" ? t[i - 1] : t[i + 1];
                    if (line.kind === "unclear" && inner && outer && !/\s/.test(outer)) return null;
                }
                const open = OPEN[c] !== undefined;
                const message = open ? `«${c}» باز شده و بسته نشده است` : `«${c}» بسته شده ولی باز نشده است`;
                const text = m.input;
                if (open) {
                    // close at the end of the line, before a final «. ! ؟»; a quotation that is a
                    // whole sentence («او گفت: «می‌آیم.»») takes the final mark inside
                    let e = text.indexOf("\n", m.index);
                    if (e < 0) e = text.length;
                    while (e > m.index + 1 && /\s/.test(text[e - 1])) e--;
                    const before = text.slice(text.lastIndexOf("\n", m.index - 1) + 1, m.index).trimEnd();
                    const wholeSentence = c === "«" && (before === "" || /[:.!؟]$/.test(before));
                    if (!wholeSentence) while (e > m.index + 1 && /[.!؟…]/.test(text[e - 1])) e--;
                    if (e <= m.index + 1) return { message, fix: false, source: SOURCE };
                    const close = OPEN[c];
                    return { message, replacement: close, fixStart: e - m.index, fixEnd: e - m.index, fix: false, source: SOURCE };
                }
                // a closing mark without its opening: open it where its sentence starts, or drop it
                const lineStart = text.lastIndexOf("\n", m.index - 1) + 1;
                const head = text.slice(lineStart, m.index);
                const cut = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("؟ "), head.lastIndexOf(": "));
                let s0 = lineStart + (cut >= 0 ? cut + 2 : 0);
                while (s0 < m.index && /\s/.test(text[s0])) s0++;
                const opening = CLOSE[c];
                if (s0 >= m.index) return { message, replacement: "", fix: false, source: SOURCE };
                return { message, replacement: opening, fixStart: s0 - m.index, fixEnd: s0 - m.index, fix: false, source: SOURCE };
            }
        });
        checks.push({
            // «(… (…) …)»: an explanation inside brackets goes in square brackets
            pattern: new RegExp(`\\(([^()\\n]*)\\(([^()\\n]*${FA_LETTER}[^()\\n]*)\\)([^()\\n]*)\\)`, "g"),
            check: (m) => {
                if (!persianContext(m.input, m.index) || !new RegExp(FA_LETTER).test(m[1] + m[3])) return null;
                const start = 1 + m[1].length; // relative to the match
                return {
                    message: `پرانتز درون پرانتز خوانا نیست؛ توضیحِ درون کمانک در قلاب می‌آید: «[${m[2]}]»`,
                    replacement: `[${m[2]}]`,
                    fix: false,
                    start,
                    end: start + m[2].length + 2,
                    source: SOURCE
                };
            }
        });
    }

    if (on("ellipsis")) {
        checks.push({
            // «. . .»: three dots with spaces between them are the ellipsis too (1.6.1: «کنیم؟ . . .» went
            // round in circles between «space before a mark» and «two marks in a row»)
            pattern: / *\.(?: \.){2,}(?! *\.)/g,
            check: (m) => {
                if (!persianContext(m.input, m.index) || inForeignToken(m.input, m.index + m[0].length - 1)) return null;
                const message = "سه‌نقطه یک نویسه است («…») و بی‌فاصله به کلمۀ پیش از خود می‌چسبد";
                const glued = new RegExp(`^${FA_LETTER}`).test(m.input.slice(m.index + m[0].length));
                return { message, replacement: glued ? "… " : "…", source: SOURCE };
            }
        });
        checks.push({
            pattern: / *\.{3,}|(?<=\S) +…/g,
            check: (m) => {
                if (!persianContext(m.input, m.index) || inForeignToken(m.input, m.index + m[0].length - 1)) return null;
                const message = "سه‌نقطه یک نویسه است («…») و بی‌فاصله به کلمۀ پیش از خود می‌چسبد";
                // after a dash («— ...آره»، «او — ... که»), not after a word: the dash keeps its space
                // (the dialogue dash: one space after it), only the dots become «…» (1.5.1)
                const lineBefore = m.input.slice(m.input.lastIndexOf("\n", m.index - 1) + 1, m.index);
                if (/(?:^|\s)[—–ـ-]+\s*$/.test(lineBefore + m[0].match(/^ */)![0])) {
                    if (!m[0].includes(".")) return null;
                    const lead = m[0].match(/^ */)![0].length;
                    return { message, replacement: "…", start: lead, source: SOURCE };
                }
                // «آمد...دیوارها»: and a space after it, before the next word
                const glued = new RegExp(`^${FA_LETTER}`).test(m.input.slice(m.index + m[0].length)) && m.index > 0 && /\S/.test(m.input[m.index - 1]);
                return { message, replacement: glued ? "… " : "…", source: SOURCE };
            }
        });
        checks.push({
            // «می‌گیری.. دنیا»: two dots are a full stop typed twice, or a short ellipsis (1.5.2). Red
            // with «.», and «…» as a second button (not in URLs, numbers «1..5» or Latin)
            pattern: new RegExp(`(?<=${FA_LETTER}|[»)]) *\\.\\.(?!\\.)(?<!\\.\\.\\.)`, "g"),
            check: (m) => {
                if (!persianContext(m.input, m.index) || inForeignToken(m.input, m.index + m[0].length - 1)) return null;
                const after = m.input.slice(m.index + m[0].length);
                const sp = new RegExp(`^${FA_LETTER}|^«`).test(after) ? " " : "";
                // «..!»، «..؟»: the mark after it ends the sentence; the dots go, or become «…»
                if (/^ *[!؟?]/.test(after)) {
                    return { message: "دو نقطه پشت سر هم نشانه نیست: «!/؟» کافی است، یا سه‌نقطه «…»", replacement: "", alternatives: ["…"], source: SOURCE };
                }
                // «یک..دو..سه»: between two words with no space, a pause («…») as likely as a full stop: the
                // writer's choice, the ellipsis first (1.6.1; red before)
                if (sp && m[0][0] === "." && /\S/.test(m.input[m.index - 1] ?? " ")) {
                    return { message: "دو نقطه پشت سر هم نشانه نیست: سه‌نقطه «…» یا نقطه «.»", replacement: "…" + sp, alternatives: ["." + sp], fix: false, source: SOURCE };
                }
                return {
                    message: "دو نقطه پشت سر هم نشانه نیست: نقطه «.» یا سه‌نقطه «…»",
                    replacement: "." + sp,
                    alternatives: ["…" + sp],
                    source: SOURCE
                };
            }
        });
        checks.push({
            // «آمد…دیوارها»: the ellipsis ends the word before it; a space before the next one
            pattern: new RegExp(`(?<=${FA_LETTER}|[»)])…(?=${FA_LETTER}|«)`, "g"),
            check: (m) => (persianContext(m.input, m.index) ? { message: "پس از سه‌نقطه یک فاصله می‌آید", replacement: "… ", source: SOURCE } : null)
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
                // «!؟»، «؟!!»، «?!»: a question with surprise is «؟!» (1.6.0: made with the typing fixes)
                if (fixed === "؟!") return { message: "پرسش همراه با تعجب: «؟!»", replacement: fixed, source: SOURCE };
                return { message: `نشانه‌های تکراری: «${fixed}» کافی است`, replacement: fixed, source: SOURCE };
            }
        });
    }

    if (on("repeated")) {
        const STRENGTH: Record<string, number> = { "؟": 5, "!": 5, ":": 4, ".": 3, "؛": 2, "،": 1 };
        checks.push({
            // two different marks in a row: «هستند،:» → «هستند:»، «.،» → «.»، «؛.» → «.»، «؟،» → «؟»
            // (not «؟!», not «...»/«…», not the dot of an abbreviation «ق.م.»، not between digits)
            pattern: /(?<![.])([،؛:.؟!])( *)([،؛:.؟!])(?![.])/g,
            check: (m) => {
                const [, a, , b] = m;
                if (!persianContext(m.input, m.index)) return null;
                if (a === b && a !== "،" && a !== "؛" && a !== ":") return null; // «!!»، «؟؟»: the next check
                if (/[؟!]/.test(a) && /[؟!]/.test(b)) return null; // «؟!»
                const prev = m.input.slice(0, m.index);
                if (a === "." && /(?:^|[\s.])\S$/.test(prev)) return null; // «ق.م.،»
                if (/[0-9۰-۹]$/.test(prev) && /^[0-9۰-۹]/.test(m.input.slice(m.index + m[0].length))) return null;
                if (inForeignToken(m.input, m.index)) return null;
                const keep = STRENGTH[b] >= STRENGTH[a] ? b : a;
                const dropsComma = (keep === a ? b : a) === "،";
                // «نه؟ .راستش» → «نه؟ راستش»: the space the next word needs after the mark comes with it (1.5.1)
                const space = new RegExp(`^${FA_LETTER}`).test(m.input.slice(m.index + m[0].length)) ? " " : "";
                return {
                    message: dropsComma ? `ویرگول پیش یا پس از نشانۀ دیگر نمی‌آید: «${keep}» کافی است` : `دو نشانه پشت سر هم: «${keep}» کافی است`,
                    replacement: keep + space,
                    source: SOURCE
                };
            }
        });
        checks.push({
            // «…متعجبم؛» at the end of a paragraph: a semicolon does not end one
            pattern: /؛(?=[ \t]*(?:\n|$))/g,
            check: (m) =>
                persianContext(m.input, m.index)
                    ? {
                          message: "نقطه‌ویرگول بند را تمام نمی‌کند: «.»؛ اگر فهرست یا توضیحی در پی است، «:»",
                          replacement: ".",
                          alternatives: [":"],
                          fix: false,
                          source: SOURCE
                      }
                    : null
        });
    }

    if (on("spacing")) {
        checks.push(
            {
                // space before a mark: «سلام ،» → «سلام،»
                // (closing brackets are the next check's; «...» is the ellipsis check's)
                // (not before a dot that starts a Latin token: «دامنۀ .gt»، «فایل .pdf»)
                pattern: new RegExp(`(?<=[${FA}»)\\]…!؟]) +(?=(?:[،؛:!؟…]|\\.(?![.A-Za-z]| \\.))(?![0-9۰-۹]))`, "g"),
                check: (m) => {
                    if (inForeignToken(m.input, m.index - 1)) return null;
                    // «:)»، «;(»: a smiley, not a colon
                    if (/^[:;][()DP]/.test(m.input.slice(m.index + m[0].length, m.index + m[0].length + 2))) return null;
                    return { message: "پیش از نشانه فاصله نمی‌آید", replacement: "", source: SOURCE };
                }
            },
            {
                // no space after a mark before a Persian letter: «سلام،جهان» → «سلام، جهان»، «افتاد:خانه» → «افتاد: خانه»
                // (letters on both sides: never «۱۲:۳۰»، «http:»، «::»)
                pattern: new RegExp(`(?<=${FA_LETTER})([،؛!؟:])(?=${FA_LETTER}|«)`, "g"),
                check: (m) => ({ message: "پس از نشانه یک فاصله می‌آید", replacement: m[1] + " ", source: SOURCE })
            },
            {
                // no space after a period between two words: «است.این» → «است. این»
                // (abbreviations stay: «ه.ق»، «ق.م»، «ج.ا.ا»)
                pattern: new RegExp(`(?<=${FA_LETTER})\\.(?=${FA_LETTER})`, "g"),
                check: (m) => {
                    const before = m.input.slice(0, m.index).match(/[^\s.]*$/)![0];
                    const after = m.input.slice(m.index + 1).match(/^[^\s.]*/)![0];
                    // an earlier dot in the same token: an abbreviation («ج.ا.ا»)
                    const token = m.input.slice(0, m.index).split(/\s/).pop() ?? "";
                    if (before.length < 2 || after.length < 2 || token.includes(".")) return null;
                    return { message: "پس از نقطه یک فاصله می‌آید", replacement: ". ", source: SOURCE };
                }
            },
            {
                // spaces inside brackets: «( متن )» → «(متن)»; the space goes outside if a word is
                // glued there («فلک )حتی» → «فلک) حتی») — guillemets are the next check's
                pattern: new RegExp(`([(\\[{]) +(?=\\S)|(?<=\\S) +([)\\]}])`, "g"),
                check: (m) => {
                    if (!persianContext(m.input, m.index)) return null;
                    const t = m.input;
                    const end = m.index + m[0].length;
                    const replacement = m[1]
                        ? (m.index > 0 && /[\p{L}\p{N}]/u.test(t[m.index - 1]) ? " " : "") + m[1]
                        : m[2] + (end < t.length && /[\p{L}\p{N}«(]/u.test(t[end]) ? " " : "");
                    return { message: "داخل پرانتز و گیومه، کنار نشانه فاصله نمی‌آید", replacement, source: SOURCE };
                }
            },
            {
                // guillemets: a space on the inner side, or the pair typed backwards (quoteLine above)
                pattern: /[«»]/g,
                check: (m) => {
                    if (!persianContext(m.input, m.index)) return null;
                    const t = m.input;
                    const i = m.index;
                    const line = quoteLine(t, i);
                    const k = line.quotes.indexOf(i);
                    const at = (f: { from: number; to: number; text: string }) => ({ start: f.from - i, end: f.to - i, replacement: f.text });
                    const spaceInside = (g: string) => (g === "«" ? t[i + 1] === " " : t[i - 1] === " ");
                    if (line.kind === "mirrored") {
                        const g = t[i] === "«" ? "»" : "«";
                        const f = quoteFix(t, i, g);
                        return { message: "گیومه‌ها وارونه تایپ شده‌اند: گیومۀ باز «، گیومۀ بسته »", ...at(f), source: SOURCE };
                    }
                    if (line.kind === "ok") {
                        if (!spaceInside(t[i])) return null;
                        const f = quoteFix(t, i, t[i]);
                        if (t.slice(f.from, f.to) === f.text) return null;
                        return { message: "داخل پرانتز و گیومه، کنار نشانه فاصله نمی‌آید", ...at(f), source: SOURCE };
                    }
                    // unclear: a quote with a space inside and a word on its other side may be either
                    if (!spaceInside(t[i])) return null;
                    const other = t[i] === "«" ? "»" : "«";
                    const otherSide = t[i] === "«" ? t[i - 1] : t[i + 1];
                    const keep = quoteFix(t, i, t[i]);
                    if (!otherSide || /\s/.test(otherSide)) {
                        if (t.slice(keep.from, keep.to) === keep.text) return null;
                        return { message: "داخل پرانتز و گیومه، کنار نشانه فاصله نمی‌آید", ...at(keep), source: SOURCE };
                    }
                    const flip = quoteFix(t, i, other);
                    // the likelier first: flipped only if that, and not the glyph as typed, pairs up the line
                    const cs = line.quotes.map((j) => t[j]);
                    const flipped = cs.map((c, j) => (j === k ? other : c));
                    const keepFirst = !(balanced(flipped) && !balanced(cs));
                    const [a, b] = keepFirst ? [keep, flip] : [flip, keep];
                    const w0 = t.slice(0, a.from).match(/[\p{L}\u200c]*$/u)![0];
                    const w1 = t.slice(a.to).match(/^[\p{L}\u200c]*/u)![0];
                    const show = (f: { text: string }) => `${w0}${f.text}${w1}`;
                    return {
                        message: `گیومه یا جای فاصله‌اش اشتباه است یا خودش وارونه تایپ شده: «${show(a)}» یا «${show(b)}»`,
                        start: a.from - i,
                        end: a.to - i,
                        replacement: a.text,
                        alternatives: [b.text],
                        fix: false,
                        source: SOURCE
                    };
                }
            },
            {
                // spaces at the end of a line (not at the end of a text node: in Markdown a
                // node ends before a link or emphasis, and that space is real)
                pattern: /(?<=\S)[ \t]+(?=\n)/g,
                check: (m) => (persianContext(m.input, m.index) ? { message: "فاصلۀ اضافه در پایان سطر", replacement: "", source: SOURCE } : null)
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

    if (on("spacing")) {
        let placesText = "";
        let places = new Map<number, string>();
        const WHAT: Record<string, string> = { unit: "عدد و واحدش", citation: "نشانۀ ارجاع و شماره‌اش", date: "روز و ماه" };
        checks.push({
            // a no-break space where the two sides must stay on one line (1.4.0): «۲۰ درصد»، «ص ۲۳۹»، «۲۵ مهر ۱۴۰۳»
            pattern: new RegExp(`(?<=[0-9۰-۹٠-٩]|(?<![${LETTERS}])(?:${CITATIONS.join("|")}))[ \u00A0]+(?=[${LETTERS}0-9۰-۹٠-٩])`, "g"),
            check: (m) => {
                if (m.input !== placesText) {
                    placesText = m.input;
                    places = new Map(nbspPlaces(m.input).map((p) => [p.at, p.what]));
                }
                const what = places.get(m.index);
                if (!what || m[0] === "\u00A0") return null;
                return { message: `میان ${WHAT[what]} فاصلۀ نشکن می‌آید تا در دو سطر نیفتند`, replacement: "\u00A0", source: SOURCE };
            }
        });
    }

    if (on("digits")) {
        checks.push({
            // separators between Persian digits: «۱۲,۵۴۳» → «۱۲٬۵۴۳», «۴.۷» → «۴٫۷»
            pattern: /(?<=[۰-۹])[,.](?=[۰-۹])/g,
            check: (m) => {
                const fixed = m[0] === "," ? "٬" : "٫";
                return { message: `جداکنندۀ ${m[0] === "," ? "هزارگان" : "اعشار"} در عدد فارسی «${fixed}» است`, replacement: fixed, source: SOURCE };
            }
        });
    }

    if (on("spacing")) {
        checks.push({
            // a number glued to the next word: «۵سال» → «۵ سال»
            // (Arabic-Indic digits «٠-٩» and «٪ ٫ ٬» sit inside «آ-ی»: they are not letters here)
            pattern: /(?<![A-Za-z0-9۰-۹٠-٩_\-/.:#])([0-9۰-۹]+)((?:(?![٠-٩٪٫٬٭])[آ-ی])(?:(?![٠-٩٪٫٬٭])[آ-ی\u200c])*)/g,
            check: (m) => {
                const word = m[2];
                // suffixes and number compounds the book writes joined (ب-۱۰، ص ۶۵: «۴۷سالگی»):
                // «۵م»، «۲۰امین»، «۳تایی»، «۵ساله»، «۴۷سالگی»، «۷۵درصدی»، «۵گانه»; one letter: «۱۳۰۰ق»، «۲۰۰۰م».
                // The compounds are the «numbers» rule's own list: the book wins, never a ping-pong.
                if (word.length <= 1 || /^(ام|امین|امی|مین|ین|ها|های|تا|تایی|ای|یی|ی)$/.test(word)) return null;
                if (joinsNumber(word)) return null;
                // an adjective made with the number, a known word + «ی/ه» («۵کیلویی»، «۴کاناله»): the book joins these
                // («۵ساله»، «۷۵درصدی»، ص ۶۵), so no space is asked for (1.6.1; a blue suggestion before). A noun
                // («۳۹دقیقه»، «۲۶۶مدرسه») still gets its suggestion
                const adjective = /(ی|ه|گی)$/.test(word);
                if (adjective && !COMMON_NOUNS_P.has(word) && isKnown(word.replace(/(یی|ی|ه|گی)$/, ""))) return null;
                return {
                    message: "میان عدد و کلمۀ پس از آن یک فاصله می‌آید",
                    replacement: m[1] + (isUnit(word) ? "\u00A0" : " ") + word,
                    // a word in «ی/ه» may still be an adjective made with the number: only a suggestion
                    fix: adjective ? false : undefined,
                    kind: adjective ? "suggestion" : undefined,
                    source: SOURCE
                };
            }
        });
    }

    if (on("dashes")) {
        // the dash: «—» with one space on each side, between words (نگارش و ویرایش، سمیعی، ص ۲۳۹:
        // «یک روزِ تمام — اگر حاجت باشد، دو روز — برای انجام دادنِ این کار فرصت دارید»). Number
        // ranges («۴-۵»، «۱۳۹۰–۱۴۰۰»)، Latin compounds and a hyphen starting a line (a list) stay.
        const DASH = "خط تیره (—) میان دو واژه با یک فاصله از دو طرف نوشته می‌شود";
        const S_DASH = "نگارش و ویرایش، احمد سمیعی گیلانی، ص ۲۳۹";
        // a dash between Persian words, however it was typed: «--»، «-»، «–»، «ـ» with spaces, «—» with any spacing
        const SP = "[ \\u00A0]";
        const DASH_RE = new RegExp(`(?<=${FA_LETTER}[»)]?)(?:${SP}*[—–]${SP}*|${SP}+(?:-{1,3}|ـ)${SP}+)(?=[«(]?${FA_LETTER})`, "g");
        /**
         * The right form of the dash at `index` (since 1.4.0): «—» with a normal space outside and a
         * no-break space inside, so it stays with its phrase and never ends or starts a line alone.
         * The first of a pair opens (« —\u00A0»), the second closes («\u00A0— »); a dash alone opens.
         */
        const dashForm = (text: string, index: number): string => {
            let a = index;
            while (a > 0 && !/[.!؟?\n]/.test(text[a - 1])) a--;
            let b = index;
            while (b < text.length && !/[.!؟?\n]/.test(text[b])) b++;
            const all = [...text.slice(a, b).matchAll(DASH_RE)].map((x) => a + x.index!);
            const i = all.indexOf(index);
            return all.length >= 2 && i % 2 === 1 ? "\u00A0— " : " —\u00A0";
        };
        checks.push({
            // «تهران - مشهد»، «فرقه – حشاشیون»، «او ـ که»، «علی -- رضا»، «ساختمان—مثل»، «موزی–که»
            pattern: DASH_RE,
            check: (m) => {
                if (!persianContext(m.input, m.index)) return null;
                if (/ـ/.test(m[0])) {
                    // «بی ـ، می ـ»: a hyphen marking an affix, not a dash
                    const prev = m.input.slice(0, m.index).trimEnd().split(/\s/).pop() ?? "";
                    if (AFFIXES.has(prev)) return null;
                }
                const form = dashForm(m.input, m.index);
                if (m[0] === form) return null;
                return { message: DASH, replacement: form, source: S_DASH };
            }
        });
        checks.push(
            {
                // a dash starting a line of dialogue: «— سلام.» (a kashida or an en dash there too), one space after it
                pattern: /^[ \t]*[—–ـ](?! )(?=\S)|^[ \t]*[–ـ](?= )|^[ \t]*— {2,}/gm,
                check: (m) => {
                    if (!persianContext(m.input, m.index)) return null;
                    const lead = m[0].match(/^[ \t]*/)![0];
                    return { message: "خط تیرۀ آغاز گفت‌وگو «—» است و یک فاصله پس از آن می‌آید", replacement: lead + "— ", end: m[0].length + (m.input.slice(m.index + m[0].length).match(/^ */)![0].length), source: S_DASH };
                }
            }
        );
    }

    if (on("digits")) {
        checks.push({
            pattern: /(?<=[۰-۹])%/g,
            check: () => ({ message: "نشانۀ درصد فارسی «٪» است", replacement: "٪", source: SOURCE })
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
                // part of a longer code (1.6.1): a version or an address («4.2.0»، «192.168.1.1»), a time
                // («12:30»), a number after «+» or before «..» («10..20»): left as it is, whole
                if ((m[0].match(/\./g) ?? []).length >= 2 || /^[.:/][0-9]/.test(after) || /^\.\./.test(after) || /[+]$/.test(before)) return null;
                // a time after «ساعت» («ساعت 5.30»)، two numbers with a comma that is no thousands mark («22,23»)
                if (/\./.test(m[0]) && /ساعت\s*$/.test(before)) return null;
                if (/,(?![0-9]{3}(?![0-9]))/.test(m[0])) return null;
                // a version after its name: «نسخۀ 2.5»، «ورژن 4.2»
                if (/\./.test(m[0]) && /(?:نسخه|نسخۀ|نسخهٔ|ورژن|ورژنِ|ویرایش|بیلد|آپدیت)\s*$/.test(before)) return null;
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
        check: (m: RegExpExecArray) => (!m[0].startsWith("<<") && isProtected(m.input, m.index, m.index + m[0].length) ? null : check(m))
    }));
    return { source: SOURCE, checks: guarded };
});
