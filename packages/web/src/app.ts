/**
 * درست‌نویس — test page. Runs textlint with the Farhangestan preset entirely
 * in the browser: nothing typed here leaves the page.
 */
import { TextlintKernel } from "@textlint/kernel";
import textPlugin from "@textlint/textlint-plugin-text";
import preset from "../../textlint-rule-preset-farhangestan/src/index";
import { loadSpellingLexicon } from "../../textlint-rule-preset-farhangestan/src/util/speller";
import shekaste from "../../textlint-rule-preset-shekaste/src/index";

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
    "او نتیجه نهایی را اعلام کرد و همه دفترهارا جمع کرد؛ بعد مسیررا عوض کردیم."
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
    "may-break": "شکستن روا"
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
const preview = $<HTMLDivElement>("preview");
const list = $<HTMLOListElement>("issues");
const summary = $<HTMLParagraphElement>("summary");
const showZwnj = $<HTMLInputElement>("show-zwnj");
const pluralMode = $<HTMLSelectElement>("plural-mode");
const ezafeStyle = $<HTMLSelectElement>("ezafe-style");
const mode = $<HTMLSelectElement>("mode");
const applyAllBtn = $<HTMLButtonElement>("apply-all");
const copyBtn = $<HTMLButtonElement>("copy");
const status = $<HTMLSpanElement>("status");

let messages: Msg[] = [];
let timer: number | undefined;

