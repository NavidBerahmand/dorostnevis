/**
 * واج‌بان (vajban.com) — the web page. Runs textlint with the Farhangestan preset entirely
 * in the browser: nothing typed here leaves the page.
 */
import { TextlintKernel } from "@textlint/kernel";
import textPlugin from "@textlint/textlint-plugin-text";
import preset from "../../textlint-rule-preset-farhangestan/src/index";
import { loadSpellingLexicon } from "../../textlint-rule-preset-farhangestan/src/util/speller";
import shekaste from "../../textlint-rule-preset-shekaste/src/index";
import virayesh from "../../textlint-rule-preset-virayesh/src/index";
import { openReport, sentenceAround, setupOwnerPanel, Report } from "./report";

type Msg = {
    ruleId: string;
    message: string;
    range: [number, number];
    fix?: { range: [number, number]; text: string };
};


const SAMPLE = [
    "رييس اداره گفت كه این مساله را بررسي می کنیم و نتیجه ی آن را بزودی اعلام می کنیم.",
    "ما در اطاق جلسه منتظر بودیم و هیچکس نمیدانست بلیط ها کجاست.",
    "بزرگترها میگفتند که این سریعترین راه است، ولی بیخیال شدیم و برگشتیم.",
    "خانه ای که خریدند بزرگ تر از خانه قبلی است و بی شک بهترین انتخاب بود.",
    "من خستهام، ولی هم‌چنین باید پیش از آنکه شب شود با او صحبت‌کنم.",
    "زبانشناسی و روانشناسی دو رشته ی همسو هستند؛ اما آدم بیسواد نمیتواند آنرا بفهمد.",
    "بمحض رسیدن، کتاب اش را از خانه من آورد؛ واقعا آنروز ریاضیدان ها چه طور اینگونه فکر میکردند؟",
    "او نتیجه نهایی را اعلام کرد و همه دفترهارا جمع کرد؛ بعد مسیررا عوض کردیم.",
    "این طرح مورد بررسی قرار گرفت و مسئولین گفتند نتیجه جهت اطلاع عموم در رابطه با بودجه منتشر می‌شود و قابل قبول می‌باشد."
].join("\n");

const RULE_LABELS: Record<string, string> = {
    "normalize-characters": "نویسه‌ها",
    "zwnj-cleanup": "نیم‌فاصله",
    "mi-prefix": "می-",
    "bi-prefix": "بی-",
    "plural-ha": "ها",
    "tar-tarin": "تر/ترین",
    "ezafe-he": "کسرهٔ اضافه",
    "copula-attachment": "ام/است",
    lexicon: "فهرست‌های کتاب",
    "joined-words": "ترکیب‌ها",
    "compound-verbs": "فعل مرکب",
    numbers: "عدد",
    "verb-prefix-alef": "بـ/نـ پیش از ا",
    "hamza-tanvin": "همزه و تنوین",
    "arabic-prefixes": "سوء/ضد/غیر",
    dictionary: "فرهنگ املایی",
    "word-spacing": "فاصله‌گذاری",
    spelling: "غلط تایپی",
    punctuation: "نشانه‌گذاری",
    "over-broken": "شکستن بی‌جا",
    "may-break": "شکستن روا",
    "redundant-verbs": "فعل زائد",
    "arabic-plurals": "جمع عربی",
    prepositions: "حرف اضافه",
    calques: "ترجمه‌زدگی",
    redundancy: "حشو",
    "repeated-words": "تکرار",
    "long-sentences": "جملهٔ بلند",
    invisible: "فاصله و نویسهٔ نادیدنی",
    "spaced-compounds": "ترکیب‌ها",
    misspellings: "غلط رایج",
    "ra-placement": "جای «را»",
    "comma-before-va": "ویرگول پیش از «و»",
    "word-choice": "واژه‌گزینی",
    phrases: "تعبیر نادرست",
    "final-he": "«ه»ی پایانی",
    gozar: "گذار/گزار"
};

const SAMPLE_DIALOGUE = [
    "ـ دیروز اومدم دنبالت که بریم پارک. نبودی.",
    "ـ آره، رفته بودم خونه‌ی خاله‌م. حالش خیلی خرابه.",
    "ـ اگه دیگه نیاد چی؟ یه خرده صبر کن، بهش زنگ می‌زنم.",
    "ـ بچه‌ها رفته‌ان؟ نمی‌تونن بیان، دکترا می‌گن مریضه.",
    "ـ کتابو بده، شاید فردا وقت کنم بخونمش. الان نیس.",
    "ـ هوا سرد است. من می‌روم، تو هم بیا."
].join("\n");

const kernel = new TextlintKernel();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/*
 * The text box is an editable <div>, and the highlighter paints the words in it
 * directly (the CSS Custom Highlight API: Ranges over its own text), so a mark
 * cannot drift from its word the way a copy of the text under a textarea can
 * when the two wrap lines differently. The box is kept as plain text (one text
 * node, «\n» for line breaks): paste and Enter insert plain text.
 */
const box = $<HTMLDivElement>("text");
box.contentEditable = "plaintext-only";
if (box.contentEditable !== "plaintext-only") box.contentEditable = "true";
const HIGHLIGHTS = typeof CSS !== "undefined" && "highlights" in CSS && typeof (window as any).Highlight === "function";

/** The box's text: text nodes as they are, <br> and block starts as «\n». */
function readText(): string {
    let out = "";
    const walk = (n: Node) => {
        n.childNodes.forEach((c) => {
            if (c.nodeType === Node.TEXT_NODE) out += (c as Text).data;
            else if (c.nodeName === "BR") out += "\n";
            else {
                if (/^(DIV|P)$/.test(c.nodeName) && out && !out.endsWith("\n")) out += "\n";
                walk(c);
            }
        });
    };
    walk(box);
    return out;
}
/** The text node and offset at string offset `pos` (the box is normalized to one text node). */
function pointAt(pos: number): [Node, number] {
    const t = box.firstChild;
    if (!t || t.nodeType !== Node.TEXT_NODE) return [box, 0];
    return [t, Math.min(pos, (t as Text).length)];
}
/** String offset of a DOM point inside the box. */
function offsetOf(node: Node, off: number): number {
    // count the way readText() does: text as it is, <br> as one «\n»
    let n = 0;
    let found = -1;
    const walk = (p: Node) => {
        for (let i = 0; i < p.childNodes.length && found < 0; i++) {
            if (p === node && i === off) found = n;
            const c = p.childNodes[i];
            if (c === node && c.nodeType === Node.TEXT_NODE) {
                found = n + off;
                return;
            }
            if (c.nodeType === Node.TEXT_NODE) n += (c as Text).data.length;
            else if (c.nodeName === "BR") n += 1;
            else {
                if (/^(DIV|P)$/.test(c.nodeName) && n > 0) n += 1;
                walk(c);
            }
        }
        if (p === node && found < 0 && off >= p.childNodes.length) found = n;
    };
    walk(box);
    return found < 0 ? n : found;
}
function caret(): number | null {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !box.contains(sel.anchorNode)) return null;
    return offsetOf(sel.focusNode!, sel.focusOffset);
}
function setCaret(pos: number) {
    const [n, o] = pointAt(pos);
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.setStart(n, o);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
}
/** One text node again (after a paste or an Enter left <br>s or <div>s), keeping the caret. */
function normalizeBox() {
    if (box.childNodes.length === 0 || (box.childNodes.length === 1 && box.firstChild!.nodeType === Node.TEXT_NODE)) return;
    const pos = caret();
    const text = readText();
    box.textContent = text;
    if (pos !== null) setCaret(pos);
}
const input = {
    get value(): string {
        return readText();
    },
    set value(t: string) {
        box.textContent = t;
        box.classList.toggle("is-empty", t === "");
    },
    focus: () => box.focus(),
    select() {
        const r = document.createRange();
        r.selectNodeContents(box);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
    },
    get collapsed(): boolean {
        const sel = window.getSelection();
        return !sel || sel.isCollapsed;
    }
};
let composing = false;
box.addEventListener("compositionstart", () => (composing = true));
box.addEventListener("compositionend", () => {
    composing = false;
    box.dispatchEvent(new Event("input"));
});
// plain text only: no fonts, colours or links come in with a paste
box.addEventListener("paste", (ev) => {
    ev.preventDefault();
    const t = (ev.clipboardData?.getData("text/plain") ?? "").replace(/\r\n?/g, "\n");
    pasted = true; // the input handler fixes the whole text after a paste
    document.execCommand("insertText", false, t);
});
box.addEventListener("keydown", (ev) => {
    // «plaintext-only» boxes insert a «\n» themselves; a plain contenteditable would add <div>s
    if (ev.key === "Enter" && !ev.isComposing && box.contentEditable !== "plaintext-only") {
        ev.preventDefault();
        document.execCommand("insertText", false, "\n");
    }
});
const pop = $<HTMLDivElement>("popover");
const summary = $<HTMLParagraphElement>("summary");
const showZwnj = $<HTMLInputElement>("show-zwnj");
const pluralMode = $<HTMLSelectElement>("plural-mode");
const ezafeStyle = $<HTMLSelectElement>("ezafe-style");
const mode = $<HTMLSelectElement>("mode");
const applyAllBtn = $<HTMLButtonElement>("apply-all");
const copyBtn = $<HTMLButtonElement>("copy");
const status = $<HTMLSpanElement>("status");

