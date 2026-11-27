/*
 * کلمه‌هایی که به‌اشتباه پیوسته نوشته شده‌اند
 *
 * این قاعده چند بند کتاب را برای حالت «پیوسته‌نویسیِ نادرست» اجرا می‌کند.
 * همه یک شرط مشترک دارند: کلمه فقط وقتی اصلاح می‌شود که خودش واژۀ
 * شناخته‌شده‌ای نباشد (نه در واژه‌نامۀ Hazm، نه در فهرست پیوسته‌های کتاب) و
 * اجزایش شناخته‌شده باشند.
 *
 * ۱. ترکیب‌هایی که Hazm با نیم‌فاصله می‌شناسد: «پیشبینی» ← «پیش‌بینی».
 *    (ترکیب‌ها، بخش ب)
 * ۲. «ام، ای، است، ایم، اید، اند» و «ـَم، ـَت، ـَش، ـِمان، ـِتان، ـِشان» پس از
 *    «ه»ی غیرملفوظ و «ی»: «خستهام» ← «خسته‌ام»، «خانهمان» ← «خانه‌مان»،
 *    «خستهاست» ← «خسته است». (ص ۴۲–۴۶)
 * ۳. جزء اوّل مختوم به «ه»ی غیرملفوظ: «بهانهگیر» ← «بهانه‌گیر». (ترکیب‌ها، ب-۱۱)
 * ۴. «هم-» و پیشوندهای پیوندپذیر (برون، بوم، تک، درون، زیست، میان، نیم):
 *    «همکلاسی» ← «هم‌کلاسی»، «زیستفناوری» ← «زیست‌فناوری». (ص ۳۶–۴۰)
 * ۵. «هر» با کلمۀ بعد: «هرروز» ← «هر روز»، جز فهرست کتاب (هرکس، هرچند…). (ص ۳۵)
 * ۶. «به» در قیدها: «بسادگی» ← «به‌سادگی». (ص ۳۸)
 * ۷. «را» چسبیده به کلمۀ قبل: «کتابرا» ← «کتاب را». نام‌های خاصی مثل «لورا»،
 *    «نورا» و «کاپرا» هم به «را» ختم می‌شوند، پس یک مدل آماری کوچک
 *    (src/util/ezafe-model.ts، آموزش‌دیده روی ویکی‌پدیا) از روی کلمه‌های
 *    اطراف تصمیم می‌گیرد: از ۹۰٪ اطمینان اصلاح خودکار، از ۵۰٪ پیشنهاد. (ص ۳۵)
 */
import { otherReading, homographMessage } from "../util/homograph";
import { createPatternRule, PatternResult } from "../util/pattern-rule";
import { START, END, LETTER, LETTER_RANGE, ZWNJ, isNonJoining, toPersianDigits } from "../util/persian";
import { isKnown, isDictionaryWord, endsWithSilentHe, BOOK_JOINED } from "../util/words";
import { verbForm } from "./mi-prefix";
import hazmCompounds from "../dict/hazm-compounds.json";
import hazmBi from "../dict/hazm-bi.json";
import commonNouns from "../dict/hazm-common-nouns.json";
import hazmAdjectives from "../dict/hazm-adjectives.json";
import { isPresentStem } from "./mi-prefix";
import { raCandidates, RaCandidate } from "../util/ezafe-model";
import { gozarCorrection } from "./gozar";

const RA_FIX = 0.9;
const RA_SUGGEST = 0.5;
let raText = "";
let raCache = new Map<number, RaCandidate>();
function raAt(text: string, start: number): RaCandidate | undefined {
    if (text !== raText) {
        raText = text;
        raCache = new Map(raCandidates(text).map((c) => [c.start, c]));
    }
    return raCache.get(start);
}

const COMMON_NOUNS = new Set<string>(commonNouns.words);
const ADJECTIVES = new Set<string>(hazmAdjectives.adjectives);
/** A word common enough to be a compound part, not a rare homograph («یکه»، «ستد»). */
function solidPart(w: string): boolean {
    return COMMON_NOUNS.has(w) || ADJECTIVES.has(w) || isPresentStem(w) || (w.endsWith("ی") && (COMMON_NOUNS.has(w.slice(0, -1)) || ADJECTIVES.has(w.slice(0, -1))));
}

const COMPOUNDS: Record<string, string> = hazmCompounds.pairs;
const BI: Record<string, string> = hazmBi.pairs;
const BI_EXCEPTIONS = new Set(["بیجا", "بیچاره", "بیخود", "بیداد", "بیدل", "بیراه", "بیزار", "بیعار", "بیکار", "بینوا", "بیهوش"]);

