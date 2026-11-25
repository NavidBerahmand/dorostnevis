/*
 * کلمه‌هایی که به‌اشتباه پیوسته نوشته شده‌اند
 *
 * این قاعده چند بند کتاب را برای حالت «پیوسته‌نویسیِ نادرست» اجرا می‌کند.
 * همه یک شرط مشترک دارند: کلمه فقط وقتی اصلاح می‌شود که خودش واژهٔ
 * شناخته‌شده‌ای نباشد (نه در واژه‌نامهٔ Hazm، نه در فهرست پیوسته‌های کتاب) و
 * اجزایش شناخته‌شده باشند.
 *
 * ۱. ترکیب‌هایی که Hazm با نیم‌فاصله می‌شناسد: «پیشبینی» ← «پیش‌بینی».
 *    (ترکیب‌ها، بخش ب)
 * ۲. «ام، ای، است، ایم، اید، اند» و «ـَم، ـَت، ـَش، ـِمان، ـِتان، ـِشان» پس از
 *    «ه»ی غیرملفوظ و «ی»: «خستهام» ← «خسته‌ام»، «خانهمان» ← «خانه‌مان»،
 *    «خستهاست» ← «خسته است». (ص ۴۲–۴۵)
 * ۳. جزء اوّل مختوم به «ه»ی غیرملفوظ: «بهانهگیر» ← «بهانه‌گیر». (ترکیب‌ها، ب-۱۱)
 * ۴. «هم-» و پیشوندهای پیوندپذیر (برون، بوم، تک، درون، زیست، میان، نیم):
 *    «همکلاسی» ← «هم‌کلاسی»، «زیستفناوری» ← «زیست‌فناوری». (ص ۳۶–۴۰)
 * ۵. «هر» با کلمهٔ بعد: «هرروز» ← «هر روز»، جز فهرست کتاب (هرکس، هرچند…). (ص ۳۵)
 * ۶. «به» در قیدها: «بسادگی» ← «به‌سادگی». (ص ۳۸)
 * ۷. «را» چسبیده به کلمهٔ قبل: «کتابرا» ← «کتاب را». فقط پیشنهاد، بدون اصلاح
 *    خودکار، چون نام‌های خاصی مثل «سمیرا» هم به «را» ختم می‌شوند. (ص ۳۵)
 */
import { createPatternRule, PatternResult } from "../util/pattern-rule";
import { START, END, LETTER, ZWNJ, isNonJoining } from "../util/persian";
import { isKnown, endsWithSilentHe, BOOK_JOINED } from "../util/words";
import { verbForm } from "./mi-prefix";
import hazmCompounds from "../dict/hazm-compounds.json";

const COMPOUNDS: Record<string, string> = hazmCompounds.pairs;

const S_COMPOUND = "دستور خط، ترکیب‌ها، بخش ب، ص ۶۱–۶۷";
const S_COPULA = "دستور خط، «مجموعۀ ام…» ص ۴۲ و «ضمایر ملکی» ص ۴۴";
const S_SILENT_HE = "دستور خط، ترکیب‌ها، ب-۱۱، ص ۶۶";
const S_PREFIX = "دستور خط، «پیشوندها» ص ۳۶ و «هم» ص ۴۰";
const S_HAR = "دستور خط، «هر»، ص ۳۵";
const S_BE = "دستور خط، «به»، ص ۳۸";
const S_RA = "دستور خط، «را»، ص ۳۵";

/** Copula and possessive endings; the second list is what may follow a final «ی». */
const AFTER_HE = ["ایم", "اید", "اند", "مان", "تان", "شان", "ام", "ای", "اش", "ات"];
const AFTER_YEH = ["ایم", "اید", "اند", "ام", "ای", "اش", "ات"];

const PREFIXES = ["برون", "بوم", "تک", "درون", "زیست", "میان", "نیم", "هم"];

/** Join two parts the way the book does: ZWNJ after a joining letter, nothing after a non-joining one. */
function join(a: string, b: string): string {
    return isNonJoining(a[a.length - 1]) ? a + b : a + ZWNJ + b;
}

/** Tokens other rules own: leave them alone here. */
function ownedElsewhere(word: string): boolean {
    return (
        /^(ن?می|بی)/.test(word) ||
        /(ها|های|هایی|هایم|هایت|هایش|هایمان|هایتان|هایشان)$/.test(word) ||
        /(تر|ترین)$/.test(word)
    );
}