let messages: Msg[] = [];
/** Other rules' messages folded into card i (same word, same correction). */
let extras: Msg[][] = [];

/**
 * Several rules can propose the same correction for the same word («زکوة» ←
 * «زکات»: the book's list, the dictionary and the «ة» rule): one card, with
 * every rule and source. Different corrections for one word stay apart.
 */
function mergeSame(msgs: Msg[], text: string): { primary: Msg[]; extra: Msg[][] } {
    const spanOf = (m: Msg) =>
        wordAround(text, Math.min(m.range[0], m.fix?.range[0] ?? m.range[0]), Math.max(m.range[1], m.fix?.range[1] ?? m.range[1]));
    const groups = new Map<string, Msg[]>();
    for (const m of msgs) {
        const k = spanOf(m).join(":");
        groups.set(k, [...(groups.get(k) ?? []), m]);
    }
    // the book's own rules first, then the dictionary, then the statistical models
    const rank = (m: Msg) => (m.ruleId === "dictionary" ? 1 : /احتمال/.test(m.message) ? 2 : 0);
    const primary: Msg[] = [];
    const extra: Msg[][] = [];
    for (const [k, group] of groups) {
        const fixes = group.filter((m) => m.fix);
        // the same edit proposed by several rules counts once
        const edits = [...new Map(fixes.map((m) => [`${m.fix!.range[0]}:${m.fix!.range[1]}:${m.fix!.text}`, m.fix!])).values()]
            .sort((a, b) => a.range[0] - b.range[0]);
        // edits to different letters of the word complement each other («رييس»: one per «ي»);
        // edits to the same letters that differ are a real disagreement and stay apart
        const disjoint = edits.every((f, j) => j === 0 || edits[j - 1].range[1] <= f.range[0]);
        if (fixes.length === 0 || !disjoint) {
            for (const m of group) {
                primary.push(m);
                extra.push([]);
            }
            continue;
        }
        const best = [...fixes].sort((a, b) => rank(a) - rank(b))[0];
        let card = best;
        if (edits.length > 1) {
            const lo = edits[0].range[0];
            const hi = edits[edits.length - 1].range[1];
            let out = "";
            let pos = lo;
            for (const f of edits) {
                out += text.slice(pos, f.range[0]) + f.text;
                pos = f.range[1];
            }
            // one card that makes every edit; its range stays the original's, so «نادیده» still finds it
            card = { ...best, fix: { range: [lo, hi], text: out + text.slice(pos, hi) } };
        }
        primary.push(card);
        extra.push(group.filter((m) => m !== best));
    }
    const order = primary.map((m, i) => i).sort((a, b) => primary[a].range[0] - primary[b].range[0]);
    return { primary: order.map((i) => primary[i]), extra: order.map((i) => extra[i]) };
}
/** What «این پیشنهاد غلط است» would send for each card. */
let reports: Report[] = [];
let timer: number | undefined;

/** Language-editing rules: suggestions only, never in «اعمال همه». */
const STYLE_RULES = new Set(Object.keys(virayesh.rules));
const isStyle = (m: Msg) => STYLE_RULES.has(m.ruleId);
const styleBoxes = [...document.querySelectorAll<HTMLInputElement>("#style-rules input[data-rule]")];

/*
 * اصلاح خودکار ایرادهای تایپی (since 1.3.0). With the setting on (the default), these fixes
 * are made silently while typing and on paste, and are never marked: they are typing
 * mechanics, not choices — which letter, which space, which half-space. Each automatic
 * batch is one step of «بازگشت», and undoing it means «I meant that»: those fixes are then
 * left alone and marked as before.
 *
 * Only certain, context-free fixes are here. Per rule (a rule with `only` contributes just
 * the checks whose message matches it; `skip` leaves some out):
 * - normalize-characters: «ي ى ك» and other look-alike letters (ہ ە ھ ے ۍ ڪ ۃ), presentation
 *   forms, a doubled diacritic, soft hyphen and RLM/LRM between letters (→ نیم‌فاصله),
 *   «ی» + hamza → «ئ». Not: Arabic digits (left as they are), a kashida (may be decoration),
 *   «ي/ك» in what looks like an Arabic quotation (that has no fix anyway).
 * - invisible: special Unicode spaces → space, ZWSP (→ نیم‌فاصله between letters, else
 *   removed), BOM and word joiner, spaces at the start/end of a paragraph. (NBSP and ZWJ
 *   have no fix: they can be meant.)
 * - zwnj-cleanup: double ZWNJ, ZWNJ next to a space or at a word's edge, ZWNJ after a
 *   non-joining letter.
 * - mi-prefix: «می/نمی» + verb with a space or joined → نیم‌فاصله. Not the separated
 *   preverbs («در/بر/باز … می‌»), which are compound choices.
 * - plural-ha: «کتاب ها» → «کتاب‌ها», «خانهها» → «خانه‌ها». Not the «ا+ی» reading guess
 *   («خستهایم») or the joined-«ها» recommendation (no fix).
 * - tar-tarin: «بزرگ تر/بزرگتر/بزرگ ترین» → «بزرگ‌تر/بزرگ‌ترین», «بیش تر» → «بیشتر».
 * - punctuation: Latin «, ; ?» → «، ؛ ؟» after Persian (not in URLs, e-mails, numbers or
 *   before Latin), straight double quotes → «» (only when the line's quotes pair up),
 *   space before «، ؛ : ! ؟ .», a missing space after them, spaces inside «» () [],
 *   repeated spaces, spaces at a line's end. Not: digits, «...», dashes, «!!!», «(( ))».
 * Left out entirely: dictionary and compound choices (lexicon, dictionary, joined-words,
 * spaced-compounds, word-spacing, compound-verbs, misspellings, final-he, gozar,
 * hamza-tanvin, arabic-prefixes, verb-prefix-alef, bi-prefix and copula-attachment, whose
 * fixes depend on reading the word: «بی» and «ای» can be free words), the statistical models
 * (ezafe-he, «را»), numbers, the spelling checker, and all of ویرایش زبانی.
 */