function options() {
    const all = { ...preset.rules, ...(mode.value === "dialogue" ? shekaste.rules : {}) };
    // spoken forms («می‌رم»، «خونه») are not typos: no spelling check in dialogue
    const rules = Object.entries(all).filter(([ruleId]) => !(ruleId === "spelling" && mode.value === "dialogue")).map(([ruleId, rule]) => {
        let opts: object | boolean = true;
        if (ruleId === "plural-ha") opts = { mode: pluralMode.value };
        if (ruleId === "ezafe-he") opts = { style: ezafeStyle.value, formal: mode.value !== "dialogue" };
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
    return showZwnj.checked ? e.replace(/‌/g, '<span class="zw" aria-label="نیم‌فاصله"></span>') : e;
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

/**
 * Marks always cover whole words. A mark around one letter («ي» in «رييس») is
 * a separate inline box, and some browsers (Safari, the iOS app) then draw the
 * letters on either side of it in their unjoined forms.
 */
function renderPreview(text: string) {
    const spans = messages
        .map((m, i) => {
            const [s, e] = wordAround(text, m.range[0], m.range[1]);
            return { s, e, i, fix: Boolean(m.fix) };
        })
        .sort((a, b) => a.s - b.s || b.e - a.e);
    const merged: Array<{ s: number; e: number; i: number; fix: boolean }> = [];
    for (const sp of spans) {
        const last = merged[merged.length - 1];
        if (last && sp.s < last.e) {
            last.e = Math.max(last.e, sp.e);
            last.fix = last.fix || sp.fix;
        } else {
            merged.push({ ...sp });
        }
    }
    let out = "";
    let pos = 0;
    for (const { s, e, i, fix } of merged) {
        out += show(text.slice(pos, s));
        const cls = fix ? "mark" : "mark mark-judge";
        out += `<a href="#issue-${i}" class="${cls}" data-i="${i}">${show(text.slice(s, e)) || "&#8203;"}</a>`;
        pos = e;
    }
    out += show(text.slice(pos));
    preview.innerHTML = out.replace(/\n/g, "<br>");
}

const WORD_CHAR = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u200C\u200F\u0640]/;
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

/** Why a card has no circles, in a few words. */
function noMeterReason(m: Msg): string {
    if (m.ruleId === "spelling") return "حدس غلط‌یاب است، نه قاعده";
    if (m.ruleId === "may-break") return "پیشنهاد سبکی است، نه غلط";
    if (m.ruleId === "punctuation") return "قرارداد رایج است، نه کتاب";
    return "به معنای جمله بستگی دارد";
}

function meterFor(m: Msg, p: number | null): string {
    if (p !== null) return confidenceMeter(p);
    if (m.fix && m.ruleId !== "punctuation") return bookMeter();
    return `<div class="confidence confidence-none" title="این کارت درجهٔ اطمینان ندارد: ${noMeterReason(m)}.">
                <span class="confidence-label">درجه ندارد</span>
                <span class="confidence-why">${noMeterReason(m)}</span>
            </div>`;
}

function renderList(text: string) {
    list.innerHTML = "";
    messages.forEach((m, i) => {
        const split = splitMessage(m);
        const source = split.source;
        const { msg, p } = takeConfidence(split.text);
        const li = document.createElement("li");
        li.id = `issue-${i}`;
        const meter = meterFor(m, p);
        li.className = (m.fix ? "issue" : "issue issue-judge") + (meter.includes("confidence-none") ? " has-note" : " has-confidence");
        // show the whole word around the change, so «ي ← ی» reads «رييس ← رئیس»
        const [ws, we] = wordAround(text, Math.min(m.range[0], m.fix?.range[0] ?? m.range[0]), Math.max(m.range[1], m.fix?.range[1] ?? m.range[1]));
        const original = text.slice(ws, we);
        const fixed = m.fix ? text.slice(ws, m.fix.range[0]) + m.fix.text + text.slice(m.fix.range[1], we) : "";
        li.innerHTML = `
            ${meter}
            <div class="issue-head">
                <span class="chip">${esc(RULE_LABELS[m.ruleId] ?? m.ruleId)}</span>
                ${m.fix ? "" : m.ruleId === "may-break" ? '<span class="chip chip-style">پیشنهاد سبکی</span>' : '<span class="chip chip-judge">نیازمند تشخیص</span>'}
            </div>
            <p class="change">
                <span class="from">${show(original) || "&nbsp;"}</span>
                ${m.fix ? `<span class="arrow" aria-hidden="true">←</span><span class="to">${show(fixed) || "(حذف)"}</span>` : ""}
            </p>
            <p class="msg">${esc(msg)}</p>
            ${source ? `<p class="source">${esc(source)}</p>` : ""}
            <div class="actions">
                ${m.fix ? `<button type="button" class="btn btn-small" data-apply="${i}">اعمال</button>` : ""}
                <button type="button" class="btn btn-small btn-quiet" data-ignore="${i}">نادیده</button>
            </div>`;
        list.appendChild(li);
    });
    const fixable = messages.filter((m) => m.fix).length;
    const judge = messages.length - fixable;
    summary.textContent =
        messages.length === 0
            ? "پیشنهادی نیست. متن با قواعدی که این ابزار می‌شناسد سازگار است."
            : `${messages.length.toLocaleString("fa-IR")} پیشنهاد: ${fixable.toLocaleString("fa-IR")} اصلاح خودکار، ${judge.toLocaleString("fa-IR")} نیازمند تشخیص`;
    applyAllBtn.disabled = fixable === 0;
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
    messages = (result.messages as unknown as Msg[])
        .filter((m) => !ignored.has(key(m, text)))
        .sort((a, b) => a.range[0] - b.range[0]);
    renderPreview(text);
    renderList(text);
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

function applyFix(m: Msg) {
    if (!m.fix) return;
    const t = input.value;
    input.value = t.slice(0, m.fix.range[0]) + m.fix.text + t.slice(m.fix.range[1]);
    check();
}

list.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement;
    const a = target.closest("[data-apply]") as HTMLElement | null;
    const ig = target.closest("[data-ignore]") as HTMLElement | null;
    if (a) applyFix(messages[Number(a.dataset.apply)]);
    if (ig) {
        ignored.add(key(messages[Number(ig.dataset.ignore)], input.value));
        check();
    }
});

preview.addEventListener("click", (ev) => {
    const mark = (ev.target as HTMLElement).closest(".mark") as HTMLElement | null;
    if (!mark) return;
    ev.preventDefault();
    const li = document.getElementById(`issue-${mark.dataset.i}`);
    li?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    li?.classList.add("flash");
    window.setTimeout(() => li?.classList.remove("flash"), 900);
});

applyAllBtn.addEventListener("click", async () => {
    status.textContent = "در حال اعمال…";
    // one fix can make another possible («همه دفترهارا» → «همه دفترها را» → «همۀ دفترها را»)
    let text = input.value;
    for (let round = 0; round < 3; round++) {
        const next = (await kernel.fixText(text, options())).output;
        if (next === text) break;
        text = next;
    }
    input.value = text;
    await check();
    status.textContent = "همهٔ اصلاح‌های خودکار اعمال شد.";
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

input.addEventListener("input", schedule);
[showZwnj, pluralMode, ezafeStyle].forEach((el) => el.addEventListener("change", check));
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
