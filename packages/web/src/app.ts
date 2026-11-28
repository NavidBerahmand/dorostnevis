/**
 * واج‌بان (vajban.com) — the web page. Runs textlint with the Farhangestan preset entirely
 * in the browser: nothing typed here leaves the page.
 */
import { TextlintKernel } from "@textlint/kernel";
import { loadSpellingLexicon } from "../../textlint-rule-preset-farhangestan/src/util/speller";
import { openReport, sentenceAround, setupOwnerPanel, Report } from "./report";
import {
    Msg, Settings, lintText, isAuto, isStyle, isEditing, baseRule, wordAround, splitMessage, NOT_IN_BOOK, rank,
    conflictsOf, outranked, editsOf, applyFix as applyEdit, isTentative, isCertainMsg, applyCertain, isBlue,
    oneAnswerPerSpan, severity, Grouped, undoesJustApplied, JustApplied, REGISTER_RULES
} from "./lint-setup";
import { RULE_LABELS, explainChange } from "./labels";




const kernel = new TextlintKernel();

/** Stroke icons in the text colour (the toolbar buttons and the popover's «ویرایش»). */
const svg = (d: string) =>
    `<svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
    pencil: svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
    // «همه»: the same change at every place (stacked copies)
    all: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/><path d="M11 14l2 2 4-4"/>'),
    // the question on a colloquial card: a speech bubble
    talk: svg('<path d="M4 5h16v10H9l-5 4z"/>')
};
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
const pluralHelp = $<HTMLParagraphElement>("plural-help");
const applyAllBtn = $<HTMLButtonElement>("apply-all");
const copyBtn = $<HTMLButtonElement>("copy");
const pasteBtn = $<HTMLButtonElement>("paste");
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
/** A message with the other replacements its rule offers («گاه»، «گاهی»، «احیاناً»): one button each. */
type Card = Msg & { alts?: Msg[] };
/**
 * A suggestion with several replacements comes as one report per replacement (pattern-rule's
 * `alternatives`): the same rule, range and message. Each went through the no-ping-pong guard
 * by itself; the ones left make one card.
 */
function collapseAlts(msgs: Grouped[]): Card[] {
    // one rule's alternatives, or reports of several rules that disagree on one word (oneAnswerPerSpan's `group`)
    const keyOf = (m: Grouped) => (m.group ? `group|${m.group}` : `${m.ruleId}|${m.range}|${m.message.replace(/[\u2063\u2064]/g, "")}`);
    const groups = new Map<string, Msg[]>();
    for (const m of msgs) {
        if (!m.fix) continue;
        const k = keyOf(m);
        groups.set(k, [...(groups.get(k) ?? []), m]);
    }
    const out: Card[] = [];
    const done = new Set<Msg>();
    for (const m of msgs) {
        if (done.has(m)) continue;
        const k = m.fix ? keyOf(m) : "";
        const g = k ? groups.get(k)! : [m];
        if (g.length < 2 || !g.some((x) => /^\u2064?\u2063/.test(x.message))) {
            out.push(m);
            done.add(m);
            continue;
        }
        // the certain one (no mark), if any, leads: it keeps the card red and «درست‌کن» makes it.
        // A group of several rules: in the order oneAnswerPerSpan gave (precedence), the same replacement once
        const grouped = !!(m as Grouped).group;
        const sorted = grouped
            ? g.filter((x, i) => g.findIndex((y) => applyEdit(input.value, y.fix!) === applyEdit(input.value, x.fix!)) === i)
            : [...g].sort((a, b) => a.message.length - b.message.length);
        for (const x of g) done.add(x);
        out.push({ ...sorted[0], alts: sorted });
    }
    return out;
}

/** What «این پیشنهاد غلط است» would send for each card. */
let reports: Report[] = [];
let timer: number | undefined;

const styleBoxes = [...document.querySelectorAll<HTMLInputElement>("#style-rules input[data-rule]")];

// اصلاح خودکار ایرادهای تایپی (AUTO_FIX, isAuto): see lint-setup.ts

/** Which fix this is, wherever it sits: the rule, the word and its corrected form. */
function autoKey(m: Msg, text: string): string {
    const [s, e] = wordAround(text, m.fix!.range[0], m.fix!.range[1]);
    return `${m.ruleId}|${text.slice(s, e)}|${text.slice(s, m.fix!.range[0])}${m.fix!.text}${text.slice(m.fix!.range[1], e)}`;
}

/** The page's settings, as the rules take them. */
function settings(): Settings {
    return {
        register: "auto",
        pluralMode: pluralMode.value,
        styleOn: (id) => styleBoxes.find((b) => b.dataset.rule === id)?.checked !== false,
        colloquialText: colloquial === true
    };
}

/*
 * «کل متن محاوره‌ای است؟» (since 1.6.2). The register is found per sentence, and a short spoken line with one
 * spoken word («اون ناپدید شد؟»، «هنوز تموم نشده») is often read as written (a quarter of the spoken lines of
 * film subtitles): its spoken words then get blue cards. So a colloquial card asks once whether the whole text
 * is colloquial. «بله»: spoken words are correct everywhere (no register card, no «رو»/«اون» card; the rules
 * that run per sentence do not change, so the narration of a story is still checked as written prose).
 * «نه»: nothing changes and the question is not asked again. The answer belongs to this text: it is kept
 * with the draft, shown (and changed) by the «محاوره‌ای» toggle above the editor, and forgotten when the
 * editor is emptied.
 */
let colloquial: boolean | null = null;
const colloqToggle = $<HTMLLabelElement>("colloq-toggle");
const colloqBox = $<HTMLInputElement>("colloq");
function setColloquial(v: boolean | null) {
    colloquial = v;
    colloqToggle.hidden = v === null;
    colloqBox.checked = v === true;
    try {
        if (v === null) localStorage.removeItem("vajban:colloquial");
        else localStorage.setItem("vajban:colloquial", v ? "yes" : "no");
    } catch {
        /* storage may be unavailable */
    }
}
colloqBox.addEventListener("change", () => {
    setColloquial(colloqBox.checked);
    void check();
});
/** Lint as the page does (the register found per sentence); `autoOnly` keeps the automatic fixes. */
function lint(text: string, autoOnly = false): Promise<Msg[]> {
    return lintText(kernel, text, settings(), false, autoOnly);
}

function esc(s: string): string {
    return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** Text with ZWNJs drawn as a visible mark, if the reader asked for it. */
function show(s: string): string {
    const e = esc(s);
    return showZwnj.checked ? e.replace(/‌/g, '<span class="zw" aria-label="نیم‌فاصله">‌</span>') : e;
}

/** A run of text that carries a highlighter mark, and the cards it opens. */
type Span = { s: number; e: number; items: number[]; red: boolean; blue?: boolean; sentence?: boolean };
/** Notes about a whole sentence («جملۀ بلند»): their own layer, a dotted line under the sentence, never a word's highlight. */
const SENTENCE_RULES = new Set(["long-sentences"]);
const isSentenceNote = (m: Msg) => SENTENCE_RULES.has(baseRule(m.ruleId));
/** The sentence around a report: from the mark before it to the mark after it. */
function sentenceSpan(text: string, s: number, e: number): [number, number] {
    const END = /[.!?؟؛\n]/;
    let a = s;
    while (a > 0 && !END.test(text[a - 1])) a--;
    while (a < s && /\s/.test(text[a])) a++;
    let b = e;
    while (b < text.length && !END.test(text[b])) b++;
    return [a, b];
}
let spans: Span[] = [];

/** The word(s) a card is about: the reported range plus the corrected one. */
function cardSpan(m: Msg, text: string): [number, number] {
    // a report on a mark alone («باز شده و بسته نشده» on «»») is painted on that mark, wherever its fix goes
    if (!/[\p{L}\p{N}]/u.test(text.slice(m.range[0], m.range[1])) && m.range[1] - m.range[0] <= 2) return m.range;
    // a fix that goes somewhere else (a long sentence split at its middle) does not stretch the mark
    const far = m.fix && (m.fix.range[0] > m.range[1] + 1 || m.fix.range[1] < m.range[0] - 1);
    if (!m.fix || far) return wordAround(text, m.range[0], m.range[1]);
    return wordAround(text, Math.min(m.range[0], m.fix.range[0]), Math.max(m.range[1], m.fix.range[1]));
}

/**
 * Red: the book's own rules and lists say it is wrong («اعمال همه» fixes it).
 * Yellow: a model's guess, a possible typo, a judgement of meaning, a style note.
 */
function isCertain(i: number): boolean {
    return [messages[i], ...extras[i]].some(isCertainMsg);
}
/** Blue: every report on the card is a recommendation, not an error («پیشنهاد»). */
function isAdvice(i: number): boolean {
    return [messages[i], ...extras[i]].every(isBlue);
}

/** A card's colour: 0 red, 1 yellow, 2 blue (the same test as its class in buildCards). */
function cardSeverity(i: number): number {
    return isCertain(i) ? 0 : isAdvice(i) ? 2 : 1;
}
/** A card's precedence (lint-setup.ts, rank): its highest rule's. */
function cardRank(i: number): number {
    return Math.min(...[messages[i], ...extras[i]].map(rank));
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
            const sentence = isSentenceNote(m);
            const [s, e] = sentence ? sentenceSpan(text, m.range[0], m.range[1]) : cardSpan(m, text);
            return { s, e, i, sentence };
        })
        .sort((a, b) => a.s - b.s || b.e - a.e);
    // words and sentences are two layers: a sentence note never merges with a word's mark
    const words: Span[] = [];
    const sentences: Span[] = [];
    for (const it of items) {
        const layer = it.sentence ? sentences : words;
        const last = layer[layer.length - 1];
        if (last && it.s < last.e) {
            last.e = Math.max(last.e, it.e);
            last.items.push(it.i);
            last.red = last.red || isCertain(it.i);
            last.blue = last.blue && isAdvice(it.i);
        } else {
            layer.push({ s: it.s, e: it.e, items: [it.i], red: isCertain(it.i), blue: isAdvice(it.i), sentence: it.sentence });
        }
    }
    // the cards of one mark: red, then yellow, then blue; within a colour by precedence (1.5.2: the
    // red card that made the mark red is on top). The mark has the colour of its first card.
    for (const sp of [...words, ...sentences]) {
        sp.items.sort((a, b) => cardSeverity(a) - cardSeverity(b) || cardRank(a) - cardRank(b) || messages[a].range[0] - messages[b].range[0]);
        sp.red = cardSeverity(sp.items[0]) === 0;
        sp.blue = cardSeverity(sp.items[0]) === 2;
    }
    // «قبلی/بعدی» go through both, in reading order (a sentence's note before its words)
    spans = [...words, ...sentences].sort((a, b) => a.s - b.s || Number(!!b.sentence) - Number(!!a.sentence));
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

const MARK_NAMES = ["vb-red", "vb-yellow", "vb-blue", "vb-red-open", "vb-yellow-open", "vb-blue-open", "vb-zwnj", "vb-sentence", "vb-sentence-open"];
function paintMarks() {
    if (!HIGHLIGHTS) return;
    const H = (window as any).Highlight;
    const reg = (CSS as any).highlights;
    const groups: Record<string, Range[]> = Object.fromEntries(MARK_NAMES.map((n) => [n, [] as Range[]]));
    const colour = (sp: Span) => (sp.red ? "red" : sp.blue ? "blue" : "yellow");
    spans.forEach((sp, k) => groups[sp.sentence ? `vb-sentence${k === openK ? "-open" : ""}` : `vb-${colour(sp)}${k === openK ? "-open" : ""}`].push(ranges[k]));
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
    if (HIGHLIGHTS) for (const n of MARK_NAMES) (CSS as any).highlights.delete(n);
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
    return `<div class="confidence" role="img" aria-label="قاعدۀ صریح کتاب" title="این اصلاح را قاعدۀ صریح کتاب می‌گوید؛ احتمالی در کار نیست.">
                <span class="confidence-label">قاعدۀ کتاب</span>
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
const isRecommendation = (m: Msg) => m.ruleId === "plural-ha" && /توصیه/.test(m.message);