const AUTO_FIX: Record<string, { only?: RegExp; skip?: RegExp }> = {
    "normalize-characters": { skip: /رقم عربی|کشیده/ },
    invisible: {},
    "zwnj-cleanup": {},
    "mi-prefix": { only: /^«ن?می» با نیم‌فاصله به فعل می‌چسبد/ },
    "plural-ha": { only: /^«ها»ی جمع با فاصلهٔ کامل|^پس از «ه» نشانهٔ جمع/ },
    "tar-tarin": {},
    punctuation: {
        only: /^در متن فارسی «[،؛؟]»|^در متن فارسی گیومهٔ فارسی|^پیش از نشانه فاصله|^پس از نشانه یک فاصله|^پس از نقطه یک فاصله|^داخل پرانتز و گیومه|^فاصلهٔ اضافه در پایان سطر|^بین دو کلمه یک فاصله/
    }
};

/** Is this message's fix one of the automatic typing fixes? */
function isAuto(m: Msg, text: string): boolean {
    const spec = AUTO_FIX[m.ruleId];
    if (!spec || !m.fix) return false;
    if (spec.only && !spec.only.test(m.message)) return false;
    if (spec.skip && spec.skip.test(m.message)) return false;
    if (m.ruleId === "punctuation") {
        const [s, e] = m.fix.range;
        const lineStart = text.lastIndexOf("\n", s - 1) + 1;
        const nl = text.indexOf("\n", s);
        const line = text.slice(lineStart, nl < 0 ? text.length : nl);
        if (/^در متن فارسی گیومهٔ/.test(m.message)) {
            // only "…" and “…”, and only when every quote on the line has its pair
            const q = text[s];
            if (q === '"') return (line.match(/"/g) ?? []).length % 2 === 0;
            if (q === "“") return (line.match(/“/g) ?? []).length === (line.match(/”/g) ?? []).length;
            return false;
        }
        if (/^در متن فارسی «/.test(m.message)) {
            // between Persian words: not before a Latin letter or a digit («,abc», «?2»)
            const next = text.slice(e).match(/^ *(\S)/)?.[1] ?? "";
            if (/[A-Za-z0-9]/.test(next)) return false;
        }
    }
    return true;
}

/** Which fix this is, wherever it sits: the rule, the word and its corrected form. */
function autoKey(m: Msg, text: string): string {
    const [s, e] = wordAround(text, m.fix!.range[0], m.fix!.range[1]);
    return `${m.ruleId}|${text.slice(s, e)}|${text.slice(s, m.fix!.range[0])}${m.fix!.text}${text.slice(m.fix!.range[1], e)}`;
}

/** The rules to run; `forFix` leaves out what «اعمال همه» must not touch; `autoOnly` keeps the automatic ones. */
function options(forFix = false, autoOnly = false) {
    const style = mode.value === "dialogue" || forFix ? {} : Object.fromEntries(
        Object.entries(virayesh.rules).filter(([id]) => styleBoxes.find((b) => b.dataset.rule === id)?.checked !== false)
    );
    const all = { ...preset.rules, ...(mode.value === "dialogue" ? shekaste.rules : {}), ...style };
    // spoken forms («می‌رم»، «خونه») are not typos: no spelling check in dialogue
    const rules = Object.entries(all).filter(([ruleId]) => !(ruleId === "spelling" && mode.value === "dialogue") && (!autoOnly || ruleId in AUTO_FIX)).map(([ruleId, rule]) => {
        let opts: object | boolean = true;
        if (ruleId === "plural-ha") opts = { mode: pluralMode.value };
        if (ruleId === "ezafe-he") opts = { style: ezafeStyle.value, formal: mode.value !== "dialogue" };
        if (ruleId === "calques") opts = { ezafe: ezafeStyle.value };
        return { ruleId, rule: rule as any, options: opts };
    });
    return { ext: ".txt", plugins: [{ pluginId: "text", plugin: (textPlugin as any).default ?? textPlugin }], rules };
}


function esc(s: string): string {
    return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** Text with ZWNJs drawn as a visible mark, if the reader asked for it. */
function show(s: string): string {
    const e = esc(s);
    return showZwnj.checked ? e.replace(/‌/g, '<span class="zw" aria-label="نیم‌فاصله">‌</span>') : e;
}

function splitMessage(m: Msg): { text: string; source: string } {
    // the source is the last parenthesis, which may itself contain one: «… (غلط‌یاب (واژه‌نامهٔ …))»
    const msg = m.message.trimEnd();
    if (!msg.endsWith(")")) return { text: m.message, source: "" };
    let depth = 0;
    for (let i = msg.length - 1; i >= 0; i--) {
        if (msg[i] === ")") depth++;
        else if (msg[i] === "(" && --depth === 0) return { text: msg.slice(0, i).trimEnd(), source: msg.slice(i + 1, -1) };
    }
    return { text: m.message, source: "" };
}

/** A run of text that carries a highlighter mark, and the cards it opens. */
type Span = { s: number; e: number; items: number[]; red: boolean };
let spans: Span[] = [];

/** The word(s) a card is about: the reported range plus the corrected one. */
function cardSpan(m: Msg, text: string): [number, number] {
    return wordAround(text, Math.min(m.range[0], m.fix?.range[0] ?? m.range[0]), Math.max(m.range[1], m.fix?.range[1] ?? m.range[1]));
}

/**
 * Red: the book's own rules and lists say it is wrong («اعمال همه» fixes it).
 * Yellow: a model's guess, a possible typo, a judgement of meaning, a style note.
 */
function isCertain(i: number): boolean {
    return [messages[i], ...extras[i]].some((x) => x.fix && !isStyle(x) && !/احتمال/.test(x.message));
}

/** The Range of span k in the box (kept until the text changes). */
let ranges: Range[] = [];

/**
 * The highlighter: each marked span is a Range over the box's own text, painted
 * red or yellow with ::highlight(). Marks always cover whole words.
 */
function renderMarks(text: string) {
    const items = messages
        .map((m, i) => {
            const [s, e] = cardSpan(m, text);
            return { s, e, i };
        })
        .sort((a, b) => a.s - b.s || b.e - a.e);
    spans = [];
    for (const it of items) {
        const last = spans[spans.length - 1];
        if (last && it.s < last.e) {
            last.e = Math.max(last.e, it.e);
            last.items.push(it.i);
            last.red = last.red || isCertain(it.i);
        } else {
            spans.push({ s: it.s, e: it.e, items: [it.i], red: isCertain(it.i) });
        }
    }
    ranges = spans.map((sp) => {
        const r = document.createRange();
        const [a, ao] = pointAt(sp.s);
        const [b, bo] = pointAt(Math.max(sp.e, sp.s));
        r.setStart(a, ao);
        r.setEnd(b, bo);
        return r;
    });
    paintMarks();
}

function paintMarks() {
    if (!HIGHLIGHTS) return;
    const H = (window as any).Highlight;
    const reg = (CSS as any).highlights;
    const groups: Record<string, Range[]> = { "vb-red": [], "vb-yellow": [], "vb-red-open": [], "vb-yellow-open": [], "vb-zwnj": [] };
    spans.forEach((sp, k) => groups[`vb-${sp.red ? "red" : "yellow"}${k === openK ? "-open" : ""}`].push(ranges[k]));
    if (showZwnj.checked) {
        const text = input.value;
        for (let i = text.indexOf("\u200c"); i >= 0; i = text.indexOf("\u200c", i + 1)) {
            const r = document.createRange();
            const [a, ao] = pointAt(Math.max(0, i - 1));
            const [b, bo] = pointAt(i + 2);
            r.setStart(a, ao);
            r.setEnd(b, bo);
            groups["vb-zwnj"].push(r);
        }
    }
    for (const [name, rs] of Object.entries(groups)) reg.set(name, new H(...rs));
}
function clearMarks() {
    spans = [];
    ranges = [];
    if (HIGHLIGHTS) for (const n of ["vb-red", "vb-yellow", "vb-red-open", "vb-yellow-open", "vb-zwnj"]) (CSS as any).highlights.delete(n);
}

// invisible characters inside a word (ZWNJ, ZWSP, ZWJ, RLM, word joiner) belong to it
const WORD_CHAR = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u200B-\u200F\u2060\u0640]/;
function wordAround(text: string, start: number, end: number): [number, number] {
    while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
    while (end < text.length && WORD_CHAR.test(text[end])) end++;
    return [start, end];
}

/** «(احتمال ۸۲٪)» in a model's message → 82, and the message without it. */
function takeConfidence(msg: string): { msg: string; p: number | null } {
    const m = msg.match(/ ?\(احتمال ([۰-۹0-9]+)٪\)/);
    if (!m) return { msg, p: null };
    const p = Number(m[1].replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)));
    return { msg: msg.replace(m[0], ""), p };
}