function check(word: string): PatternResult | null {
    if (isKnown(word) || ownedElsewhere(word)) return null;

    // ۱. compounds Hazm writes with ZWNJ
    const compound = COMPOUNDS[word];
    if (compound) {
        return { message: `ترکیب با نیم‌فاصله نوشته می‌شود: «${compound}»`, replacement: compound, source: S_COMPOUND };
    }

    // ۲. copula / possessive after silent ه or ی
    for (const suffix of AFTER_HE) {
        if (!word.endsWith(suffix)) continue;
        const stem = word.slice(0, -suffix.length);
        if (!isKnown(stem)) continue;
        // «دریای» is «دریا» + ی (ezafe), not «دری» + «ای»
        if (suffix.startsWith("ا") && isKnown(stem + "ا")) continue;
        if (endsWithSilentHe(stem) || (stem.endsWith("ی") && AFTER_YEH.includes(suffix))) {
            const fixed = stem + ZWNJ + suffix;
            return { message: `«${suffix}» با نیم‌فاصله نوشته می‌شود: «${fixed}»`, replacement: fixed, source: S_COPULA };
        }
    }
    if (word.endsWith("است")) {
        const stem = word.slice(0, -3);
        if (isKnown(stem) && endsWithSilentHe(stem)) {
            return { message: "«است» با فاصلهٔ کامل نوشته می‌شود", replacement: stem + " است", source: S_COPULA };
        }
    }

    // ۴. prefixes that take ZWNJ
    for (const prefix of PREFIXES) {
        if (!word.startsWith(prefix)) continue;
        const rest = word.slice(prefix.length);
        if (rest.length >= 2 && isKnown(rest)) {
            const fixed = join(prefix, rest);
            return { message: `«${prefix}» با نیم‌فاصله نوشته می‌شود: «${fixed}»`, replacement: fixed, source: S_PREFIX };
        }
    }

    // ۵. «هر» + word. The book's list of lexicalized forms is open («مانند»),
    // so this is a suggestion only.
    if (word.startsWith("هر")) {
        const rest = word.slice(2);
        if (rest.length >= 3 && isKnown(rest)) {
            return {
                message: `«هر» معمولاً با فاصلهٔ کامل نوشته می‌شود: «هر ${rest}»`,
                replacement: "هر " + rest,
                fix: false,
                source: S_HAR
            };
        }
    }

    // ۶. «به» + adverb in -ی: «بسادگی» → «به‌سادگی»
    if (word.startsWith("ب") && word.endsWith("ی") && word.length >= 5) {
        const rest = word.slice(1);
        // the base must be a known word too: «زودی» ← «زود», «سادگی» ← «ساده»
        const base = rest.endsWith("گی") ? rest.slice(0, -2) + "ه" : rest.slice(0, -1);
        if (isKnown(rest) && isKnown(base) && !verbForm(rest) && !BOOK_JOINED.has(word)) {
            const fixed = "به" + ZWNJ + rest;
            return { message: `«به» در قید با نیم‌فاصله نوشته می‌شود: «${fixed}»`, replacement: fixed, source: S_BE };
        }
    }

    // ۳. first part ending in a silent ه: «بهانهگیر» → «بهانه‌گیر».
    // Skipped when the word also splits another way into two known words
    // («غیرهشیار» = «غیر» + «هشیار», not «غیره» + «شیار»).
    const splits: Array<[string, string]> = [];
    for (let i = 2; i <= word.length - 2; i++) {
        const a = word.slice(0, i);
        const b = word.slice(i);
        if (isKnown(a) && isKnown(b)) splits.push([a, b]);
    }
    const heSplits = splits.filter(([a]) => a.length >= 3 && endsWithSilentHe(a));
    if (heSplits.length > 0 && heSplits.length === splits.length) {
        const [a, b] = heSplits[heSplits.length - 1];
        const fixed = a + ZWNJ + b;
        return { message: `پس از «ه»ی غیرملفوظ نیم‌فاصله لازم است: «${fixed}»`, replacement: fixed, source: S_SILENT_HE };
    }

    // ۷. «را» joined to the previous word: suggestion only
    if (word.endsWith("را") && word.length >= 5) {
        const stem = word.slice(0, -2);
        if (isKnown(stem)) {
            return { message: `«را» با فاصلهٔ کامل نوشته می‌شود: «${stem} را»`, replacement: stem + " را", fix: false, source: S_RA };
        }
    }
    return null;
}

export default createPatternRule(() => ({
    source: S_COMPOUND,
    checks: [
        {
            pattern: new RegExp(`${START}${LETTER}{4,}${END}`, "g"),
            check: (m) => check(m[0])
        }
    ]
}));
