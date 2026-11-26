/**
 * The rules the page runs, and how their suggestions rank, without the page: app.ts and the
 * «no ping-pong» test (test/no-ping-pong-test.ts) both use this, so the test checks exactly
 * what the page shows.
 */
import textPlugin from "@textlint/textlint-plugin-text";
import preset from "../../textlint-rule-preset-farhangestan/src/index";
import shekaste from "../../textlint-rule-preset-shekaste/src/index";
import virayesh, { CERTAIN_RULES } from "../../textlint-rule-preset-virayesh/src/index";

export type Msg = {
    ruleId: string;
    message: string;
    range: [number, number];
    fix?: { range: [number, number]; text: string };
};

export type Settings = {
    mode: string; // "formal" | "dialogue"
    pluralMode: string;
    /** «همیشه «ها» را جدا بنویس»: joined «ها» is fixed, silently with the typing fixes. */
    haApart?: boolean;
    /** Which language-editing rules are on (all, if not given). */
    styleOn?: (ruleId: string) => boolean;
};
export const DEFAULT_SETTINGS: Settings = { mode: "formal", pluralMode: "recommended" };
/** The ezafe after a silent «ه» is always «هٔ» (ه + U+0654) on the site, never «ۀ» (since 1.4.0). */
export const EZAFE_STYLE = "he-hamza";

/**
 * Language-editing rules (ویرایش زبانی). Each runs as two: under its own id the
 * suggestions (yellow, never in «اعمال همه»), and under `<id>:certain` the checks its book
 * calls a flat error (red, with a fix, in «اعمال همه»: «با این وجود»، «مثمر ثمر»…).
 */