/** Why a card has no circles, in a few words. */
function noMeterReason(m: Msg): string {
    if (m.ruleId === "spelling") return "حدس غلط‌یاب است، نه قاعده";
    if (isRecommendation(m)) return "توصیۀ کتاب است، نه الزام";
    if (m.ruleId === "may-break") return "پیشنهاد سبکی است، نه غلط";
    if (isEditing(m) && !isStyle(m)) return "خطای قطعی ویرایشی است؛ در دستور خط نیامده";
    if (m.ruleId === "punctuation" || NOT_IN_BOOK.test(splitMessage(m).source)) return "قرارداد رایج است، نه کتاب";
    if (isStyle(m)) return "توصیۀ ویرایشی است، نه قاعدۀ کتاب";
    return "به معنای جمله بستگی دارد";
}

function meterFor(m: Msg, p: number | null): string {
    if (p !== null) return confidenceMeter(p);
    if (m.fix && !isTentative(m) && m.ruleId !== "punctuation" && m.ruleId !== "invisible" && !isStyle(m) && !NOT_IN_BOOK.test(splitMessage(m).source)) return bookMeter();
    return `<div class="confidence confidence-none" title="این کارت درجۀ اطمینان ندارد: ${noMeterReason(m)}.">
                <span class="confidence-label">درجه ندارد</span>
                <span class="confidence-why">${noMeterReason(m)}</span>
            </div>`;
}

