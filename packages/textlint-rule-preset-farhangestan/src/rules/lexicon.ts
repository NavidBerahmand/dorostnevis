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
 * هر فهرست را می‌شود با گزینه خاموش کرد:
 *   { "dictionaries": { "hamza": false } }
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, escapeRegExp } from "../util/persian";
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
    const pattern = new RegExp(`${START}(?:${alternation})${END}`, "g");
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
                    const entry = map.get(key(m[0]));
                    if (!entry) return null;
                    if (entry.fix === false) {
                        return {
                            message: `اگر در معنای اصطلاحی است، «${entry.to}» نوشته می‌شود`,
                            fix: false,
                            source: entry.source
                        };
                    }
                    return {
                        message: `املای مرجّح «${entry.to}» است`,
                        replacement: entry.to,
                        source: entry.source
                    };
                }
            }
        ]
    };
});

