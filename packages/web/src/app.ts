/**
 * درست‌نویس — test page. Runs textlint with the Farhangestan preset entirely
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
    "spaced-compounds": "ترکیب‌ها"
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

const input = $<HTMLTextAreaElement>("text");
const backdrop = $<HTMLDivElement>("backdrop");
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

/** The rules to run; `forFix` leaves out what «اعمال همه» must not touch. */
function options(forFix = false) {
    const style = mode.value === "dialogue" || forFix ? {} : Object.fromEntries(
        Object.entries(virayesh.rules).filter(([id]) => styleBoxes.find((b) => b.dataset.rule === id)?.checked !== false)
    );
    const all = { ...preset.rules, ...(mode.value === "dialogue" ? shekaste.rules : {}), ...style };
    // spoken forms («می‌رم»، «خونه») are not typos: no spelling check in dialogue
    const rules = Object.entries(all).filter(([ruleId]) => !(ruleId === "spelling" && mode.value === "dialogue")).map(([ruleId, rule]) => {
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

/**
 * The highlighter: a copy of the text under the (transparent) textarea, with
 * each marked word in a <mark>. Marks always cover whole words: a mark around
 * one letter («ي» in «رييس») is a separate inline box, and some browsers
 * (Safari, the iOS app) then draw the letters on either side unjoined, which
 * would also shift the marks off the words above them.
 */
function renderBackdrop(text: string) {
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
    let out = "";
    let pos = 0;
    spans.forEach((sp, k) => {
        out += show(text.slice(pos, sp.s));
        out += `<mark class="hl ${sp.red ? "hl-red" : "hl-yellow"}" id="mk-${k}">${show(text.slice(sp.s, sp.e)) || "&#8203;"}</mark>`;
        pos = sp.e;
    });
    out += show(text.slice(pos));
    // a final newline needs a character after it to take up a line, as in the textarea
    backdrop.innerHTML = out + "\u200b";
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
    {
        prefix: /^شیوه‌نامهٔ حروف‌نگاری و بهنجارسازی متن فارسی، فرهنگستان \(پیش‌نویس ۱۴۰۵\)\s*[،]?\s*/,
        name: `شیوه‌نامهٔ حروف‌نگاری و بهنجارسازی متن فارسی، ${ACADEMY} (پیش‌نویس ۱۴۰۵)`
    }
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
        // a page («ص ۵۵») or, for the شیوه‌نامه, its article («مادهٔ ۹، بند ۵»)
        const article = /^مادهٔ/.test(rest) ? rest : "";
        const text = book.name + (pages.length ? `، ص ${pages.join(" و ")}` : article ? `، ${article}` : "");
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
    if (/^شیوه‌نامهٔ/.test(splitMessage(m).source)) return "شیوه‌نامهٔ فرهنگستان (پیش‌نویس)، نه کتاب";
    if (m.ruleId === "punctuation") return "قرارداد رایج است، نه کتاب";
    if (isStyle(m)) return "توصیهٔ ویرایشی است، نه قاعدهٔ کتاب";
    return "به معنای جمله بستگی دارد";
}

function meterFor(m: Msg, p: number | null): string {
    if (p !== null) return confidenceMeter(p);
    if (m.fix && m.ruleId !== "punctuation" && m.ruleId !== "invisible" && !isStyle(m) && !/^شیوه‌نامهٔ/.test(splitMessage(m).source)) return bookMeter();
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
            (x) => x.fix && !/احتمال/.test(x.message) && x.ruleId !== "punctuation" && x.ruleId !== "invisible" && !isStyle(x) && !/^شیوه‌نامهٔ/.test(splitMessage(x).source)
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
    const text = input.value;
    status.textContent = "در حال بررسی…";
    const result = await kernel.lintText(text, options());
    const merged = mergeSame(
        (result.messages as unknown as Msg[]).filter((m) => !ignored.has(key(m, text))),
        text
    );
    messages = merged.primary;
    extras = merged.extra;
    closePopover();
    renderBackdrop(text);
    buildCards(text);
    autosize();
    status.textContent = "";
    try {
        localStorage.setItem("dorostnevis:draft", text);
    } catch {
        /* storage may be unavailable */
    }
}

function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(check, 350);
}

/**
 * Every automatic change can be undone (شیوه‌نامه، مادهٔ ۳۳، بند ۳: «تغییرات
 * خودکار باید تا حد امکان قابل بازبینی و برگشت‌پذیر باشند»).
 */
const history: string[] = [];
const undoBtn = $<HTMLButtonElement>("undo");
const changesEl = $<HTMLDetailsElement>("changes");
function remember() {
    history.push(input.value);
    if (history.length > 50) history.shift();
    undoBtn.disabled = false;
}
undoBtn.addEventListener("click", () => {
    const prev = history.pop();
    if (prev === undefined) return;
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
    const el = document.getElementById(`mk-${k}`);
    return el ? [...el.getClientRects()] : [];
}

/** The marked span under a point, if any (marks sit under the transparent textarea). */
function spanAt(x: number, y: number): number {
    for (let k = 0; k < spans.length; k++) {
        if (markRects(k).some((r) => x >= r.left - 2 && x <= r.right + 2 && y >= r.top && y <= r.bottom)) return k;
    }
    return -1;
}

function closePopover() {
    pop.hidden = true;
    if (openK >= 0) document.getElementById(`mk-${openK}`)?.classList.remove("is-open");
    openK = -1;
}

function openPopover(k: number, x?: number, y?: number) {
    const sp = spans[k];
    if (!sp) return closePopover();
    if (openK >= 0) document.getElementById(`mk-${openK}`)?.classList.remove("is-open");
    openK = k;
    document.getElementById(`mk-${k}`)?.classList.add("is-open");
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
    const el = document.getElementById(`mk-${k}`);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    openPopover(k);
}

input.addEventListener("click", (ev) => {
    if (input.selectionStart !== input.selectionEnd) return;
    const k = spanAt(ev.clientX, ev.clientY);
    if (k < 0) return closePopover();
    openPopover(k, ev.clientX, ev.clientY);
});
// a pointer over a marked word says it can be clicked
input.addEventListener("mousemove", (ev) => {
    input.style.cursor = spanAt(ev.clientX, ev.clientY) >= 0 ? "pointer" : "";
});
document.addEventListener("click", (ev) => {
    const t = ev.target as Node;
    if (pop.hidden || pop.contains(t) || t === input) return;
    closePopover();
});
document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !pop.hidden) {
        closePopover();
        input.focus();
    }
});
window.addEventListener("resize", () => {
    autosize();
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

/** The textarea grows with its text, so it never scrolls apart from the marks under it. */
function autosize() {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
}

// ---- theme: light unless the reader picks dark ----
const themeBtn = $<HTMLButtonElement>("theme");
function showTheme() {
    themeBtn.textContent = document.documentElement.dataset.theme === "dark" ? "روشن" : "تیره";
}
themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
        localStorage.setItem("dorostnevis:theme", next);
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
        autosize();
        if (openK >= 0) place(openK);
    })
    .catch(() => undefined);