const DOTS = 5;
/** Five circles: as many filled as the confidence (in fifths); red at 50% to green at 100%. */
function confidenceMeter(p: number): string {
    const filled = Math.max(1, Math.round(p / (100 / DOTS)));
    const hue = Math.round(Math.min(120, Math.max(0, ((p - 50) / 50) * 120)));
    const pct = p.toLocaleString("fa-IR");
    const dots = Array.from({ length: DOTS }, (_, i) =>
        i < filled ? `<span class="dot" style="background:hsl(${hue} 70% 45%);border-color:hsl(${hue} 70% 45%)"></span>` : '<span class="dot"></span>'
    ).join("");
    return `<div class="confidence" role="img" aria-label="اطمینان مدل: ${pct}٪" title="اطمینان مدل آماری: ${pct}٪. هرچه دایره‌های پر بیشتر و سبزتر، مدل مطمئن‌تر است.">
                <span class="confidence-label">اطمینان مدل</span>
                <span class="dots">${dots}</span>
            </div>`;
}

/** A book rule applied as written: five full green circles. */
function bookMeter(): string {
    const dots = Array.from({ length: DOTS }, () => '<span class="dot" style="background:hsl(120 70% 45%);border-color:hsl(120 70% 45%)"></span>').join("");
    return `<div class="confidence" role="img" aria-label="قاعدهٔ صریح کتاب" title="این اصلاح را قاعدهٔ صریح کتاب می‌گوید؛ احتمالی در کار نیست.">
                <span class="confidence-label">قاعدهٔ کتاب</span>
                <span class="dots">${dots}</span>
            </div>`;
}

const BOOK_PDF = "https://apll.ir/wp-content/uploads/2023/07/Dastour-e-Khat-17.04.1402.pdf";
const FARHANG_PDF = "https://apll.ir/wp-content/uploads/2018/10/F-E-1394.pdf";
const ACADEMY = "فرهنگستان زبان و ادب فارسی";
// In both PDFs the page index is the printed page number, so «#page=N» opens page N.
const BOOKS: Array<{ prefix: RegExp; name: string; url?: string }> = [
    { prefix: /^دستور خط(?: \(ویراست جدید\))?\s*[،؛:]?\s*/, name: `دستور خطّ فارسی، ${ACADEMY}`, url: BOOK_PDF },
    { prefix: /^فرهنگ املایی(?: خطّ فارسی)?\s*[،؛]?\s*/, name: `فرهنگ املایی خطّ فارسی، ${ACADEMY}`, url: FARHANG_PDF },
    { prefix: /^اصول شکسته‌نویسی\s*[،؛]?\s*/, name: "اصول شکسته‌نویسی، علی صلح‌جو" },
    { prefix: /^نکته‌های ویرایش، علی صلح‌جو\s*[،؛]?\s*/, name: "نکته‌های ویرایش، علی صلح‌جو" },
    { prefix: /^نگارش و ویرایش، احمد سمیعی گیلانی\s*[،؛]?\s*/, name: "نگارش و ویرایش، احمد سمیعی گیلانی" },
    { prefix: /^غلط ننویسیم، ابوالحسن نجفی\s*[،؛]?\s*/, name: "غلط ننویسیم، ابوالحسن نجفی" }
];
/** A common convention the book has no rule for: no book meter, never «قطعی». */
const NOT_IN_BOOK = /در دستور خط نیامده/;
const faDigits = (s: string) => Number(s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)));
const PAGES = /ص ([۰-۹]+(?:–[۰-۹]+)?)/g;

/**
 * One small line: «دستور خطّ فارسی، فرهنگستان زبان و ادب فارسی، ص ۵۵», linked
 * to that page of the book's PDF. The section («واژه‌های برگرفته از عربی»)
 * goes in the tooltip.
 */
function citation(source: string): string {
    for (const b of BOOKS) {
        const m = source.match(b.prefix);
        if (!m) continue;
        let rest = source.slice(m[0].length);
        let book = b;
        // «دستور خط (ویراست جدید)؛ فرهنگ املایی، ص ۱۲۹، «…» دارد»: the book's rule,
        // and the page is the dictionary's: cite the dictionary page, note the rest
        let note = "";
        const farhang = rest.match(/^فرهنگ املایی،\s*/);
        if (book.url === BOOK_PDF && farhang) {
            book = BOOKS[1];
            note = "فرهنگ شکل دیگری دارد؛ در تعارض، دستور خط (ویراست جدید) مقدّم است";
            rest = rest.slice(farhang[0].length);
        }
        const pages = [...rest.matchAll(PAGES)].map((p) => p[1]);
        const text = book.name + (pages.length ? `، ص ${pages.join(" و ")}` : "");
        const section = rest.replace(PAGES, "").replace(/\s{2,}/g, " ").replace(/[،؛\s]+$/, "").replace(/^[،؛\s]+/, "");
        const tip = [section, note].filter(Boolean).join(" — ");
        const title = tip ? ` title="${esc(tip)}"` : "";
        if (!book.url) return `<span${title}>${esc(text)}</span>`;
        const href = pages.length ? `${book.url}#page=${faDigits(pages[0].split("–")[0])}` : book.url;
        return `<a class="cite-link" href="${href}" target="_blank" rel="noopener"${title}>${esc(text)}</a>`;
    }
    return esc(source);
}

/** The book recommends it, both forms are correct («آنها» / «آن‌ها»): reported only. */
const isRecommendation = (m: Msg) => m.ruleId === "plural-ha" && !m.fix && /توصیه/.test(m.message);

/** Why a card has no circles, in a few words. */
function noMeterReason(m: Msg): string {
    if (m.ruleId === "spelling") return "حدس غلط‌یاب است، نه قاعده";
    if (isRecommendation(m)) return "توصیهٔ کتاب است، نه الزام";
    if (m.ruleId === "may-break") return "پیشنهاد سبکی است، نه غلط";
    if (m.ruleId === "punctuation" || NOT_IN_BOOK.test(splitMessage(m).source)) return "قرارداد رایج است، نه کتاب";
    if (isStyle(m)) return "توصیهٔ ویرایشی است، نه قاعدهٔ کتاب";
    return "به معنای جمله بستگی دارد";
}