export const STYLE_RULES = new Set(Object.keys(virayesh.rules));
export const CERTAIN_SUFFIX = ":certain";
/** «phrases:certain» → «phrases» */
export const baseRule = (ruleId: string) => (ruleId.endsWith(CERTAIN_SUFFIX) ? ruleId.slice(0, -CERTAIN_SUFFIX.length) : ruleId);
/** A suggestion of ویرایش زبانی (yellow). */
export const isStyle = (m: Msg) => STYLE_RULES.has(m.ruleId);
/** Any report of ویرایش زبانی, a suggestion or a certain error. */
export const isEditing = (m: Msg) => STYLE_RULES.has(baseRule(m.ruleId));
const SHEKASTE_RULES = new Set(Object.keys(shekaste.rules));

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
 * - plural-ha with «همیشه «ها» را جدا بنویس» on (since 1.4.0): «شباهتهای» → «شباهت‌های».
 * - tar-tarin: «بزرگ تر/بزرگتر/بزرگ ترین» → «بزرگ‌تر/بزرگ‌ترین», «بیش تر» → «بیشتر».
 * - ezafe-he: «ۀ» → «هٔ», the one form of the ezafe the site uses (since 1.4.0).
 * - hamza-tanvin and lexicon: a tanvin left out of the closed lists, «ایضا» → «ایضاً»،
 *   «فورا» → «فوراً» (since 1.4.0).
 * - punctuation: Latin «, ; ?» → «، ؛ ؟» after Persian (not in URLs, e-mails, numbers or
 *   before Latin), straight double quotes → «» (only when the line's quotes pair up),
 *   space before «، ؛ : ! ؟ .», a missing space after them (and after «:» and «…» between
 *   words, since 1.4.0), a comma next to another mark («هستند،:» → «هستند:»), the dash «—»
 *   with one space each side between words, the inner one no-break (سمیعی، ص ۲۳۹: «ساختمان—مثل»،
 *   «فرقه - حشاشیون»), a no-break space in «۲۰ درصد»، «ص ۲۳۹»، «۲۵ مهر», spaces inside «» () [],
 *   repeated spaces, spaces at a line's end. Not: digits, «...», dashes, «!!!», «(( ))»,
 *   and never the space between a number and a word (the book joins «۷۵درصدی»: ص ۶۵).
 * Left out entirely: dictionary and compound choices (lexicon, dictionary, joined-words,
 * spaced-compounds, word-spacing, compound-verbs, misspellings, final-he, gozar,
 * hamza-tanvin, arabic-prefixes, verb-prefix-alef, bi-prefix and copula-attachment, whose
 * fixes depend on reading the word: «بی» and «ای» can be free words), the statistical models
 * (ezafe-he, «را»), numbers, the spelling checker, and all of ویرایش زبانی.
 */
export const AUTO_FIX: Record<string, { only?: RegExp; skip?: RegExp }> = {
    "normalize-characters": { skip: /رقم عربی|کشیده/ },
    invisible: {},
    "zwnj-cleanup": {},
    "mi-prefix": { only: /^«ن?می» با نیم‌فاصله به فعل می‌چسبد/ },
    "plural-ha": { only: /^«ها»ی جمع با فاصلهٔ کامل|^پس از «ه» نشانهٔ جمع|^«ها» جدا نوشته می‌شود \(تنظیم/ },
    "ezafe-he": { only: /^شکل یکدستِ نشانهٔ اضافه/ },
    "tar-tarin": {},
    // tanvin left out («ایضا» ← «ایضاً»): the closed lists, never a homograph (those ask, yellow)
    "hamza-tanvin": { only: /^تنوین نصب «اً» نوشته می‌شود/ },
    lexicon: { only: /^تنوین نصب «اً» نوشته می‌شود/ },
    punctuation: {
        only: /^در متن فارسی «[،؛؟]»|^در متن فارسی گیومهٔ فارسی|^پیش از نشانه فاصله|^پس از نشانه یک فاصله|^پس از نقطه یک فاصله|^پس از سه‌نقطه یک فاصله|^داخل پرانتز و گیومه|^فاصلهٔ اضافه در پایان سطر|^بین دو کلمه یک فاصله|^ویرگول پیش یا پس از نشانهٔ دیگر|^خط تیره \(—\) میان دو واژه|^خط تیرهٔ آغاز گفت‌وگو|^میان (?:عدد و واحدش|نشانهٔ ارجاع و شماره‌اش|روز و ماه) فاصلهٔ نشکن/
    }
};

/** Is this message's fix one of the automatic typing fixes? */
export function isAuto(m: Msg, text: string): boolean {
    const spec = AUTO_FIX[m.ruleId];
    if (!spec || !m.fix || /^[\u2063\u2064]/.test(m.message)) return false; // a judgement or a recommendation is never silent
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

/** The rules to run; `forFix` leaves out what «اعمال همه» must not touch; `autoOnly` keeps the automatic ones. */
export function lintOptions(s: Settings, forFix = false, autoOnly = false) {
    const dialogue = s.mode === "dialogue";
    const all: Array<[string, unknown, object]> = Object.entries({ ...preset.rules, ...(dialogue ? shekaste.rules : {}) }).map(([id, r]) => [id, r, {}]);
    // ویرایش زبانی: not in dialogue, and only the rules the writer left on
    if (!dialogue && !autoOnly) {
        for (const [id, rule] of Object.entries(virayesh.rules)) {
            if (s.styleOn && !s.styleOn(id)) continue;
            const split = CERTAIN_RULES.has(id);
            if (!forFix) all.push([id, rule, split ? { part: "suggest" } : {}]);
            if (split) all.push([id + CERTAIN_SUFFIX, rule, { part: "certain" }]);
        }
    }
    // spoken forms («می‌رم»، «خونه») are not typos: no spelling check in dialogue
    const rules = all
        .filter(([ruleId]) => !(ruleId === "spelling" && dialogue) && (!autoOnly || ruleId in AUTO_FIX))
        .map(([ruleId, rule, part]) => {
            // the page shows every judgement with its replacement (yellow, with a button): not in the automatic runs
            let opts: object = autoOnly ? { ...part } : { ...part, suggestions: true };
            if (ruleId === "plural-ha") opts = { ...opts, mode: s.pluralMode, apart: !!s.haApart };
            if (ruleId === "ezafe-he") opts = { ...opts, style: EZAFE_STYLE, formal: !dialogue };
            if (baseRule(ruleId) === "calques") opts = { ...opts, ezafe: EZAFE_STYLE };
            return { ruleId, rule: rule as any, options: Object.keys(opts).length ? opts : true };
        });
    return { ext: ".txt", plugins: [{ pluginId: "text", plugin: (textPlugin as any).default ?? textPlugin }], rules };
}

// invisible characters inside a word (ZWNJ, ZWSP, ZWJ, RLM, word joiner) belong to it
const WORD_CHAR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿​-‏⁠ـ]/;
export function wordAround(text: string, start: number, end: number): [number, number] {
    while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
    while (end < text.length && WORD_CHAR.test(text[end])) end++;
    return [start, end];
}

export function splitMessage(m: Msg): { text: string; source: string } {
    // the source is the last parenthesis, which may itself contain one: «… (غلط‌یاب (واژه‌نامهٔ …))»
    const msg = m.message.replace(/[\u2063\u2064]/g, "").trimEnd();
    if (!msg.endsWith(")")) return { text: msg, source: "" };
    let depth = 0;
    for (let i = msg.length - 1; i >= 0; i--) {
        if (msg[i] === ")") depth++;
        else if (msg[i] === "(" && --depth === 0) return { text: msg.slice(0, i).trimEnd(), source: msg.slice(i + 1, -1) };
    }
    return { text: m.message, source: "" };
}

/**
 * A guess or a reading, not a verdict: a model's «(احتمال ۸۲٪)», or «اگر … یک واژه است، …»
 * («خانه دار» may be «خانهٔ دار»). Never red, never an objection to another rule's fix.
 */
export const TENTATIVE = /احتمال|^[\u2063\u2064]*اگر /;
/** A judgement the writer makes: a suggestion's replacement (pattern-rule's mark), a guess, an «اگر …». */
export const isSuggestion = (m: Msg) => /^\u2064?\u2063/.test(m.message);
/**
 * Blue, «پیشنهاد» (since 1.4.0): not an error, a recommendation — a check marked so
 * (pattern-rule's `kind: "suggestion"`), the suggestions of ویرایش زبانی, and the optional
 * spoken forms of dialogue. Never in «درست‌کن», never silent.
 */
export const isBlue = (m: Msg) => m.message.startsWith("\u2064") || isStyle(m) || m.ruleId === "may-break";
export const isTentative = (m: Msg) => isSuggestion(m) || isBlue(m) || TENTATIVE.test(m.message);
/** Red: a fix the book (or an editing book) makes without asking; «درست‌کن» makes all of them. */
export const isCertainMsg = (m: Msg) => !!m.fix && !isStyle(m) && !isTentative(m);

/**
 * «درست‌کن»: make the certain fixes among `msgs` (the page passes what it shows), right to
 * left, never two that overlap; the caller lints again for the fixes one fix makes possible.
 */
export function applyCertain(text: string, msgs: Msg[]): string {
    const fixes = msgs
        .filter(isCertainMsg)
        .map((m) => m.fix!)
        .sort((a, b) => a.range[0] - b.range[0] || a.range[1] - b.range[1]);
    const pick: Array<{ range: [number, number]; text: string }> = [];
    let end = -1;
    let lastStart = -1;
    for (const f of fixes) {
        if (f.range[0] < end || f.range[0] === lastStart) continue;
        pick.push(f);
        end = f.range[1];
        lastStart = f.range[0];
    }
    let out = text;
    for (const f of pick.reverse()) out = out.slice(0, f.range[0]) + f.text + out.slice(f.range[1]);
    return out;
}

/** A common convention the book has no rule for: no book meter, never «قطعی». */
export const NOT_IN_BOOK = /در دستور خط نیامده/;

/*
 * Precedence, when two rules disagree about the same letters (lower wins):
 *   0  دستور خط and فرهنگ املایی (the book's own rules and lists)
 *   1  the other Farhangestan rules (models, common misspellings) and شکسته‌نویسی in dialogue
 *   2  ویرایش زبانی
 *   3  conventions the book does not have («در دستور خط نیامده»: punctuation, spaces)
 *   4  the spelling checker
 *   5  recommendations (blue, «پیشنهاد»: not errors)
 * The lower rule stays silent where it would contradict a higher one.
 */
export function rank(m: Msg): number {
    if (isBlue(m)) return 5; // a recommendation yields to everything, a «maybe» included
    if (m.ruleId === "spelling") return 4;
    if (isEditing(m)) return 2;
    const source = splitMessage(m).source;
    if (NOT_IN_BOOK.test(source)) return 3;
    if (SHEKASTE_RULES.has(m.ruleId)) return 1;
    if (/^(دستور خط|فرهنگ املایی)/.test(source) && !isTentative(m)) return 0;
    return 1;
}

/** At `pos` (in the text before the edit), `removed` became `inserted`. */
export type Edit = { pos: number; removed: string; inserted: string };
export const applyFix = (text: string, f: { range: [number, number]; text: string }) => text.slice(0, f.range[0]) + f.text + text.slice(f.range[1]);

/**
 * A fix as the letters it really changes: «"…"» → «‹…›» is two edits (the two quotes), not
 * one over the whole quotation. Short replacements are diffed letter by letter.
 */
export function editsOf(text: string, range: [number, number], ins: string): Edit[] {
    let a = range[0];
    let b = range[1];
    let i = 0;
    let j = ins.length;
    while (a < b && i < j && text[a] === ins[i]) {
        a++;
        i++;
    }
    while (a < b && i < j && text[b - 1] === ins[j - 1]) {
        b--;
        j--;
    }
    const x = text.slice(a, b);
    const y = ins.slice(i, j);
    if (!x || !y || x.length * y.length > 250000) return [{ pos: a, removed: x, inserted: y }];
    // longest common subsequence, then the runs between the common letters
    const n = x.length;
    const m = y.length;
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let p = n - 1; p >= 0; p--) for (let q = m - 1; q >= 0; q--) L[p][q] = x[p] === y[q] ? L[p + 1][q + 1] + 1 : Math.max(L[p + 1][q], L[p][q + 1]);
    const out: Edit[] = [];
    let p = 0;
    let q = 0;
    let cur: Edit | null = null;
    while (p < n || q < m) {
        if (p < n && q < m && x[p] === y[q]) {
            if (cur) out.push(cur);
            cur = null;
            p++;
            q++;
            continue;
        }
        cur = cur ?? { pos: a + p, removed: "", inserted: "" };
        if (q < m && (p === n || L[p][q + 1] >= L[p + 1][q])) cur.inserted += y[q++];
        else cur.removed += x[p++];
    }
    if (cur) out.push(cur);
    return out;
}

/** The letters an edit put in, as [start, end) in the text after the fixes (`shift`: before → after). */
const insertedSpan = (e: Edit, shift: (p: number) => number): [number, number] => {
    const s = shift(e.pos);
    return [s, s + e.inserted.length];
};

/** Does edit `e2` (in the text after the fix) touch the letters the fix put in at [s, e) (s = e: where it took some out)? */
export function touches(e2: Edit, s: number, e: number): boolean {
    const a0 = e2.pos;
    const a1 = e2.pos + e2.removed.length;
    if (a1 > a0) return e > s ? a0 < e && a1 > s : a0 <= s && a1 >= s;
    return a0 >= s && a0 <= e;
}

/** A message without the words it quotes: «پرانتز درون پرانتز: «[به گفتهٔ خودش]»» says the same after the fix. */
const gist = (m: Msg) => m.message.replace(/«[^«»]*»/g, "«»");
/** Same rule, same message, on the same letters (as far as a re-lint can tell): an old message, not a new one. */
const sameMsg = (a: Msg, b: Msg, shift: (p: number) => number) =>
    a.ruleId === b.ruleId &&
    gist(a) === gist(b) &&
    shift(a.range[0]) <= b.range[1] &&
    shift(a.range[1]) >= b.range[0];

export type Lint = (text: string) => Promise<Msg[]>;

/** Rules whose reports are options, never objections: «می‌شه» may be written, a sentence may be split. */
const OPTIONAL = new Set(["may-break", "long-sentences", "ra-placement", "repeated-words", "comma-before-va", "spelling"]);
/**
 * Does `d` say the text is wrong (rather than offer something)? A certain fix (red), or a
 * judgement without a fix from a rule that is not an option: «۷۵درصدی» → «میان عدد و کلمه
 * فاصله می‌آید» objects; «می‌شود» → «در گفت‌وگو: می‌شه» does not.
 */
export function objects(d: Msg): boolean {
    if (OPTIONAL.has(d.ruleId) || isStyle(d) || isTentative(d)) return false;
    // a recommendation without a fix: both forms are correct («گوئی» / «گویی»، «آنها» / «آن‌ها»)
    if (!d.fix && /توصیه/.test(d.message)) return false;
    return true;
}
/**
 * restores:  the new message's fix gives back the text before the fix (ping-pong);
 * cycle:     making its fix brings back `m`'s own rule on the same letters (ping-pong over three steps);
 * outranked: a rule of higher precedence finds fault with the letters the fix put in;
 * flags:     a rule of the same or lower precedence, without a fix, finds fault with them
 *            (the «۷۵ درصدی» → «۷۵درصدی» → «میان عدد و کلمه فاصله می‌آید» case);
 * changes:   a rule of the same or lower precedence changes them again (a further step, not a conflict).
 */
export type Conflict = { kind: "restores" | "cycle" | "outranked" | "flags" | "changes"; by: Msg };

/**
 * Messages that object to `m`'s fix: new messages in the fixed text (not in `before`, the
 * text's own messages) on the letters the fix changed.
 */
export async function conflictsOf(lint: Lint, text: string, m: Msg, before: Msg[]): Promise<Conflict[]> {
    if (!m.fix) return [];
    const [r0, r1] = m.fix.range;
    const edits = editsOf(text, m.fix.range, m.fix.text);
    if (!edits.length) return [];
    const fixed = applyFix(text, m.fix);
    const delta = fixed.length - text.length;
    // a position before the fix → after it (inside the replaced range: the edit's own mapping)
    const shift = (p: number) => {
        if (p <= r0) return p;
        if (p >= r1) return p + delta;
        let d = 0;
        for (const e of edits) {
            if (p < e.pos) break;
            if (p < e.pos + e.removed.length) return e.pos + d;
            d += e.inserted.length - e.removed.length;
        }
        return p + d;
    };
    const spans = edits.map((e) => insertedSpan(e, shift));
    const out: Conflict[] = [];
    for (const d of await lint(fixed)) {
        if (before.some((b) => sameMsg(b, d, shift))) continue; // it was there before the fix
        const [ds, de] = d.fix ? [Math.min(d.range[0], d.fix.range[0]), Math.max(d.range[1], d.fix.range[1])] : d.range;
        if (d.fix && applyFix(fixed, d.fix) === text) {
            // a lower suggestion asking the old text back does not undo a higher rule's fix: that
            // suggestion is the one left out (its own check finds this rule restoring it)
            if (rank(d) > rank(m) && isTentative(d)) continue;
            out.push({ kind: "restores", by: d });
            continue;
        }
        // which of its letters does it touch? a fix: the letters it changes; no fix: its range
        const touched = d.fix
            ? editsOf(fixed, d.fix.range, d.fix.text).some((e2) => spans.some(([s, e]) => touches(e2, s, e)))
            : spans.some(([s, e]) => (e > s ? ds < e && de > s : ds <= s && de >= s));
        if (!touched) continue;
        if (!objects(d)) continue; // a suggestion that the new letters made possible, not an objection
        if (rank(d) < rank(m)) {
            out.push({ kind: "outranked", by: d });
            continue;
        }
        if (!d.fix) {
            out.push({ kind: "flags", by: d });
            continue;
        }
        // a further change by a rule no higher: fine, unless it brings `m`'s rule back
        const third = applyFix(fixed, d.fix);
        const back = (await lint(third)).some((x) => x.ruleId === m.ruleId && x.message === m.message && x.range[0] <= de + 2 && x.range[1] >= ds - 2);
        out.push({ kind: back ? "cycle" : "changes", by: d });
    }
    return out;
}

/**
 * Should the page keep quiet about `m`? Yes, if its fix would be taken back (at once or over
 * a further step), or a rule of higher precedence would find fault with what it puts in.
 */
export function outranked(m: Msg, conflicts: Conflict[]): boolean {
    return conflicts.some((c) => c.kind === "restores" || c.kind === "cycle" || c.kind === "outranked");
}