/** Card i's HTML and class, shown in the note when its word is clicked. */
let cards: Array<{ cls: string; html: string }> = [];

/** A long stretch (an unclosed «« and its sentence) shown by its ends. */
function clip(s: string, max = 40): string {
    if (s.length <= max) return s;
    const h = Math.floor((max - 1) / 2);
    return s.slice(0, h) + "…" + s.slice(-h);
}

/**
 * «همه (n)» (since 1.6.2): the cards that make the same change: the same rule on the same word with the same
 * replacement buttons. A different rule or another replacement is another card and is never touched.
 */
let sameCards: number[][] = [];
function cardSignature(i: number, text: string): string | null {
    const m = messages[i];
    if (!m.fix) return null;
    const [ws, we] = wordAround(text, Math.min(m.range[0], m.fix.range[0]), Math.max(m.range[1], m.fix.range[1]));
    const fixedBy = (x: Msg) => text.slice(ws, x.fix!.range[0]) + x.fix!.text + text.slice(x.fix!.range[1], we);
    const alts = (m as Card).alts ?? [m];
    return [[m, ...extras[i]].map((x) => x.ruleId).join(","), cardSeverity(i), text.slice(ws, we), ...alts.map(fixedBy)].join("\u0000");
}
function groupSameCards(text: string) {
    const groups = new Map<string, number[]>();
    const sigs = messages.map((_, i) => cardSignature(i, text));
    sigs.forEach((g, i) => g !== null && groups.set(g, [...(groups.get(g) ?? []), i]));
    sameCards = sigs.map((g, i) => (g === null ? [i] : groups.get(g)!));
}
/** Is the writer asked, on this card, whether the whole text is colloquial? */
const asksRegister = (i: number) => colloquial === null && [messages[i], ...extras[i]].some((x) => REGISTER_RULES.has(x.ruleId));