function meterFor(m: Msg, p: number | null): string {
    if (p !== null) return confidenceMeter(p);
    if (m.fix && m.ruleId !== "punctuation" && m.ruleId !== "invisible" && !isStyle(m) && !NOT_IN_BOOK.test(splitMessage(m).source)) return bookMeter();
    return `<div class="confidence confidence-none" title="این کارت درجهٔ اطمینان ندارد: ${noMeterReason(m)}.">
                <span class="confidence-label">درجه ندارد</span>
                <span class="confidence-why">${noMeterReason(m)}</span>
            </div>`;
}

/** Card i's HTML and class, shown in the note when its word is clicked. */
let cards: Array<{ cls: string; html: string }> = [];

function buildCards(text: string) {
    cards = [];
    reports = [];
    messages.forEach((m, i) => {
        const split = splitMessage(m);
        const members = [m, ...extras[i]];
        const sources = [...new Set(members.map((x) => splitMessage(x).source).filter(Boolean))];
        const source = sources.join(" | ");
        const labels = [...new Set(members.map((x) => RULE_LABELS[x.ruleId] ?? x.ruleId))];
        const { msg, p } = takeConfidence(split.text);
        // a book rule agreeing with a model's guess: the book's certainty
        const bookAgrees = [m, ...extras[i]].some(
            (x) => x.fix && !/احتمال/.test(x.message) && x.ruleId !== "punctuation" && x.ruleId !== "invisible" && !isStyle(x) && !NOT_IN_BOOK.test(splitMessage(x).source)
        );
        const meter = bookAgrees ? bookMeter() : meterFor(m, p);
        const styleOnly = members.every(isStyle);
        const cls = (styleOnly ? "issue issue-style" : m.fix ? "issue" : "issue issue-judge") + (m.fix ? "" : " no-fix") + (meter.includes("confidence-none") ? " has-note" : " has-confidence");
        // show the whole word around the change, so «ي ← ی» reads «رييس ← رئیس»
        const [ws, we] = wordAround(text, Math.min(m.range[0], m.fix?.range[0] ?? m.range[0]), Math.max(m.range[1], m.fix?.range[1] ?? m.range[1]));
        const original = text.slice(ws, we);
        const fixed = m.fix ? text.slice(ws, m.fix.range[0]) + m.fix.text + text.slice(m.fix.range[1], we) : "";
        reports.push({
            rule: members.map((x) => x.ruleId).join(", "),
            ruleLabel: labels.join("، "),
            message: msg,
            source,
            original,
            suggestion: fixed,
            context: sentenceAround(text, ws, we),
            comment: "",
            mode: mode.value,
            at: ""
        });
        const html = `
            ${meter}
            <div class="issue-head">
                ${labels.map((l) => `<span class="chip">${esc(l)}</span>`).join("")}
                ${styleOnly ? '<span class="chip chip-style">ویرایش زبانی · پیشنهاد</span>' : m.fix ? "" : m.ruleId === "may-break" ? '<span class="chip chip-style">پیشنهاد سبکی</span>' : isRecommendation(m) ? '<span class="chip chip-style">توصیهٔ کتاب</span>' : '<span class="chip chip-judge">نیازمند تشخیص</span>'}
            </div>
            <p class="change">
                <span class="from">${show(original) || "&nbsp;"}</span>
                ${m.fix ? `<span class="arrow" aria-hidden="true">←</span><span class="to">${show(fixed) || "(حذف)"}</span>` : ""}
            </p>
            <p class="msg">${esc(msg)}</p>
            ${sources.map((src) => `<p class="source">${citation(src)}</p>`).join("")}
            <div class="actions">
                ${m.fix ? `<button type="button" class="btn btn-small" data-apply="${i}">اعمال</button>` : ""}
                <button type="button" class="btn btn-small btn-quiet" data-ignore="${i}">نادیده</button>
                <button type="button" class="btn btn-small btn-report" data-report="${i}">این پیشنهاد غلط است</button>
            </div>`;
        cards.push({ cls, html });
    });
    const red = spans.filter((sp) => sp.red).length;
    const yellow = spans.length - red;
    const fa = (n: number) => n.toLocaleString("fa-IR");
    summary.innerHTML =
        spans.length === 0
            ? "ایرادی پیدا نشد. متن با قواعدی که این ابزار می‌شناسد سازگار است."
            : `<span>${fa(spans.length)} واژه یا عبارت</span>` +
              `<span class="key"><span class="swatch swatch-red"></span>${fa(red)} غلط قطعی</span>` +
              `<span class="key"><span class="swatch swatch-yellow"></span>${fa(yellow)} شاید غلط</span>`;
    applyAllBtn.disabled = red === 0;
    reviewBtn.disabled = spans.length === 0;
}

let ignored = new Set<string>();
const key = (m: Msg, text: string) => `${m.ruleId}|${text.slice(m.range[0], m.range[1])}|${m.range[0]}`;

// the spelling lexicon is loaded after the page; until then the rule stays quiet
fetch("spelling-lexicon.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
        if (data?.buckets) {
            loadSpellingLexicon(data);
            void check();
        }
    })
    .catch(() => undefined);

async function check() {
    // the automatic typing fixes: never while an IME is composing a word, nor right after an undo
    const want: AutoMode = autoBox.checked && !autoHold && !composing ? pendingAuto : "none";
    if (!composing) pendingAuto = "none";
    let text = input.value;
    status.textContent = "در حال بررسی…";
    let result = await kernel.lintText(text, options());
    if (want !== "none" && input.value === text) {
        const typing = want === "typing" && document.activeElement === box;
        const c = typing ? caret() : null;
        const guard = c !== null ? protectedSpan(text, c) : null;
        const msgs = result.messages as unknown as Msg[];
        skippedAtCaret = guard !== null && msgs.some((m) => isAuto(m, text) && touches(m.fix!.range, guard));
        if (pickAuto(msgs, text, guard).length) {
            const waited = Date.now() - lastInputAt;
            if (typing && !lastBoundary && waited < AUTO_PAUSE) {
                // in the middle of a word: wait for a pause (the word itself is never touched)
                pendingAuto = "typing";
                window.clearTimeout(timer);
                timer = window.setTimeout(check, AUTO_PAUSE - waited + 20);
            } else {
                const batch = await autoFix(text, msgs, guard);
                if (input.value !== text) return; // typed meanwhile: the next check starts over
                if (batch.count) {
                    applyBatch(text, batch);
                    text = batch.text;
                    result = await kernel.lintText(text, options());
                }
            }
        }
    }
    const merged = mergeSame(
        (result.messages as unknown as Msg[]).filter(
            (m) => !ignored.has(key(m, text)) && !(autoBox.checked && isAuto(m, text) && !declined.has(autoKey(m, text)))
        ),
        text
    );
    messages = merged.primary;
    extras = merged.extra;
    closePopover();
    renderMarks(text);
    buildCards(text);
    status.textContent = "";
    try {
        localStorage.setItem("vajban:draft", text);
    } catch {
        /* storage may be unavailable */
    }
}

function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(check, 350);
}