/** The corrected form of a joined compound, if we know one («بیحوصله» → «بی‌حوصله»). */
function fixedCompound(word: string): string | null {
    if (BI_EXCEPTIONS.has(word)) return null;
    const fixed = COMPOUNDS[word] ?? BI[word] ?? null;
    // Hazm also lists names split into syllables («لی‌لی»): skip when no part has 3 letters
    if (fixed && fixed.split(ZWNJ).every((p) => p.length <= 2)) return null;
    return fixed;
}

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

/** Present stems that build many compounds (ب-۲): «زبان‌شناس»، «ریاضی‌دان». */
export const PRODUCTIVE_STEMS = [
    "شناس", "نویس", "پرداز", "پرور", "گذار", "پذیر", "رسان", "فروش", "آموز", "پرست", "نگار", "نشین",
    "سنج", "گزین", "افزا", "شکن", "تراش", "دان", "خوان", "بین", "یاب"
];

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

/** Words these heuristics misread: «همچین» (colloquial «such»), «تکنیک» (technique). */
const NOT_COMPOUNDS = new Set(["همچین", "همچی", "همچو", "همینطوری"]);

/** Second part a present stem (ب-۲). Runs before the known-word guard. */
function presentStemCompound(word: string): PatternResult | null {
    if (isDictionaryWord(word) || BOOK_JOINED.has(word)) return null;
    // plurals and nisba forms of known words: «شاهدان» (شاهد + ان)، «خاندانی» (خاندان + ی)
    if (word.endsWith("ان")) {
        const root = word.slice(0, -2);
        if (isKnown(root) && !PRODUCTIVE_STEMS.some((st) => root.endsWith(st))) return null;
    }
    if (word.endsWith("ی") && isDictionaryWord(word.slice(0, -1))) return null;
    // second part a present stem (ترکیب‌ها، ب-۲): «ریاضیدان» → «ریاضی‌دان»، «زبانشناسی» → «زبان‌شناسی».
    // Lexicalized joined forms («استاندار»، «خبرنگار») are in the dictionary and are kept;
    // Hazm also counts common misspellings («ریاضیدان») as words, so it is not consulted.
    for (const stem of PRODUCTIVE_STEMS) {
        const at = word.lastIndexOf(stem);
        if (at < 3) continue;
        const a = word.slice(0, at);
        const tail = word.slice(at + stem.length);
        if (!["", "ی", "ان", "انه", "ها", "های"].includes(tail) || !solidPart(a) || a === "است") continue;
        // «دان»، «خوان»، «بین» end many simple words: require a frequent noun before them
        if (["دان", "خوان", "بین", "یاب"].includes(stem) && !(COMMON_NOUNS.has(a) || (a.endsWith("ی") && COMMON_NOUNS.has(a.slice(0, -1))))) continue;
        const fixed = join(a, stem + tail);
        if (fixed === word) continue;
        return { message: `جزء دوم بن مضارع است و با نیم‌فاصله نوشته می‌شود: «${fixed}»`, replacement: fixed, source: "دستور خط، ترکیب‌ها، ب-۲، ص ۶۲" };
    }

    return null;
}