function buildCards(text: string) {
    cards = [];
    reports = [];
    groupSameCards(text);
    messages.forEach((m, i) => {
        const split = splitMessage(m);
        const members = [m, ...extras[i]];
        const sources = [...new Set(members.map((x) => splitMessage(x).source).filter(Boolean))];
        const source = sources.join(" | ");
        const labels = [...new Set(members.map((x) => RULE_LABELS[baseRule(x.ruleId)] ?? x.ruleId))];
        const { msg, p } = takeConfidence(split.text);
        // a book rule agreeing with a model's guess: the book's certainty
        const bookAgrees = [m, ...extras[i]].some(
            (x) => x.fix && !isTentative(x) && x.ruleId !== "punctuation" && x.ruleId !== "invisible" && !isStyle(x) && !NOT_IN_BOOK.test(splitMessage(x).source)
        );
        const meter = bookAgrees ? bookMeter() : meterFor(m, p);
        const styleOnly = members.every(isStyle);
        // a flat error by an editing book («با این وجود»، «مثمر ثمر»): red, and applied with the rest
        const editingCertain = !styleOnly && members.some((x) => isEditing(x) && !isStyle(x));
        const certain = cardSeverity(i) === 0;
        const advice = cardSeverity(i) === 2;
        const cls = (advice ? "issue issue-style" : certain ? "issue" : "issue issue-judge") + (m.fix ? "" : " no-fix") + (meter.includes("confidence-none") ? " has-note" : " has-confidence");
        // show the whole word around the change, so «ي ← ی» reads «رييس ← رئیس»
        const [ws, we] = wordAround(text, Math.min(m.range[0], m.fix?.range[0] ?? m.range[0]), Math.max(m.range[1], m.fix?.range[1] ?? m.range[1]));
        const fixedBy = (x: Msg) => text.slice(ws, x.fix!.range[0]) + x.fix!.text + text.slice(x.fix!.range[1], we);
        const original = text.slice(ws, we);
        const fixed = m.fix ? fixedBy(m) : "";
        const alts = (m as Card).alts;
        // a change that looks the same on both sides: said in words too (1.5.2)
        const unseen = m.fix && !(alts && alts.length > 1) ? explainChange(original, fixed) : null;
        reports.push({
            rule: members.map((x) => x.ruleId).join(", "),
            ruleLabel: labels.join("، "),
            message: msg,
            source,
            original,
            suggestion: fixed,
            context: sentenceAround(text, ws, we),
            comment: "",
            mode: "auto",
            at: ""
        });
        const html = `
            ${meter}
            <div class="issue-head">
                ${labels.map((l) => `<span class="chip">${esc(l)}</span>`).join("")}
                ${styleOnly ? '<span class="chip chip-advice">ویرایش زبانی · پیشنهاد</span>' : editingCertain ? '<span class="chip">ویرایش زبانی · غلط قطعی</span>' : certain ? "" : advice ? `<span class="chip chip-advice">${isRecommendation(m) ? "توصیۀ کتاب · پیشنهاد" : m.ruleId === "may-break" ? "پیشنهاد سبکی" : "پیشنهاد"}</span>` : '<span class="chip chip-judge">نیازمند تشخیص</span>'}
            </div>
            <p class="change">
                <span class="from">${show(clip(original)) || "&nbsp;"}</span>
                ${m.fix ? `<span class="arrow" aria-hidden="true">←</span><span class="to">${(alts ?? [m]).map((x) => show(clip(fixedBy(x))) || "(حذف)").join('<span class="or"> یا </span>')}</span>` : ""}
            </p>
            ${unseen ? `<p class="change change-words"><span class="from">${esc(unseen[0])}</span><span class="arrow" aria-hidden="true">←</span><span class="to">${esc(unseen[1])}</span></p>` : ""}
            <p class="msg">${esc(msg)}</p>
            ${sources.map((src) => `<p class="source">${citation(src)}</p>`).join("")}
            <div class="actions">
                ${alts && alts.length > 1
                    ? alts.map((x, j) => `<button type="button" class="btn btn-small" data-alt="${i}:${j}" title="جایگزین با «${esc(fixedBy(x))}»">${show(clip(fixedBy(x), 18))}</button>`).join("")
                    : m.fix ? `<button type="button" class="btn btn-small" data-apply="${i}">جایگزین</button>` : ""}
                ${allButton(i, !!(alts && alts.length > 1))}
                <button type="button" class="btn btn-small btn-quiet" data-ignore="${i}">نادیده</button>
                ${members.some((x) => x.ruleId === "spelling") ? `<button type="button" class="btn btn-small btn-quiet" data-learn="${i}" title="«${esc(text.slice(m.range[0], m.range[1]))}» دیگر در این مرورگر علامت نمی‌خورد">افزودن به واژه‌نامه</button>` : ""}
                <button type="button" class="btn btn-small btn-quiet btn-edit" data-edit="${i}" title="ویرایش همین واژه با صفحه‌کلید">${ICON.pencil}ویرایش</button>
                <button type="button" class="btn btn-small btn-report" data-report="${i}">این پیشنهاد غلط است</button>
            </div>
            ${asksRegister(i) ? `<div class="ask" role="group" aria-label="کل متن محاوره‌ای است؟"><span class="ask-q" title="«بله»: واژه‌های محاوره‌ای در همۀ متن درست‌اند و علامت نمی‌خورند. «نه»: همین‌طور می‌ماند. با «محاوره‌ای» بالای متن عوض می‌شود.">${ICON.talk}کل متن محاوره‌ای است؟</span><button type="button" class="btn btn-small btn-quiet" data-colloq="yes">بله</button><button type="button" class="btn btn-small btn-quiet" data-colloq="no">نه</button></div>` : ""}`;
        cards.push({ cls, html });
    });
    const red = spans.filter((sp) => sp.red).length;
    const blue = spans.filter((sp) => !sp.red && sp.blue).length;
    const yellow = spans.length - red - blue;
    const fa = (n: number) => n.toLocaleString("fa-IR");
    summary.innerHTML =
        spans.length === 0
            ? "ایرادی پیدا نشد. متن با قواعدی که این ابزار می‌شناسد سازگار است."
            : `<span>${fa(spans.length)} واژه یا عبارت</span>` +
              `<span class="key"><span class="swatch swatch-red"></span>${fa(red)} غلط قطعی</span>` +
              `<span class="key"><span class="swatch swatch-yellow"></span>${fa(yellow)} شاید غلط</span>` +
              `<span class="key"><span class="swatch swatch-blue"></span>${fa(blue)} پیشنهاد</span>`;
    applyAllBtn.disabled = red === 0;
    reviewBtn.disabled = spans.length === 0;
}

/** «همه (n)»: one tap makes the change at every place; on a card with several buttons it says «the next button: everywhere». */
function allButton(i: number, several: boolean): string {
    const n = sameCards[i]?.length ?? 1;
    if (n < 2 || !messages[i].fix) return "";
    const fa = n.toLocaleString("fa-IR");
    return several
        ? `<button type="button" class="btn btn-small btn-quiet btn-all" data-all-toggle="${i}" aria-pressed="false" title="جایگزینی که انتخاب می‌کنید در هر ${fa} جای متن انجام شود">${ICON.all}همه (${fa})</button>`
        : `<button type="button" class="btn btn-small btn-quiet btn-all" data-all="${i}" title="همین جایگزینی در هر ${fa} جای متن">${ICON.all}همه (${fa})</button>`;
}

let ignored = new Set<string>();

/**
 * واژه‌نامۀ شخصی (since 1.5.0): words the writer added from a spelling card are never marked as
 * unknown again, in this browser («vajban:dictionary»).
 */