// ---- the automatic typing fixes (AUTO_FIX) ----
type AutoMode = "none" | "typing" | "all";
/** What the next check may fix: nothing, all but the word being typed, or the whole text. */
let pendingAuto: AutoMode = "all";
/** After an undo, nothing is fixed until the writer types again. */
let autoHold = false;
/** A fix waits because it touches the word at the caret: made when the box loses focus. */
let skippedAtCaret = false;
let lastInputAt = 0;
/** The last thing typed ended a word (space, punctuation, Enter) or was a paste. */
let lastBoundary = true;
let pasted = false;
/** The edits of a batch are being made: their input events are not the writer's. */
let applyingAuto = false;
/** Fixes the writer undid: left alone, and marked as usual. */
const declined = new Set<string>();
const AUTO_PAUSE = 700;
const autoBox = $<HTMLInputElement>("auto-fix");

/** A changed stretch of the text: [s, e) now, `orig` before the batch. */
type Hunk = { s: number; e: number; orig: string };
type Batch = { text: string; count: number; hunks: Hunk[]; keys: string[] };

/** The word at the caret, from the whitespace before it to the whitespace after. */
function protectedSpan(text: string, c: number): [number, number] {
    let s = c;
    while (s > 0 && !/\s/.test(text[s - 1])) s--;
    let e = c;
    while (e < text.length && !/\s/.test(text[e])) e++;
    return [s, e];
}
const touches = (r: [number, number], g: [number, number]) => r[0] <= g[1] && r[1] >= g[0];

/** The automatic fixes to make now: not declined, not at the caret, not overlapping; right to left. */
function pickAuto(msgs: Msg[], text: string, guard: [number, number] | null): Msg[] {
    const cands = msgs
        .filter((m) => isAuto(m, text) && !(guard && touches(m.fix!.range, guard)) && !declined.has(autoKey(m, text)))
        .sort((a, b) => a.fix!.range[0] - b.fix!.range[0] || a.fix!.range[1] - b.fix!.range[1]);
    const out: Msg[] = [];
    let lastS = -1;
    let lastE = -1;
    for (const m of cands) {
        const [s, e] = m.fix!.range;
        if (s < lastE || s === lastS) continue; // overlaps the previous one: the next round
        out.push(m);
        lastS = s;
        lastE = e;
    }
    return out.reverse();
}

/** Record edit [a, b) → t (on `cur`, the text before it) in the batch's hunks. */
function addHunk(hunks: Hunk[], cur: string, a: number, b: number, t: string): Hunk[] {
    const near = hunks.filter((h) => h.s <= b && h.e >= a).sort((x, y) => x.s - y.s);
    let s = a;
    let e = b;
    for (const h of near) {
        s = Math.min(s, h.s);
        e = Math.max(e, h.e);
    }
    let orig = "";
    let pos = s;
    for (const h of near) {
        orig += cur.slice(pos, h.s) + h.orig;
        pos = h.e;
    }
    orig += cur.slice(pos, e);
    const d = t.length - (b - a);
    const rest = hunks.filter((h) => !near.includes(h)).map((h) => (h.s >= e ? { s: h.s + d, e: h.e + d, orig: h.orig } : h));
    return [...rest, { s, e: e + d, orig }].sort((x, y) => x.s - y.s);
}

/**
 * Make the automatic fixes on `text`, round after round (a fix can make another
 * possible: «هاي» → «های» → «کتاب‌های»), until none is left; at most five rounds.
 */
async function autoFix(text: string, first: Msg[], guard: [number, number] | null): Promise<Batch> {
    let cur = text;
    let msgs = first;
    let g = guard;
    let hunks: Hunk[] = [];
    const keys: string[] = [];
    let count = 0;
    for (let round = 0; round < 5; round++) {
        if (round > 0) msgs = (await kernel.lintText(cur, options(false, true))).messages as unknown as Msg[];
        const fixes = pickAuto(msgs, cur, g);
        if (!fixes.length) break;
        for (const m of fixes) {
            keys.push(autoKey(m, cur));
            const [a, b] = m.fix!.range;
            const t = m.fix!.text;
            hunks = addHunk(hunks, cur, a, b, t);
            cur = cur.slice(0, a) + t + cur.slice(b);
            if (g && b <= g[0]) g = [g[0] + t.length - (b - a), g[1] + t.length - (b - a)];
        }
        count += fixes.length;
    }
    return { text: cur, count, hunks, keys };
}

/** Where position `p` of the text before the batch is after it. */
function mapThrough(hunks: Hunk[], p: number): number {
    let d = 0;
    for (const h of hunks) {
        const bs = h.s - d;
        const be = bs + h.orig.length;
        if (p < be || (p === be && p === bs)) return p <= bs ? p + d : h.e;
        d += h.e - h.s - h.orig.length;
    }
    return p + d;
}

/** The text node and offset at string offset `pos`, over however many text nodes the box has. */
function domPoint(pos: number): [Node, number] {
    let n = 0;
    for (const c of box.childNodes) {
        if (c.nodeType !== Node.TEXT_NODE) continue;
        const len = (c as Text).length;
        if (pos <= n + len) return [c, pos - n];
        n += len;
    }
    return pointAt(pos);
}

/**
 * Put a batch in the box. While the writer is in it, each changed line goes in with
 * «insertText», like typing, so the browser's own undo (Ctrl+Z) takes it back as well;
 * otherwise the text is replaced. Either way it is one step of «بازگشت».
 */
function applyBatch(before: string, batch: Batch) {
    const focused = document.activeElement === box;
    const c = focused ? caret() : null;
    const multiNode = [...box.childNodes].some((n) => n.nodeType !== Node.TEXT_NODE);
    // the regions to replace, in the old text: hunks on one line go together
    const regions: Array<{ s: number; e: number; t: string }> = [];
    let d = 0;
    for (const h of batch.hunks) {
        const bs = h.s - d;
        const be = bs + h.orig.length;
        d += h.e - h.s - h.orig.length;
        regions.push({ s: bs, e: be, t: batch.text.slice(h.s, h.e) });
    }
    // merge same-line neighbours (their text between is unchanged)
    const merged: typeof regions = [];
    for (const r of regions) {
        const last = merged[merged.length - 1];
        if (last && !before.slice(last.e, r.s).includes("\n")) {
            last.t += before.slice(last.e, r.s) + r.t;
            last.e = r.e;
        } else merged.push({ ...r });
    }
    let ok = false;
    if (focused && !multiNode && merged.every((r) => !r.t.includes("\n") && !before.slice(r.s, r.e).includes("\n"))) {
        applyingAuto = true;
        try {
            const sel = window.getSelection()!;
            for (const r of [...merged].reverse()) {
                const [a, ao] = domPoint(r.s);
                const [b, bo] = domPoint(r.e);
                const range = document.createRange();
                range.setStart(a, ao);
                range.setEnd(b, bo);
                sel.removeAllRanges();
                sel.addRange(range);
                document.execCommand(r.t ? "insertText" : "delete", false, r.t);
            }
        } finally {
            applyingAuto = false;
        }
        ok = readText() === batch.text;
        if (ok && box.childNodes.length !== 1) {
            box.normalize();
            ok = readText() === batch.text;
        }
    }
    if (!ok) input.value = batch.text;
    if (c !== null) setCaret(mapThrough(batch.hunks, c));
    history.push({ text: before, auto: { after: batch.text, hunks: batch.hunks, keys: batch.keys } });
    if (history.length > 50) history.shift();
    undoBtn.disabled = false;
    lastAuto = history[history.length - 1];
    autoFresh = true;
    showAutoNote(batch.count);
}

