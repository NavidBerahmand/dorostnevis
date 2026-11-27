/*
 * واژه‌نامه: املای مرجّح فرهنگستان برای کلمه‌های مشخص
 *
 * سه فهرست، هر کدام با ارجاع به دستور خط:
 * - multi-spelling: «فهرست واژه‌های عامّ و نام‌های خاصّ دو یا چنداملایی»
 *   (ص ۷۳ و ۸۲). از روی کتاب با scripts/extract_multi_spelling.py ساخته می‌شود.
 * - compounds: فهرست‌های بستهٔ کتاب برای «هیچ، همین، همان، این، آن، هر، را»،
 *   استثناهای «هم-»، حروف اضافه و ربط مرکّب (ص ۳۴–۴۰ و ۶۹–۷۱).
 * - arabic: «زکوة ← زکات»، الف مقصوره («تقوی ← تقوا»)، «طاوس ← طاووس» و
 *   عبارت‌های عربیِ اصطلاح‌شده (ب-۹: «ان شاء الله ← ان‌شاءالله»). (ص ۵۴–۵۷، ۶۴)
 * - hamza: نمونه‌های جدول ۳ «کتابت همزه» و غلط‌های رایجی که خود کتاب نام
 *   برده (رییس، ارایه، جزیی، قرایت).
 *
 * همزه در شکل‌های ساخته‌شده هم گرفته می‌شود: «تاثیرات» ← «تأثیرات»، «ماموران» ← «مأموران»،
 * «متاسفانه» ← «متأسفانه» (پسوندهای پیوسته پس از کلمهٔ فهرست).
 *
 * هر فهرست را می‌شود با گزینه خاموش کرد:
 *   { "dictionaries": { "hamza": false } }
 */
import { otherReading, homographMessage } from "../util/homograph";
import { createPatternRule } from "../util/pattern-rule";
import { START, END, ZWNJ, escapeRegExp } from "../util/persian";
import multiSpelling from "../dict/multi-spelling.json";
import compounds from "../dict/compounds.json";
import hamza from "../dict/hamza.json";
import arabic from "../dict/arabic.json";
import { isKnown } from "../util/words";
import { corpusBucket } from "../util/speller";

/**
 * «تقویت» is not «تقوی» + «ت», nor «تقویم» «تقوی» + «م» (1.4.1). A match that takes a listed
 * word plus an affix never fires on a token that is itself a word (Hazm, the farhang, or seen
 * at least 16 times in the corpus), unless the corrected form is attested too and about as
 * common: then it is the same word misspelt («ماموریت» ← «مأموریت»، «جزییات» ← «جزئیات»),
 * not another word («رایش»، «رایان»، «نباش»). "word": leave it; "maybe" (a rarer form, seen 4 to 15
 * times: «راستر» or «سوالاتش»?): ask, never red; null: the affix reading stands.
 */
export function anotherWord(token: string, to: string): "word" | "maybe" | null {
    const bt = corpusBucket(token);
    const known = isKnown(token) || (bt !== null && bt >= 4);
    if (!known && !(bt !== null && bt >= 2)) return null;
    const parts = to.split(/ +/);
    if (isKnown(to) || parts.every(isKnown)) return null;
    if (bt === null) return "word"; // not loaded yet: a known word stays as it is
    const bto = Math.min(...parts.map((p) => (isKnown(p) ? 99 : corpusBucket(p) ?? -1)));
    if (bto >= 0 && bto >= bt - 3) return null;
    return known ? "word" : "maybe";
}
/** The message for a «maybe»: the token may be a word of its own. */
const maybeMessage = (token: string, to: string) => `اگر «${token}» همان واژهٔ فهرست با پسوند است، «${to}» نوشته می‌شود؛ ولی «${token}» خودش هم می‌تواند واژه یا نام باشد`;

export interface Options {
    dictionaries?: {
        multiSpelling?: boolean;
        compounds?: boolean;
        hamza?: boolean;
        arabic?: boolean;
    };
}