const personal = new Set<string>();
try {
    for (const w of JSON.parse(localStorage.getItem("vajban:dictionary") || "[]") as string[]) personal.add(w);
} catch {
    /* storage may be unavailable */
}
function learn(word: string) {
    personal.add(word);
    try {
        localStorage.setItem("vajban:dictionary", JSON.stringify([...personal]));
    } catch {
        /* storage may be unavailable: the word is still left alone until the page is closed */
    }
}
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
    let result = { messages: await lint(text) };
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
                    result = { messages: await lint(text) };
                }
            }
        }
    }
    const guarded = await visible(text, result.messages as unknown as Msg[]);
    if (input.value !== text) return; // typed meanwhile: the next check starts over
    const merged = mergeSame(collapseAlts(guarded), text);
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

/** What the page shows for `msgs` (a lint of `text`): not ignored, not made silently, nothing that ping-pongs. */
async function visible(text: string, msgs: Msg[]): Promise<Msg[]> {
    const shown = msgs.filter((m) => !((m.ruleId === "spelling" || m.ruleId === "typing-shortcuts") && personal.has(text.slice(...wordAround(text, m.range[0], m.range[1])))) && !ignored.has(key(m, text)) && !(autoBox.checked && isAuto(m, text) && !declined.has(autoKey(m, text))));
    const sk = settingsKey();
    const pieceLint = async (piece: string): Promise<Msg[]> => {
        const k = sk + "\0" + piece;
        let r = pieceCache.get(k);
        if (!r) {
            r = await lint(piece);
            if (pieceCache.size > 4000) pieceCache.clear();
            pieceCache.set(k, r);
        }
        return r;
    };
    // never two cards that contradict on one word (1.5.2)
    return oneAnswerPerSpan(pieceLint, text, await noPingPong(text, shown), (s, e) => pieceAround(text, s, e));
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
        if (round > 0) msgs = await lint(cur, true);
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

function applyFix(m: Msg, extra: Msg[] = extrasOf(m) ?? []) {
    if (!m.fix) return;
    remember();
    const t = input.value;
    const after = applyEdit(t, m.fix);
    // what was just changed, and by how high a rule: nothing lower may ask for it back
    let d = 0;
    const spans: Array<[number, number]> = [];
    for (const e of editsOf(t, m.fix.range, m.fix.text)) {
        spans.push([e.pos + d, e.pos + d + e.inserted.length]);
        d += e.inserted.length - e.removed.length;
    }
    justApplied = { before: t, after, spans, rank: Math.min(...[m, ...extra].map(rank)) };
    input.value = after;
    check();
}
const extrasOf = (m: Msg) => extras[messages.indexOf(m)];

/**
 * «همه (n)»: card i's replacement (its button j) at every place the same card is, in one step of «بازگشت».
 * The places are the cards of sameCards[i] (same rule, same word, same buttons): nothing else is touched.
 */
function applyEverywhere(i: number, j: number): number {
    const text = input.value;
    const fixes: Array<{ range: [number, number]; text: string }> = [];
    const ranks: number[] = [];
    for (const k of sameCards[i] ?? [i]) {
        const c = messages[k] as Card;
        const x = c.alts ? c.alts[j] : c;
        if (!x?.fix || applyEdit(text, x.fix) === text) continue;
        fixes.push(x.fix);
        ranks.push(...[x, ...extras[k]].map(rank));
    }
    fixes.sort((a, b) => a.range[0] - b.range[0]);
    const pick: typeof fixes = [];
    let end = -1;
    for (const f of fixes) {
        if (f.range[0] < end) continue;
        pick.push(f);
        end = f.range[1];
    }
    if (!pick.length) return 0;
    remember();
    // the letters put in, in the text after all the changes (for the no-ping-pong guard)
    let d = 0;
    const spans: Array<[number, number]> = [];
    for (const f of pick) {
        for (const e of editsOf(text, f.range, f.text)) {
            spans.push([e.pos + d, e.pos + d + e.inserted.length]);
            d += e.inserted.length - e.removed.length;
        }
    }
    let after = text;
    for (const f of [...pick].reverse()) after = applyEdit(after, f);
    justApplied = { before: text, after, spans, rank: Math.min(...ranks) };
    input.value = after;
    void check();
    return pick.length;
}

/*
 * No ping-pong (since 1.3.1). A suggestion is never shown if making it would be taken back:
 * by its own rule over a further step, by a rule of the same or higher precedence, or if a
 * higher rule would find fault with what it puts in (precedence: دستور خط and فرهنگ املایی,
 * then the other rules of the book, ویرایش زبانی, conventions not in the book, the spelling
 * checker; lint-setup.ts, rank). Nor anything that asks back a fix the writer just made.
 * The same check runs over thousands of sentences in the tests (test/no-ping-pong-test.ts),
 * so this is a safety net: it re-lints only the sentence around each fix, and remembers.
 */
let justApplied: JustApplied | null = null;
const pieceCache = new Map<string, Msg[]>();
const verdictCache = new Map<string, boolean>();
const settingsKey = () => JSON.stringify([pluralMode.value, styleBoxes.map((b) => b.checked), colloquial === true]);
/**
 * The line around [s, e) (at most ~1400 letters): whether a sentence is spoken depends on the
 * sentences beside it in its line (1.5.0), so the piece is re-linted with them.
 */
function pieceAround(text: string, s: number, e: number): [number, number] {
    const END_MARK = /\n/;
    let a = s;
    while (a > 0 && s - a < 700 && !END_MARK.test(text[a - 1])) a--;
    let b = e;
    while (b < text.length && b - e < 700 && !END_MARK.test(text[b])) b++;
    if (b < text.length) b++; // with its full stop
    return [a, b];
}
async function noPingPong(text: string, msgs: Msg[]): Promise<Msg[]> {
    const sk = settingsKey();
    const lint = async (piece: string): Promise<Msg[]> => {
        const k = sk + "\0" + piece;
        let r = pieceCache.get(k);
        if (!r) {
            r = await lint(piece);
            if (pieceCache.size > 4000) pieceCache.clear();
            pieceCache.set(k, r);
        }
        return r;
    };
    const just = justApplied && justApplied.after === text ? justApplied : null;
    const out: Msg[] = [];
    for (const m of msgs) {
        if (just) {
            // takes back or flips the writer's last fix (not: another rule's mark on the corrected word; 1.6.2)
            if (undoesJustApplied(m, just)) continue;
        }
        if (!m.fix) {
            out.push(m);
            continue;
        }
        const [ps, pe] = pieceAround(text, Math.min(m.range[0], m.fix.range[0]), Math.max(m.range[1], m.fix.range[1]));
        const piece = text.slice(ps, pe);
        const local: Msg = { ...m, range: [m.range[0] - ps, m.range[1] - ps], fix: { range: [m.fix.range[0] - ps, m.fix.range[1] - ps], text: m.fix.text } };
        const vk = `${sk}\0${piece}\0${m.ruleId}\0${m.message}\0${local.fix!.range}\0${m.fix.text}`;
        let drop = verdictCache.get(vk);
        if (drop === undefined) {
            try {
                drop = outranked(local, await conflictsOf(lint, piece, local, await lint(piece)));
            } catch {
                drop = false;
            }
            if (verdictCache.size > 8000) verdictCache.clear();
            verdictCache.set(vk, drop);
        }
        if (!drop) out.push(m);
    }
    return out;
}

// ---- the note that opens on a marked word ----
const editor = $<HTMLDivElement>("editor");
const reviewBtn = $<HTMLButtonElement>("review");
let openK = -1;

function markRects(k: number): DOMRect[] {
    const r = ranges[k];
    return r ? [...r.getClientRects()].filter((x) => x.width > 0 || x.height > 0) : [];
}

/** The text offset of the caret a tap at (x, y) would place, or null if the browser cannot say. */
function offsetAtPoint(x: number, y: number): number | null {
    const d = document as any;
    if (d.caretPositionFromPoint) {
        const p = d.caretPositionFromPoint(x, y);
        if (p && box.contains(p.offsetNode)) return offsetOf(p.offsetNode, p.offset);
    } else if (d.caretRangeFromPoint) {
        const r: Range | null = d.caretRangeFromPoint(x, y);
        if (r && box.contains(r.startContainer)) return offsetOf(r.startContainer, r.startOffset);
    }
    return null;
}
/** Is (x, y) on a letter of [s, e), not in the empty space past a line's end? */
function onLetters(x: number, y: number, s: number, e: number): boolean {
    const at = offsetAtPoint(x, y);
    if (at === null) return true;
    for (const i of [at - 1, at]) {
        if (i < s || i >= e) continue;
        const r = document.createRange();
        const [a, ao] = pointAt(i);
        const [b, bo] = pointAt(i + 1);
        r.setStart(a, ao);
        r.setEnd(b, bo);
        if ([...r.getClientRects()].some((c) => x >= c.left - 2 && x <= c.right + 2 && y >= c.top && y <= c.bottom)) return true;
    }
    return false;
}
/**
 * The marked span under a point, if any. Only a tap on a mark's own letters (1.5.2: a mark over a
 * line break has, in WebKit, a box that runs to the line's end, so a tap in the empty space after
 * the last word of a line opened a note instead of placing the caret there).
 */
function spanAt(x: number, y: number): number {
    // a word's own mark first; a sentence note where no word mark is
    const order = [...spans.keys()].sort((a, b) => Number(!!spans[a].sentence) - Number(!!spans[b].sentence));
    for (const k of order) {
        // a one-letter mark («»» alone) still takes a finger: at least 24px wide
        const slop = (r: DOMRect) => Math.max(2, (24 - r.width) / 2);
        const rects = markRects(k);
        const hit = rects.find((r) => x >= r.left - slop(r) && x <= r.right + slop(r) && y >= r.top && y <= r.bottom);
        if (!hit) continue;
        // a short mark on one line takes the finger's slop; anything longer only its letters
        if (rects.length === 1 && hit.width < 24 && !spans[k].sentence) return k;
        if (onLetters(x, y, spans[k].s, spans[k].e)) return k;
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

/**
 * «قبلی/بعدی» and «مرور»: the page moves only if the word is off-screen, and only as far as
 * needed («nearest»). Opening a note by tapping its word never moves the text.
 */
function goTo(k: number) {
    const r = markRects(k)[0];
    if (!r) return;
    const view = window.visualViewport;
    const top = view ? view.offsetTop : 0;
    const bottom = top + (view ? view.height : window.innerHeight);
    const margin = 24;
    let dy = 0;
    if (r.top < top + margin) dy = r.top - top - margin;
    else if (r.bottom > bottom - margin) dy = r.bottom - bottom + margin;
    if (dy) window.scrollBy({ top: dy });
    openPopover(k);
}

/*
 * A tap on a marked word opens its note and nothing else: no caret, no keyboard, no scroll
 * (since 1.4.0). When the editor is not focused, the tap's default (focus, caret, the phone's
 * keyboard) is cancelled; when the writer is typing, the caret moves as usual and the
 * keyboard stays. A tap on unmarked text focuses as always.
 */
let touchAt: { x: number; y: number; t: number } | null = null;
let skipClick = false;
box.addEventListener("touchstart", (ev) => {
    const t = ev.touches[0];
    touchAt = ev.touches.length === 1 && document.activeElement !== box && spanAt(t.clientX, t.clientY) >= 0 ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
}, { passive: true });
box.addEventListener("touchend", (ev) => {
    const start = touchAt;
    touchAt = null;
    if (!start) return;
    const t = ev.changedTouches[0];
    // a drag or a long press (scrolling, selecting) is the browser's
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10 || Date.now() - start.t > 600) return;
    const k = spanAt(t.clientX, t.clientY);
    if (k < 0) return;
    ev.preventDefault(); // no click, no focus, no keyboard
    skipClick = true;
    window.setTimeout(() => (skipClick = false), 400);
    openPopover(k, t.clientX, t.clientY);
}, { passive: false });
box.addEventListener("mousedown", (ev) => {
    // a mouse click on a mark while not typing: the note, without the caret
    if (document.activeElement !== box && spanAt(ev.clientX, ev.clientY) >= 0) ev.preventDefault();
});
/** The caret's box for a collapsed range, or null. */
function caretBox(r: Range): DOMRect | null {
    const rs = r.getClientRects();
    if (rs.length) return rs[0];
    const b = r.getBoundingClientRect();
    return b.height ? b : null;
}
/**
 * WebKit (iPhone) puts the caret of a tap in the empty space past a line's end at the next line.
 * «unicode-bidi: plaintext» hid it (1.5.2) but let empty lines and lines starting with a Latin word run
 * left to right; since 1.6.5 the box is always right to left and the caret is moved back to the end of
 * the line that was tapped. Elsewhere the caret is already on that line and nothing happens.
 */
function fixTapCaret(y: number): void {
    const sel = getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
    const r0 = sel.getRangeAt(0);
    if (!box.contains(r0.startContainer)) return;
    const b0 = caretBox(r0);
    if (!b0) return;
    const t = box.firstChild;
    if (!t || t.nodeType !== Node.TEXT_NODE) return;
    const len = (t as Text).length;
    const data = (t as Text).data;
    const on = (i: number): DOMRect | null => {
        const r = document.createRange();
        r.setStart(t, i);
        r.collapse(true);
        return caretBox(r);
    };
    const place = (i: number) => {
        const r = document.createRange();
        r.setStart(t, i);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
    };
    let off = offsetOf(r0.startContainer, r0.startOffset);
    if (y >= b0.top - 1 && y <= b0.bottom + 1) {
        // on the tapped line already, but before the space a line is broken at: the line ends after it (1.6.5)
        const nb = off < len && data[off] === " " ? on(off + 1) : null;
        if (nb && !(y >= nb.top - 1 && y <= nb.bottom + 1)) place(off + 1);
        return;
    }
    const step = b0.top > y ? -1 : 1;
    let found = -1;
    for (let n = 0; n < 4000 && off >= 0 && off <= len; n++, off += step) {
        const b = on(off);
        if (!b) continue;
        const hit = y >= b.top - 1 && y <= b.bottom + 1;
        if (hit) {
            found = off;
            if (step < 0) break; // walking back: the first offset on the line is its end
        } else if (found >= 0) break; // walking on: the last offset on the line is its end
    }
    if (found < 0) return;
    // a line broken at a space: walking back, the first offset on the tapped line is before that space (1.6.5)
    if (step < 0 && found < len && data[found] === " ") found++;
    place(found);
}
box.addEventListener("click", (ev) => {
    if (!skipClick && document.activeElement === box) fixTapCaret(ev.clientY);
    if (skipClick) return;
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
    // the path as dispatched: a button the note just replaced («بعدی») is no longer inside it
    const path = ev.composedPath();
    if (pop.hidden || path.includes(pop) || path.includes(box)) return;
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
    const tog = target.closest("[data-all-toggle]") as HTMLElement | null;
    if (tog) {
        // on a card with several replacements: the next one chosen goes everywhere
        tog.setAttribute("aria-pressed", String(tog.getAttribute("aria-pressed") !== "true"));
        return;
    }
    const every = target.closest("[data-all]") as HTMLElement | null;
    if (every) {
        const n = applyEverywhere(Number(every.dataset.all), 0);
        status.textContent = `${n.toLocaleString("fa-IR")} جا جایگزین شد.`;
        return;
    }
    const cq = target.closest("[data-colloq]") as HTMLElement | null;
    if (cq) {
        const yes = cq.dataset.colloq === "yes";
        setColloquial(yes);
        void check().then(() => {
            status.textContent = yes ? "واژه‌های محاوره‌ای در همۀ متن درست شمرده می‌شوند." : "متن همان‌طور بررسی می‌شود.";
        });
        return;
    }
    const alt = target.closest("[data-alt]") as HTMLElement | null;
    if (alt) {
        const [i, j] = alt.dataset.alt!.split(":").map(Number);
        const card = alt.closest(".issue");
        if (card?.querySelector('[data-all-toggle][aria-pressed="true"]')) {
            const n = applyEverywhere(i, j);
            status.textContent = `${n.toLocaleString("fa-IR")} جا جایگزین شد.`;
            return;
        }
        const x = (messages[i] as Card).alts?.[j];
        if (!x) return;
        const text = input.value;
        if (applyEdit(text, x.fix!) === text) {
            // the other reading is the word as written («کمکم» = «کمک» + «م»): keep it, like «نادیده»
            for (const y of [messages[i], ...extras[i]]) ignored.add(key(y, text));
            void check();
            return;
        }
        applyFix({ ...x, alts: undefined } as Msg, extras[i]);
        status.textContent = "جایگزین شد.";
        return;
    }
    const ed = target.closest("[data-edit]") as HTMLElement | null;
    if (ed) {
        // «ویرایش»: the keyboard opens with the caret at the end of the word. focus() is called
        // right here, in the tap's own handler: iOS opens the keyboard only for a user gesture.
        const sp = spans[openK];
        const end = sp ? sp.e : cardSpan(messages[Number(ed.dataset.edit)], input.value)[1];
        closePopover();
        box.focus({ preventScroll: true });
        setCaret(end);
        return;
    }
    const a = target.closest("[data-apply]") as HTMLElement | null;
    const ig = target.closest("[data-ignore]") as HTMLElement | null;
    const rp = target.closest("[data-report]") as HTMLElement | null;
    if (a) {
        applyFix(messages[Number(a.dataset.apply)]);
        status.textContent = "جایگزین شد.";
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
    const ln = target.closest("[data-learn]") as HTMLElement | null;
    if (ln) {
        const m = messages[Number(ln.dataset.learn)];
        const sp = [m, ...extras[Number(ln.dataset.learn)]].find((x) => x.ruleId === "spelling") ?? m;
        learn(input.value.slice(sp.range[0], sp.range[1]));
        void check().then(() => {
            status.textContent = "به واژه‌نامۀ شما افزوده شد.";
        });
        return;
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
    // the icon of the mode a tap switches to; the label says both
    const dark = document.documentElement.dataset.theme === "dark";
    themeBtn.innerHTML = dark ? ICON.sun : ICON.moon;
    themeBtn.setAttribute("aria-pressed", String(dark));
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

/*
 * «درست‌کن»: every red mark, and only those (since 1.4.0 the page does it itself: textlint's
 * own fixer would also make the yellow suggestions, which now carry their replacements).
 * One fix can make another possible («همه دفترهارا» → «همه دفترها را» → «همۀ دفترها را»).
 */
applyAllBtn.addEventListener("click", async () => {
    status.textContent = "در حال جایگزینی…";
    const planned = spans
        .filter((sp) => sp.red)
        .map((sp) => reports[sp.items.find((i) => isCertainMsg(messages[i])) ?? sp.items[0]])
        .filter((r) => r && r.suggestion && r.suggestion !== r.original);
    remember();
    let text = input.value;
    for (let round = 0; round < 3; round++) {
        const msgs = await visible(text, await lint(text));
        const next = applyCertain(text, msgs);
        if (next === text) break;
        text = next;
    }
    input.value = text;
    await check();
    status.textContent = `${planned.length.toLocaleString("fa-IR")} غلط قطعی جایگزین شد.`;
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

/*
 * «چسباندن»: the clipboard into the editor, the way a paste goes (the typing fixes run on it,
 * it is one step of «بازگشت», and the text is checked). Into an empty editor it replaces all;
 * otherwise at the caret, or at the end. readText() is called right in the tap's handler:
 * iOS shows its «Paste» bubble only for a user gesture.
 */
pasteBtn.addEventListener("click", () => {
    const denied = () => (status.textContent = "اجازۀ خواندن حافظه داده نشد؛ متن را با نگه‌داشتن انگشت بچسبانید");
    if (!navigator.clipboard?.readText) return void denied();
    const at = document.activeElement === box ? caret() : null;
    navigator.clipboard.readText().then((t) => {
        t = t.replace(/\r\n?/g, "\n");
        if (!t) return;
        const cur = input.value;
        remember();
        const pos = cur === "" ? 0 : at ?? cur.length;
        input.value = cur === "" ? t : cur.slice(0, pos) + t + cur.slice(pos);
        if (at !== null) setCaret(pos + t.length);
        pendingAuto = "all";
        autoHold = false;
        closePopover();
        changesEl.hidden = true;
        clearMarks();
        schedule();
        status.textContent = "متن چسبانده شد.";
    }, denied);
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

$<HTMLButtonElement>("clear").addEventListener("click", () => {
    input.value = "";
    ignored = new Set();
    setColloquial(null); // a new text: the question is asked again
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
    if (input.value === "" && colloquial !== null) setColloquial(null); // the editor emptied: a new text
    closePopover();
    changesEl.hidden = true;
    // the old marks would sit on shifted text: none until the check is done
    clearMarks();
    schedule();
});
showZwnj.addEventListener("change", check);
/*
 * «ها»ی جمع (1.6.5: one menu of three, before a menu of two and a checkbox «همیشه «ها» را جدا بنویس» that did
 * nothing with «فقط موارد الزامی»): only where the book requires it, the blue recommendation (the default), or
 * always apart (joined «ها» joins the typing fixes). Remembered per browser, with a line of help under it.
 */
const PLURAL_HELP: Record<string, string> = {
    "required-only": "«کتابها» و «کتاب‌ها» هر دو درست‌اند و دست نمی‌خورند؛ فقط «خانهها» ← «خانه‌ها» می‌شود.",
    recommended: "«کتابها» ← «کتاب‌ها» پیشنهاد می‌شود، ولی خودش عوض نمی‌شود.",
    apart: "همۀ «ها»های جمع جدا می‌شوند: «کتابها» ← «کتاب‌ها»."
};
const showPluralHelp = () => (pluralHelp.textContent = PLURAL_HELP[pluralMode.value] ?? "");
try {
    const saved = stored("plural-mode");
    // the old checkbox «همیشه «ها» را جدا بنویس» (1.4.0–1.6.4): on → «همیشه جدا»
    if (saved && saved in PLURAL_HELP) pluralMode.value = saved;
    else if (stored("ha-apart") === "on") {
        pluralMode.value = "apart";
        localStorage.setItem("vajban:plural-mode", "apart");
    }
    localStorage.removeItem("vajban:ha-apart");
    localStorage.removeItem("dorostnevis:ha-apart");
} catch {
    /* storage may be unavailable */
}
showPluralHelp();
pluralMode.addEventListener("change", () => {
    showPluralHelp();
    try {
        localStorage.setItem("vajban:plural-mode", pluralMode.value);
    } catch {
        /* storage may be unavailable */
    }
    // «همیشه جدا»: the joined «ها» already in the text are fixed at once, as the typing fixes
    if (pluralMode.value === "apart") {
        pendingAuto = "all";
        autoHold = false;
    }
    void check();
});
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
// «نوع متن» is gone (1.5.0): the register is found per sentence; the old setting is forgotten
try {
    localStorage.removeItem("vajban:mode");
    localStorage.removeItem("dorostnevis:mode");
} catch {
    /* storage may be unavailable */
}

// no sample text: the empty editor shows its placeholder; a saved draft comes back
let initial = "";
try {
    initial = stored("draft") || "";
} catch {
    /* storage may be unavailable */
}
input.value = initial;
try {
    const c = initial ? localStorage.getItem("vajban:colloquial") : null;
    setColloquial(c === "yes" ? true : c === "no" ? false : null);
} catch {
    setColloquial(null);
}
pendingAuto = initial ? "all" : "none";
check();
void setupOwnerPanel();