/**
 * Undo a batch, keeping what was typed after it: the hunks outside the stretch
 * that changed since are put back as they were.
 */
function revertBatch(entry: HistoryEntry, cur: string): string {
    const { after, hunks } = entry.auto!;
    if (cur === after) return entry.text;
    let p = 0;
    while (p < after.length && p < cur.length && after[p] === cur[p]) p++;
    let q = 0;
    while (q < after.length - p && q < cur.length - p && after[after.length - 1 - q] === cur[cur.length - 1 - q]) q++;
    const changedEnd = after.length - q;
    const delta = cur.length - after.length;
    let out = cur;
    for (const h of [...hunks].reverse()) {
        const shift = h.e <= p ? 0 : h.s >= changedEnd ? delta : null;
        if (shift === null) continue;
        const s = h.s + shift;
        const e = h.e + shift;
        if (out.slice(s, e) !== after.slice(h.s, h.e)) continue;
        out = out.slice(0, s) + h.orig + out.slice(e);
    }
    return out;
}

/** Undo an automatic batch: its fixes are declined, and nothing is fixed until the next keystroke. */
function undoAuto(entry: HistoryEntry) {
    const i = history.lastIndexOf(entry);
    if (i >= 0) history.splice(i, 1);
    undoBtn.disabled = history.length === 0;
    for (const k of entry.auto!.keys) declined.add(k);
    autoHold = true;
    hideAutoNote();
    const focused = document.activeElement === box;
    const c = focused ? caret() : null;
    const cur = input.value;
    const text = revertBatch(entry, cur);
    if (text !== cur) {
        input.value = text;
        if (c !== null) setCaret(Math.min(c + text.length - cur.length, text.length));
    }
    changesEl.hidden = true;
    void check().then(() => {
        status.textContent = "اصلاح خودکار برگشت داده شد.";
    });
}

// the quiet line after a batch: «۳ ایراد تایپی خودکار درست شد · بازگشت»
const autoNote = $<HTMLParagraphElement>("autofix");
const autoNoteText = $<HTMLSpanElement>("autofix-text");
let lastAuto: HistoryEntry | null = null;
/** Nothing was typed since the last batch: a Ctrl+Z now undoes it. */
let autoFresh = false;
let noteTimer: number | undefined;
function showAutoNote(n: number) {
    autoNoteText.textContent = `${n.toLocaleString("fa-IR")} ایراد تایپی خودکار درست شد`;
    autoNote.hidden = false;
    autoNote.classList.remove("fade");
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => {
        autoNote.classList.add("fade");
        noteTimer = window.setTimeout(() => (autoNote.hidden = true), 600);
    }, 5000);
}
function hideAutoNote() {
    window.clearTimeout(noteTimer);
    autoNote.hidden = true;
}
$<HTMLButtonElement>("autofix-undo").addEventListener("click", () => {
    if (lastAuto && history.includes(lastAuto)) undoAuto(lastAuto);
});
// a fix that waited for the word at the caret is made when the writer leaves the box
box.addEventListener("blur", () => {
    if (!autoBox.checked || !skippedAtCaret) return;
    skippedAtCaret = false;
    pendingAuto = "all";
    schedule();
});
try {
    autoBox.checked = stored("auto-fix") !== "off";
} catch {
    /* storage may be unavailable */
}
autoBox.addEventListener("change", () => {
    try {
        localStorage.setItem("vajban:auto-fix", autoBox.checked ? "on" : "off");
    } catch {
        /* storage may be unavailable */
    }
    if (!autoBox.checked) hideAutoNote();
    declined.clear(); // turned on again: a fresh start
    pendingAuto = autoBox.checked ? "all" : "none";
    autoHold = false;
    void check();
});

/**
 * Every automatic change can be undone.
 */
/** A saved setting; settings saved under the site's old name («dorostnevis:») still count. */
function stored(key: string): string | null {
    return localStorage.getItem("vajban:" + key) ?? localStorage.getItem("dorostnevis:" + key);
}

/** The text before a change; for an automatic batch, also what it changed (to undo just that). */
type HistoryEntry = { text: string; auto?: { after: string; hunks: Hunk[]; keys: string[] } };
const history: HistoryEntry[] = [];
const undoBtn = $<HTMLButtonElement>("undo");
const changesEl = $<HTMLDetailsElement>("changes");
function remember() {
    history.push({ text: input.value });
    if (history.length > 50) history.shift();
    undoBtn.disabled = false;
}
undoBtn.addEventListener("click", () => {
    const top = history[history.length - 1];
    if (top?.auto) return undoAuto(top);
    const prev = history.pop()?.text;
    if (prev === undefined) return;
    pendingAuto = "none";
    autoHold = true;
    hideAutoNote();
    input.value = prev;
    undoBtn.disabled = history.length === 0;
    changesEl.hidden = true;
    void check().then(() => {
        status.textContent = "تغییر برگشت داده شد.";
    });
});

function applyFix(m: Msg) {
    if (!m.fix) return;
    remember();
    const t = input.value;
    input.value = t.slice(0, m.fix.range[0]) + m.fix.text + t.slice(m.fix.range[1]);
    check();
}

// ---- the note that opens on a marked word ----
const editor = $<HTMLDivElement>("editor");
const reviewBtn = $<HTMLButtonElement>("review");
let openK = -1;

function markRects(k: number): DOMRect[] {
    const r = ranges[k];
    return r ? [...r.getClientRects()].filter((x) => x.width > 0 || x.height > 0) : [];
}

/** The marked span under a point, if any. */
function spanAt(x: number, y: number): number {
    for (let k = 0; k < spans.length; k++) {
        if (markRects(k).some((r) => x >= r.left - 2 && x <= r.right + 2 && y >= r.top && y <= r.bottom)) return k;
    }
    return -1;
}

function closePopover() {
    pop.hidden = true;
    const was = openK;
    openK = -1;
    if (was >= 0) paintMarks();
}

function openPopover(k: number, x?: number, y?: number) {
    const sp = spans[k];
    if (!sp) return closePopover();
    openK = k;
    paintMarks();
    const fa = (n: number) => n.toLocaleString("fa-IR");
    pop.innerHTML =
        `<div class="pop-nav">
            <button type="button" data-nav="-1" ${k === 0 ? "disabled" : ""} aria-label="ایراد قبلی">→ قبلی</button>
            <span>${fa(k + 1)} از ${fa(spans.length)}</span>
            <button type="button" data-nav="1" ${k === spans.length - 1 ? "disabled" : ""} aria-label="ایراد بعدی">بعدی ←</button>
            <span class="grow"></span>
            <button type="button" class="pop-close" data-close aria-label="بستن">×</button>
        </div>` + sp.items.map((i) => `<div class="${cards[i].cls}">${cards[i].html}</div>`).join("");
    pop.hidden = false;
    place(k, x, y);
}

/** Under the word (above it if there is no room below), its right edge on the word's right edge. */
function place(k: number, x?: number, y?: number) {
    const rects = markRects(k);
    if (!rects.length) return;
    let r = rects[0];
    if (y !== undefined) r = rects.reduce((best, c) => (Math.abs((c.top + c.bottom) / 2 - y) < Math.abs((best.top + best.bottom) / 2 - y) ? c : best));
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    const vw = document.documentElement.clientWidth;
    let left = Math.min(Math.max(8, r.right - pw), vw - pw - 8);
    let top = r.bottom + 10;
    const above = top + ph > window.innerHeight - 8 && r.top - ph - 10 > 8;
    if (above) top = r.top - ph - 10;
    pop.classList.toggle("above", above);
    const arrow = Math.min(Math.max(16, (x ?? (r.left + r.right) / 2) - left), pw - 16);
    pop.style.setProperty("--arrow-x", `${arrow}px`);
    pop.style.left = `${left + window.scrollX}px`;
    pop.style.top = `${top + window.scrollY}px`;
}