interface Entry {
    from: string[];
    to: string;
    source: string;
    /** false: report only (the right form depends on meaning) */
    fix?: boolean;
    /** overrides the default message */
    message?: string;
    /** not when the word continues after a ZWNJ: Arabic terms keep their spelling («مستثنی‌منه») */
    wholeWordOnly?: boolean;
    /** not before this (a RegExp source tested on the text after the word): «مبنی بر» is idiomatic */
    notBefore?: string;
}

const DICTIONARIES: Record<keyof NonNullable<Options["dictionaries"]>, { entries: Entry[] }> = {
    multiSpelling,
    compounds,
    hamza,
    arabic
};

/** Collapse runs of spaces so «هیچ  کس» matches the entry «هیچ کس». */
function key(s: string): string {
    return s.replace(/ +/g, " ");
}

/** Joined suffixes after a hamza word: «تاثیرات»، «ماموران»، «متاسفانه»، «تاثیرگذار». */
const HAMZA_SUFFIX = "(ات|ها|های|ی|ای|یی|ان|انه|ش|شان|تر|ترین|گذار|گذاری|پذیر|پذیری|آمیز|یت)?";
const HAMZA_ENTRIES = new Set<Entry>(hamza.entries as Entry[]);

function buildIndex(enabled: Options["dictionaries"]) {
    const map = new Map<string, Entry>();
    for (const [name, dict] of Object.entries(DICTIONARIES)) {
        if (enabled?.[name as keyof typeof DICTIONARIES] === false) continue;
        for (const entry of dict.entries) {
            for (const form of entry.from) {
                if (!map.has(form)) map.set(form, entry);
            }
        }
    }
    // longest forms first, so «در حالی که» wins over shorter overlaps
    const forms = [...map.keys()].sort((a, b) => b.length - a.length);
    const alternation = forms.map((f) => escapeRegExp(f).replace(/ /g, " +")).join("|");
    // the word may continue after a ZWNJ: «بلیط‌ها», «اطاق‌ها»
    const pattern = new RegExp(`${START}(${alternation})${HAMZA_SUFFIX}(?=${ZWNJ}|${END})`, "g");
    return { map, pattern };
}

/**
 * What the writer is told, by the book's rule rather than «املای مرجّح» wherever the rule is a
 * general one (since 1.4.0: «املای مرجّح «معنا» است» did not say why). «املای مرجّح» stays for
 * the book's list of words with several accepted spellings, where it just picks one.
 */
function messageFor(entry: Entry, from: string, to: string): string {
    const src = entry.source;
    if (/«تنوین»/.test(src)) return `تنوین نصب «اً» نوشته می‌شود: «${to}»`;
    if (/الف مقصوره در حالت اضافه/.test(src)) return `الف مقصوره در حالت اضافه «ای» نوشته می‌شود: «${to}» (نه «${from}»)`;
    if (/«الف مقصوره»/.test(src) || (/«واژه‌های برگرفته از عربی»/.test(src) && /ی$/.test(from) && /ا$/.test(to)))
        return `در دستور خط، الف مقصورهٔ کلمه‌های عربی همیشه «ا» نوشته می‌شود: «${to}» (نه «${from}»)`;
    if (/ة/.test(from)) return `در دستور خط، «ة»ی کلمه‌های عربی در فارسی «ت» نوشته می‌شود: «${to}» (نه «${from}»)`;
    if (/«هجای میانی و پایانی ـ وو ـ»/.test(src)) return `در دستور خط، «و»ی بلند پس از «و» دوبار نوشته می‌شود: «${to}» (نه «${from}»)`;
    if (/«نشانۀ همزه»/.test(src)) return `بنا بر قاعدهٔ همزه در دستور خط: «${to}» (نه «${from}»)`;
    if (/فهرست (واژه‌های عامّ|نام‌های خاصّ) دو یا چنداملایی/.test(src)) return `املای مرجّح «${to}» است`;
    const section = src.match(/«([^«»]+)»/)?.[1];
    if (/ترکیب‌ها/.test(src)) return `بنا بر قاعدهٔ ترکیب‌ها در دستور خط: «${to}» (نه «${from}»)`;
    if (section) return `بنا بر دستور خط («${section.replace("ۀ", "هٔ")}»): «${to}» (نه «${from}»)`;
    return `املای مرجّح «${to}» است`;
}