function check(word: string): PatternResult | null {
    if (NOT_COMPOUNDS.has(word) || word.startsWith("تکن")) return null;
    // «سپاسگذار» is «سپاسگزار», not «سپاس‌گذار»: the gozar rule's
    if (gozarCorrection(word)) return null;
    const stemCompound = presentStemCompound(word);
    if (stemCompound) return stemCompound;
    if (isKnown(word)) return null;
    // plural in «-ان» of a known word: «متهمان» is not «مته» + «مان»
    if (word.endsWith("ان") && isKnown(word.slice(0, -2))) return null;

    // three parts joined, where the first two are a compound we can fix and
    // the third a copula/possessive ending: «بیحوصلهاند» → «بی‌حوصله‌اند».
    // Checked before ownedElsewhere(): the بی- rule only sees whole words.
    // (plurals are left to the «ها» rule: «رویدادهای» is not «رویداده» + «ای»)
    const plural = /ها(ی|یی|یم|یت|یش|یمان|یتان|یشان)?$/.test(word);
    for (const suffix of plural ? [] : AFTER_HE) {
        if (!word.endsWith(suffix)) continue;
        const stem = word.slice(0, -suffix.length);
        const fixedStem = isKnown(stem) ? null : fixedCompound(stem);
        if (fixedStem && (endsWithSilentHe(stem) || (stem.endsWith("ی") && AFTER_YEH.includes(suffix)))) {
            const fixed = fixedStem + ZWNJ + suffix;
            return { message: `ترکیب و «${suffix}» هر دو با نیم‌فاصله: «${fixed}»`, replacement: fixed, source: S_COPULA };
        }
    }

    if (ownedElsewhere(word)) return null;

    // ۱. compounds Hazm writes with ZWNJ
    const compound = fixedCompound(word) && COMPOUNDS[word] ? COMPOUNDS[word] : null;
    if (compound) {
        const other = otherReading(word, compound);
        if (other) return { message: homographMessage(word, compound, other), replacement: compound, alternatives: [word], fix: false, source: S_COMPOUND };
        return { message: `ترکیب با نیم‌فاصله نوشته می‌شود: «${compound}»`, replacement: compound, source: S_COMPOUND };
    }

    // ۲. copula / possessive after silent ه or ی
    for (const suffix of AFTER_HE) {
        if (!word.endsWith(suffix)) continue;
        let stem = word.slice(0, -suffix.length);
        // three parts joined: «بیحوصلهاند» = «بیحوصله» (itself fixable) + «اند»
        const fixedStem = isKnown(stem) ? null : fixedCompound(stem);
        // «ایرانی» (nisba «ی» on a known word) counts as known: «ایرانیاند» → «ایرانی‌اند»
        // («-یات» is the Arabic plural: «هزلیات» is not «هزلی» + «ات»)
        const nisba = stem.endsWith("ی") && stem.length >= 5 && COMMON_NOUNS.has(stem.slice(0, -1)) && ["ام", "ای", "ایم", "اید", "اند"].includes(suffix);
        if (!isKnown(stem) && !fixedStem && !nisba) continue;
        if (fixedStem) stem = fixedStem;
        // «دریای» is «دریا» + ی (ezafe), not «دری» + «ای»
        if (suffix.startsWith("ا") && isKnown(stem + "ا")) continue;
        // «موجهات»، «وفیات»: Arabic plurals in «-ات», not «موجه» + «ات»
        if (suffix === "ات" && !COMMON_NOUNS.has(stem)) continue;
        if (endsWithSilentHe(stem) || (stem.endsWith("ی") && AFTER_YEH.includes(suffix))) {
            const fixed = stem + ZWNJ + suffix;
            return { message: `«${suffix}» با نیم‌فاصله نوشته می‌شود: «${fixed}»`, replacement: fixed, source: S_COPULA };
        }
    }
    // «شهرهاست» is «شهرها» + «ست», not «شهره» + «است»
    if (word.endsWith("است") && !(word.endsWith("هاست") && isKnown(word.slice(0, -4)))) {
        const stem = word.slice(0, -3);
        if (isKnown(stem) && endsWithSilentHe(stem)) {
            return { message: "«است» با فاصلۀ کامل نوشته می‌شود", replacement: stem + " است", source: S_COPULA };
        }
    }

    // suffixes that always take ZWNJ (ترکیب‌ها، الف-۱، تبصرۀ ۴): «ترشیجات» → «ترشی‌جات»
    // (and «-وار»، «-سان» (تبصرۀ ۱ و ۲) and «-خانه»، «-نامه» (تبصرۀ ۵), whose lexicalized
    // joined forms («بزرگوار»، «یکسان»، «کتابخانه») are known words and never reach here)
    for (const suffix of ["جات", "آسا", "آگین", "باره", "فام", "وش", "وار", "سان", "خانه", "نامه"]) {
        if (!word.endsWith(suffix)) continue;
        const stem = word.slice(0, -suffix.length);
        if (stem.length >= 2 && isKnown(stem) && !isNonJoining(stem[stem.length - 1])) {
            const fixed = stem + ZWNJ + suffix;
            // «مرگوش» (a place) is not «مرگ» + «وش»: the rarer suffixes are only suggested
            const rare = suffix === "وش" || suffix === "فام";
            return { message: `«-${suffix}» با نیم‌فاصله نوشته می‌شود: «${fixed}»`, replacement: fixed, fix: rare ? false : undefined, source: "دستور خط، ترکیب‌ها، الف-۱، تبصرۀ ۴، ص ۵۹–۶۰" };
        }
    }

    // ۴. prefixes that take ZWNJ
    for (const prefix of PREFIXES) {
        if (!word.startsWith(prefix)) continue;
        const rest = word.slice(prefix.length);
        // «تکمیلی» is «تکمیل» + «ی», not «تک» + «میلی»; «بومیس» is a name
        if (word.endsWith("ی") && isKnown(word.slice(0, -1))) continue;
        if (rest.length >= 3 && isKnown(rest) && (solidPart(rest) || isKnown(join(prefix, rest)))) {
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
                message: `«هر» معمولاً با فاصلۀ کامل نوشته می‌شود: «هر ${rest}»`,
                replacement: "هر " + rest,
                kind: "suggestion",
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
        // an adverb from an adjective («سادگی» ← «ساده»); «بزندگی»، «بحکمرانی» are «به» + noun
        if (isKnown(rest) && ADJECTIVES.has(base) && !COMMON_NOUNS.has(rest) && !verbForm(rest) && !BOOK_JOINED.has(word)) {
            const fixed = "به" + ZWNJ + rest;
            return { message: `«به» در قید با نیم‌فاصله نوشته می‌شود: «${fixed}»`, replacement: fixed, source: S_BE };
        }
    }

    // «-گر، -گری» after «ط، ظ» take ZWNJ (ترکیب‌ها، الف-۱، تبصرۀ ۳): «افراطگری» → «افراط‌گری»
    const gar = word.match(/^(.+[طظ])(گر|گری|گرا|گرایی)$/);
    if (gar && isKnown(gar[1])) {
        const fixed = gar[1] + ZWNJ + gar[2];
        return { message: `«-${gar[2]}» پس از «${gar[1].slice(-1)}» با نیم‌فاصله نوشته می‌شود: «${fixed}»`, replacement: fixed, source: "دستور خط، ترکیب‌ها، الف-۱، تبصرۀ ۳، ص ۵۹" };
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
    const heSplits = splits.filter(([a, b]) => a.length >= 3 && b.length >= 3 && endsWithSilentHe(a) && solidPart(b));
    // any other way to split the word into two known words makes it ambiguous
    const otherSplits = splits.filter(([a]) => !(a.length >= 3 && endsWithSilentHe(a)));
    if (heSplits.length > 0 && otherSplits.length === 0) {
        const [a, b] = heSplits[heSplits.length - 1];
        const fixed = a + ZWNJ + b;
        return { message: `پس از «ه»ی غیرملفوظ نیم‌فاصله لازم است: «${fixed}»`, replacement: fixed, source: S_SILENT_HE };
    }

    return null;
}

export default createPatternRule(() => ({
    source: S_COMPOUND,
    checks: [
        {
            // the word may continue after a ZWNJ («پیشبینی‌ها»)
            pattern: new RegExp(`${START}${LETTER}{4,}(?=${ZWNJ}|${END})`, "g"),
            check: (m) => check(m[0])
        },
        {
            // ۷. plural + «را» joined: «کتاب‌هارا»، «کتابهارا» → «کتاب‌ها را»
            pattern: new RegExp(`${START}([${LETTER_RANGE}${ZWNJ}]+?)${ZWNJ}?هارا${END}`, "g"),
            check: (m) => {
                const root = m[1];
                if (root.length < 2 || !isKnown(root.replace(/\u200c/g, ""))) return null;
                const fixed = join(root, "ها") + " را";
                // «گندهارا»، «ویهارا» are names: fix only after a frequent word
                const plain = root.replace(/\u200c/g, "");
                const sure = COMMON_NOUNS.has(plain) || ADJECTIVES.has(plain);
                return { message: `«را» با فاصلۀ کامل نوشته می‌شود: «${fixed}»`, replacement: fixed, fix: sure ? undefined : false, source: S_RA };
            }
        },
        {
            // ۷. «را» joined: «کتابرا» → «کتاب را» (the model tells names like «لورا» apart)
            pattern: new RegExp(`${START}(${LETTER}{2,})را${END}`, "g"),
            check: (m) => {
                const c = raAt(m.input, m.index);
                if (!c || c.p < RA_SUGGEST) return null;
                const fixed = m[1] + " را";
                return {
                    message: `«را» با فاصلۀ کامل نوشته می‌شود: «${fixed}» (احتمال ${toPersianDigits(Math.round(c.p * 100))}٪)`,
                    replacement: fixed,
                    // a rare first part may be a place or a name («نوشرا»): suggest only
                    fix: c.p >= RA_FIX && COMMON_NOUNS.has(m[1]) ? undefined : false,
                    source: S_RA
                };
            }
        }
    ]
}));