function goTo(k: number) {
    const r = markRects(k)[0];
    if (!r) return;
    window.scrollTo({ top: window.scrollY + r.top - window.innerHeight / 2 });
    openPopover(k);
}

box.addEventListener("click", (ev) => {
    if (!input.collapsed) return;
    const k = spanAt(ev.clientX, ev.clientY);
    if (k < 0) return closePopover();
    openPopover(k, ev.clientX, ev.clientY);
});
// a pointer over a marked word says it can be clicked
box.addEventListener("mousemove", (ev) => {
    box.style.cursor = spanAt(ev.clientX, ev.clientY) >= 0 ? "pointer" : "";
});
document.addEventListener("click", (ev) => {
    const t = ev.target as Node;
    if (pop.hidden || pop.contains(t) || box.contains(t)) return;
    closePopover();
});
document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !pop.hidden) {
        closePopover();
        input.focus();
    }
});
window.addEventListener("resize", () => {
    if (openK >= 0) place(openK);
});
reviewBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    goTo(0);
});

pop.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement;
    const nav = target.closest("[data-nav]") as HTMLElement | null;
    if (nav) return goTo(openK + Number(nav.dataset.nav));
    if (target.closest("[data-close]")) return closePopover();
    const a = target.closest("[data-apply]") as HTMLElement | null;
    const ig = target.closest("[data-ignore]") as HTMLElement | null;
    const rp = target.closest("[data-report]") as HTMLElement | null;
    if (a) {
        applyFix(messages[Number(a.dataset.apply)]);
        status.textContent = "اصلاح شد.";
    }
    if (rp) {
        const i = Number(rp.dataset.report);
        const members = [messages[i], ...extras[i]];
        const text = input.value;
        closePopover();
        void openReport(reports[i]).then((ok) => {
            if (!ok || input.value !== text) return;
            // a reported card goes away like an ignored one
            for (const x of members) ignored.add(key(x, text));
            void check().then(() => {
                status.textContent = "گزارش رسید. سپاس!";
            });
        });
    }
    if (ig) {
        const i = Number(ig.dataset.ignore);
        for (const x of [messages[i], ...extras[i]]) ignored.add(key(x, input.value));
        check();
    }
});


// ---- theme: light unless the reader picks dark ----
const themeBtn = $<HTMLButtonElement>("theme");
function showTheme() {
    themeBtn.textContent = document.documentElement.dataset.theme === "dark" ? "روشن" : "تیره";
}
themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
        localStorage.setItem("vajban:theme", next);
    } catch {
        /* storage may be unavailable */
    }
    showTheme();
});
showTheme();

// ---- the Kahroba face, served beside the page; Vazirmatn until it arrives ----
fetch("kahroba.woff2")
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((buf) => new FontFace("Kahroba", buf, { weight: "100 900", stretch: "87.5% 125%" }).load())
    .then((face) => {
        document.fonts.add(face);
        if (openK >= 0) place(openK);
    })
    .catch(() => undefined);

applyAllBtn.addEventListener("click", async () => {
    status.textContent = "در حال اعمال…";
    // what is about to change, for the list after
    const planned = spans
        .filter((sp) => sp.red)
        .map((sp) => reports[sp.items.find((i) => messages[i].fix && !isStyle(messages[i])) ?? sp.items[0]])
        .filter((r) => r && r.suggestion && r.suggestion !== r.original);
    remember();
    // one fix can make another possible («همه دفترهارا» → «همه دفترها را» → «همۀ دفترها را»)
    let text = input.value;
    for (let round = 0; round < 3; round++) {
        const next = (await kernel.fixText(text, options(true))).output;
        if (next === text) break;
        text = next;
    }
    input.value = text;
    await check();
    status.textContent = `${planned.length.toLocaleString("fa-IR")} اصلاح قطعی اعمال شد.`;
    const list = changesEl.querySelector("ol")!;
    list.replaceChildren(
        ...planned.map((r) => {
            const li = document.createElement("li");
            li.textContent = `${r.original} ← ${r.suggestion}`;
            return li;
        })
    );
    changesEl.hidden = planned.length === 0;
});

copyBtn.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(input.value);
        status.textContent = "متن رونوشت شد.";
    } catch {
        input.select();
        status.textContent = "متن انتخاب شد؛ با Ctrl+C رونوشت کنید.";
    }
});

$<HTMLButtonElement>("sample").addEventListener("click", () => {
    input.value = mode.value === "dialogue" ? SAMPLE_DIALOGUE : SAMPLE;
    ignored = new Set();
    pendingAuto = "all";
    autoHold = false;
    check();
});
$<HTMLButtonElement>("clear").addEventListener("click", () => {
    input.value = "";
    ignored = new Set();
    check();
    input.focus();
});

box.addEventListener("input", (ev) => {
    if (applyingAuto) return; // an automatic batch going in
    const type = (ev as InputEvent).inputType ?? "";
    if (type === "historyUndo" || type === "historyRedo") {
        // Ctrl+Z right after an automatic batch: the writer did not want it
        if (type === "historyUndo" && autoFresh && lastAuto && history[history.length - 1] === lastAuto) {
            for (const k of lastAuto.auto!.keys) declined.add(k);
            if (input.value === lastAuto.text) history.pop();
            undoBtn.disabled = history.length === 0;
            autoFresh = false;
            hideAutoNote();
        }
        autoHold = true;
    } else {
        autoHold = false;
        autoFresh = false; // typed since: Ctrl+Z now takes back the typing first
        const data = (ev as InputEvent).data ?? "";
        lastBoundary = pasted || /^insert(Paragraph|LineBreak)$/.test(type) || /[\s.,،؛;:!?؟»)\]…"]$/.test(data);
        pendingAuto = pasted || pendingAuto === "all" ? "all" : "typing";
        pasted = false;
    }
    lastInputAt = Date.now();
    if (composing) return; // the IME is still composing a word: check when it is done
    normalizeBox();
    box.classList.toggle("is-empty", input.value === "");
    closePopover();
    changesEl.hidden = true;
    // the old marks would sit on shifted text: none until the check is done
    clearMarks();
    schedule();
});
[showZwnj, pluralMode, ezafeStyle].forEach((el) => el.addEventListener("change", check));
// which language-editing rules are on: remembered per browser
try {
    const off = JSON.parse(stored("style-off") || "[]") as string[];
    for (const b of styleBoxes) b.checked = !off.includes(b.dataset.rule!);
} catch {
    /* storage may be unavailable */
}
for (const b of styleBoxes) {
    b.addEventListener("change", () => {
        try {
            localStorage.setItem("vajban:style-off", JSON.stringify(styleBoxes.filter((x) => !x.checked).map((x) => x.dataset.rule)));
        } catch {
            /* storage may be unavailable */
        }
        check();
    });
}
mode.addEventListener("change", () => {
    try {
        localStorage.setItem("vajban:mode", mode.value);
    } catch {
        /* storage may be unavailable */
    }
    check();
});
try {
    mode.value = stored("mode") || "formal";
} catch {
    /* storage may be unavailable */
}

let initial = SAMPLE;
try {
    initial = stored("draft") || SAMPLE;
} catch {
    /* storage may be unavailable */
}
input.value = initial;
check();
void setupOwnerPanel();