/** Alif maqsura words («معنی» ← «معنا»), so that «بی‌معنی»، «معنیش» follow the word itself. */
const isMaqsura = (e: Entry) => /«الف مقصوره»/.test(e.source) || (/«واژه‌های برگرفته از عربی»/.test(e.source) && e.from.some((f) => /ی$/.test(f)) && /ا$/.test(e.to));

export default createPatternRule<Options>((options) => {
    const { map, pattern } = buildIndex(options.dictionaries);
    const maqsura = [...map.entries()].filter(([f, e]) => isMaqsura(e) && !f.includes(" ")).map(([f]) => f);
    const MAQSURA = maqsura.length
        ? new RegExp(`${START}(بی${ZWNJ}?)?(${maqsura.map(escapeRegExp).join("|")})(ش|ت|م|مان|تان|شان)?(?=${ZWNJ}|${END})`, "g")
        : null;
    return {
        source: "دستور خط، فهرست‌ها",
        checks: [
            ...(MAQSURA
                ? [
                      {
                          // «بی‌معنی» ← «بی‌معنا»، «معنیش» ← «معنایش» (the plain word is the next check's)
                          pattern: MAQSURA,
                          check: (m: RegExpExecArray) => {
                              if (!m[1] && !m[3]) return null;
                              const entry = map.get(m[2])!;
                              const to = (m[1] ? "بی" + ZWNJ : "") + entry.to + (m[3] ? "ی" + m[3] : "");
                              // «تقویت»، «تقویم»، and «بی‌تقویم» (not «بی» + «تقوی» + «م»)
                              const other = anotherWord(m[0], to) ?? (m[1] && m[3] ? anotherWord(m[2] + m[3], entry.to + "ی" + m[3]) : null);
                              if (other === "word") return null;
                              if (other === "maybe") return { message: maybeMessage(m[0], to), replacement: to, fix: false, source: entry.source };
                              return { message: messageFor(entry, m[0], to), replacement: to, source: entry.source };
                          }
                      }
                  ]
                : []),
            {
                pattern,
                check: (m) => {
                    const entry = map.get(key(m[1]));
                    if (!entry) return null;
                    // a suffix only after a hamza word («تاثیرات»); other lists match the word alone
                    const suffix = m[2] ?? "";
                    if (suffix && !HAMZA_ENTRIES.has(entry)) return null;
                    const to = entry.to + suffix;
                    // the base plus the suffix can be another word: «رای» + «انه» is «رایانه», «جزئ» + «ی» is «جزئی»
                    if (suffix && isKnown(m[1] + suffix) && !isKnown(to)) return null;
                    const another = suffix ? anotherWord(m[1] + suffix, to) : null;
                    if (another === "word") return null;
                    if (another === "maybe") return { message: maybeMessage(m[1] + suffix, to), replacement: to, fix: false, source: entry.source };
                    if (entry.wholeWordOnly && m.input[m.index + m[0].length] === ZWNJ) return null;
                    if (entry.notBefore && new RegExp(entry.notBefore).test(m.input.slice(m.index + m[0].length))) return null;
                    if (entry.fix === false) {
                        return {
                            message: entry.message ?? `اگر در معنای اصطلاحی است، «${to}» نوشته می‌شود`,
                            replacement: to,
                            fix: false,
                            source: entry.source
                        };
                    }
                    // «عقبی»: also «عقب» + «ی», a different word: never red
                    const other = suffix ? null : otherReading(m[1], to, (b) => map.get(key(b))?.to);
                    if (other) return { message: homographMessage(m[1], to, other), replacement: to, alternatives: [m[1]], fix: false, source: entry.source };
                    return {
                        message: entry.message ?? messageFor(entry, m[1].replace(/ +/g, " ") + suffix, to),
                        replacement: to,
                        source: entry.source
                    };
                }
            }
        ]
    };
});

