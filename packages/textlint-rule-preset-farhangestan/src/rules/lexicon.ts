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
import { createPatternRule } from "../util/pattern-rule";
import { START, END, ZWNJ, escapeRegExp } from "../util/persian";
import multiSpelling from "../dict/multi-spelling.json";
import compounds from "../dict/compounds.json";
import hamza from "../dict/hamza.json";
import arabic from "../dict/arabic.json";

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

export default createPatternRule<Options>((options) => {
    const { map, pattern } = buildIndex(options.dictionaries);
    return {
        source: "دستور خط، فهرست‌ها",
        checks: [
            {
                pattern,
                check: (m) => {
                    const entry = map.get(key(m[1]));
                    if (!entry) return null;
                    // a suffix only after a hamza word («تاثیرات»); other lists match the word alone
                    const suffix = m[2] ?? "";
                    if (suffix && !HAMZA_ENTRIES.has(entry)) return null;
                    const to = entry.to + suffix;
                    if (entry.wholeWordOnly && m.input[m.index + m[0].length] === ZWNJ) return null;
                    if (entry.fix === false) {
                        return {
                            message: entry.message ?? `اگر در معنای اصطلاحی است، «${to}» نوشته می‌شود`,
                            replacement: to,
                            fix: false,
                            source: entry.source
                        };
                    }
                    return {
                        message: entry.message ?? `املای مرجّح «${to}» است`,
                        replacement: to,
                        source: entry.source
                    };
                }
            }
        ]
    };
});