applyAllBtn.addEventListener("click", async () => {
    status.textContent = "در حال اعمال…";
    // what is about to change, for the list after (شیوه‌نامه، مادهٔ ۳۳، بند ۵)
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
    check();
});
$<HTMLButtonElement>("clear").addEventListener("click", () => {
    input.value = "";
    ignored = new Set();
    check();
    input.focus();
});

input.addEventListener("input", () => {
    closePopover();
    changesEl.hidden = true;
    // the old marks would sit on shifted text: plain text until the check is done
    spans = [];
    backdrop.innerHTML = show(input.value) + "\u200b";
    autosize();
    schedule();
});
[showZwnj, pluralMode, ezafeStyle].forEach((el) => el.addEventListener("change", check));
// which language-editing rules are on: remembered per browser
try {
    const off = JSON.parse(localStorage.getItem("dorostnevis:style-off") || "[]") as string[];
    for (const b of styleBoxes) b.checked = !off.includes(b.dataset.rule!);
} catch {
    /* storage may be unavailable */
}
for (const b of styleBoxes) {
    b.addEventListener("change", () => {
        try {
            localStorage.setItem("dorostnevis:style-off", JSON.stringify(styleBoxes.filter((x) => !x.checked).map((x) => x.dataset.rule)));
        } catch {
            /* storage may be unavailable */
        }
        check();
    });
}
mode.addEventListener("change", () => {
    try {
        localStorage.setItem("dorostnevis:mode", mode.value);
    } catch {
        /* storage may be unavailable */
    }
    check();
});
try {
    mode.value = localStorage.getItem("dorostnevis:mode") || "formal";
} catch {
    /* storage may be unavailable */
}

let initial = SAMPLE;
try {
    initial = localStorage.getItem("dorostnevis:draft") || SAMPLE;
} catch {
    /* storage may be unavailable */
}
input.value = initial;
check();
void setupOwnerPanel();
