/*
 * کسرهٔ اضافه پس از «ه»ی غیرملفوظ
 *
 * دستور خط، «کسرۀ اضافه» (ص ۴۷):
 *   برای کلمه‌های مختوم به «ها»ی غیرملفوظ، در حالت اضافه، از علامت «ۀ/ ‍ۀ»
 *   استفاده می‌شود: برنامۀ روزانه، بندۀ خدا، به‌مثابۀ، خانۀ او، رانندۀ ماهر
 *   … کلمه‌های مختوم به «ها»ی ملفوظ، در حالت اضافه، کسره می‌گیرند:
 *   بازدهِ تولید، گرهِ کور، فرماندهِ سپاه
 *
 * - «خانه ی من»، «خانه‌ی من»، «خانه‌یِ من» ← «خانۀ من»
 * - «خانهٔ من» (ه + همزهٔ بالا U+0654) ← «خانۀ من» (U+06C0)، مگر با گزینهٔ
 *   { "style": "he-hamza" } که برعکس عمل می‌کند.
 *
 * «ه»ی ملفوظ (راه، کوه، فقیه، گره…) کنار گذاشته می‌شود: کلمه‌ای که پیش از
 * «ه» مصوّت بلند (ا، و، ی) دارد یا در فهرست زیر است.
 *
 * کسرهٔ اضافه‌ای که «ه» نوشته شده: «کتابه من» ← «کتاب من». کسرهٔ اضافه پس
 * از حرف بی‌صدا نوشته نمی‌شود (یا با ـِ نشان داده می‌شود). فقط وقتی که
 * «کتابه» خودش کلمهٔ شناخته‌شده‌ای نیست و «کتاب» هست:
 * - پیش از ضمیر (من، تو، او…) اصلاح خودکار؛
 * - پیش از کلمه‌های دیگر فقط پیشنهاد، و فقط در متن رسمی، چون در گفتار
 *   «کتابه» نشانهٔ معرفه هم هست («این کتابه خوبه»).
 * شکل‌های گفتاری مثل «خونه» (خانه) و «نشونه» (نشانه) کنار گذاشته می‌شوند.
 *
 * کسرهٔ اضافهٔ جاافتاده («خانه قبلی» ← «خانۀ قبلی»): اینکه کلمه در حالت اضافه
 * است یا نه را قاعده نمی‌تواند بگوید؛ یک مدل آماری کوچک (src/util/ezafe-model.ts)
 * از روی کلمه‌های اطراف حدس می‌زند. اگر مدل دست‌کم ۹۰٪ مطمئن باشد و کلمه
 * شناخته‌شده باشد اصلاح خودکار، و از ۶۰٪ به بالا فقط پیشنهاد. با گزینهٔ
 * { "model": false } خاموش می‌شود.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, ZWNJ, toPersianDigits } from "../util/persian";
import { isKnown, isDictionaryWord, endsWithSilentHe } from "../util/words";
import hazmCompounds from "../dict/hazm-compounds.json";

const COMPOUNDS: Record<string, string> = hazmCompounds.pairs;

/**
 * «رشته کوه»، «جامعه شناسان»: a compound written with a space, not an ezafe.
 * Returns the compound as it should be written, if the two words form one.
 */
function spacedCompound(w0: string, w1: string): string | null {
    for (const end of ["", "ها", "های", "ان", "انی", "ی", "ای"]) {
        if (end && !w1.endsWith(end)) continue;
        const stem = end ? w1.slice(0, -end.length) : w1;
        if (stem.length < 2) continue;
        const joined = w0 + ZWNJ + stem;
        if (isDictionaryWord(joined) || isKnown(joined) || COMPOUNDS[w0 + stem] === joined) return w0 + ZWNJ + w1;
    }
    return null;
}
import { verbForm } from "./mi-prefix";
import hazmAdjectives from "../dict/hazm-adjectives.json";
import commonNouns from "../dict/hazm-common-nouns.json";
import { ezafeCandidates, EzafeCandidate } from "../util/ezafe-model";
import { accepted, spellingReady } from "../util/speller";

/**
 * Thresholds on the calibrated probability (scripts/ezafe-model/calibrate.py).
 * At 0.9: 94–96% precision and 48–65% recall on the book and on 300
 * hand-labelled Wikipedia cases. Fixed automatically from 0.9, suggested from 0.6.
 */
const MODEL_FIX = 0.9;
const MODEL_SUGGEST = 0.6;

/** The model's candidates for the last text seen (a rule sees one node's text at a time). */
let cachedText = "";
let cached = new Map<number, EzafeCandidate>();
function candidateAt(text: string, start: number): EzafeCandidate | undefined {
    if (text !== cachedText) {
        cachedText = text;
        cached = new Map(ezafeCandidates(text).map((c) => [c.start, c]));
    }
    return cached.get(start);
}

const ADJECTIVES = new Set<string>(hazmAdjectives.adjectives);
const COMMON_NOUNS = new Set<string>(commonNouns.words);

export interface Options {
    /** "he-yeh" → ۀ (U+06C0, the book's form); "he-hamza" → هٔ (ه + U+0654). */
    style?: "he-yeh" | "he-hamza";
    /** false in story dialogue, where «کتابه» may be the definite marker. Default true. */
    formal?: boolean;
    /** false turns off the ezafe model (missing «ۀ» before other words). Default true. */
    model?: boolean;
}

const SOURCE = "دستور خط، «کسرۀ اضافه»، ص ۴۷";

/** Short words ending in a pronounced «ه» (ملفوظ). */
const PRONOUNCED_HE = new Set([
    "به", "مه", "ده", "ره", "شه", "که", "گره", "زره", "بزه", "فربه", "توجه", "متوجه",
    "منزه", "مشتبه", "مشبه", "تنبه", "متنبه", "فرمانده", "بازده", "سپهبد"
]);

function isPronouncedHe(word: string): boolean {
    if (PRONOUNCED_HE.has(word)) return true;
    const before = word[word.length - 2];
    // long vowel before ه → pronounced: راه، کوه، فقیه، شبیه، گناه
    return before === "ا" || before === "و" || before === "ی" || before === "آ";
}

const PRONOUNS = new Set([
    "من", "تو", "او", "ما", "شما", "آنها", "آن‌ها", "ایشان", "اون", "اونا", "اونها", "اون‌ها",
    "خودم", "خودت", "خودش", "خودمان", "خودتان", "خودشان", "خودمون", "خودتون", "خودشون"
]);
/** Words after which «Xه» is more likely the definite marker or copula than an ezafe. */
const NOT_EZAFE_NEXT = new Set([
    "که", "را", "رو", "و", "هم", "از", "به", "با", "در", "تا", "یا", "اگه", "اگر", "چی", "کو",
    "است", "هست", "نیست", "بود", "شد", "می", "نمی", "خیلی", "دیگه", "دیگر", "اینجا", "اونجا"
]);

/** «کتابه» written for «کتابِ»: the stem, if this is that mistake. */
function ezafeWrittenAsHe(word: string): string | null {
    const stem = word.slice(0, -1);
    if (stem.length < 2 || isKnown(word) || !isKnown(stem)) return null;
    if ("اآوهة".includes(stem[stem.length - 1])) return null;
    // spoken forms of known words: «خونه» (خانه)، «نشونه» (نشانه)
    const i = word.lastIndexOf("ون");
    if (i >= 0 && isKnown(word.slice(0, i) + "ان" + word.slice(i + 2))) return null;
    return stem;
}

const EZAFE_PRONOUNS = ["من", "تو", "او", "ما", "شما", "ایشان", "آنها", "آن‌ها", "وی"];
/** Conjunctions and adverbs in «ه»: «بلکه ما»، «همیشه او» are not ezafes. */
const NOT_EZAFE = new Set([
    "بلکه", "که", "چه", "آنچه", "هرچه", "چنانچه", "اگرچه", "گرچه", "همیشه", "البته", "تازه", "دوباره", "همواره",
    "هماره", "یکباره", "وگرنه", "نه", "آهسته", "ناگه", "شبانه", "روزانه", "همانا", "زیراکه", "چنانکه", "آنکه", "اینکه"
]);

export default createPatternRule<Options>((options) => {
    const target = options.style === "he-hamza" ? "هٔ" : "ۀ";
    return {
        source: SOURCE,
        checks: [
            {
                // word ending in ه + (space|ZWNJ) + ی (optionally with kasra) as a separate token
                pattern: new RegExp(`${START}(${LETTER}*ه)[ ${ZWNJ}]ی\\u0650?${END}`, "g"),
                check: (m) => {
                    if (isPronouncedHe(m[1])) return null;
                    return {
                        message: `نشانهٔ اضافه پس از «ه»ی غیرملفوظ «${target}» است، نه «ی» جدا`,
                        replacement: m[1].slice(0, -1) + target
                    };
                }
            },
            {
                // «کتابه من»: the next word is looked at but not consumed
                pattern: new RegExp(`${START}(${LETTER}{3,}ه)(?= (${LETTER}+)${END})`, "g"),
                check: (m) => {
                    const stem = ezafeWrittenAsHe(m[1]);
                    if (!stem) return null;
                    const next = m[2];
                    const pronoun = PRONOUNS.has(next);
                    if (!pronoun && (options.formal === false || NOT_EZAFE_NEXT.has(next) || !isKnown(next))) return null;
                    return {
                        message: `کسرهٔ اضافه با «ه» نوشته نمی‌شود؛ باید «${stem} ${next}» (یا «${stem}ِ ${next}») نوشته شود`,
                        replacement: stem,
                        fix: pronoun ? undefined : false
                    };
                }
            },
            {
                // «خانه من» → «خانۀ من»: before a personal pronoun the word is an ezafe.
                // When a verb follows the pronoun the sentence may split there
                // («در خانه من نبودم»), so that case is only suggested.
                pattern: new RegExp(`${START}(${LETTER}{2,}ه) (${EZAFE_PRONOUNS.join("|")})${END}(?: +(${LETTER}+))?`, "g"),
                check: (m) => {
                    const word = m[1];
                    if (isPronouncedHe(word) || !endsWithSilentHe(word) || !isKnown(word) || NOT_EZAFE.has(word)) return null;
                    // adjectives and participles rarely take a pronoun as ezafe: «خسته من»، «رفته او»
                    if ((ADJECTIVES.has(word) && !COMMON_NOUNS.has(word)) || verbForm(word.slice(0, -1))) return null;
                    const next = m[3];
                    const verbNext = next !== undefined && next !== "است" && (verbForm(next) !== null || /^(ن?می|ب|ن)/.test(next) && verbForm(next.replace(/^(ن?می|ب|ن)/, "")) !== null);
                    const fixed = word.slice(0, -1) + target;
                    return {
                        message: `نشانهٔ اضافه پس از «ه»ی غیرملفوظ «${target}» است: «${fixed} ${m[2]}»`,
                        replacement: fixed,
                        end: word.length,
                        fix: verbNext ? false : undefined
                    };
                }
            },
            {
                // the model: «خانه قبلی» → «خانۀ قبلی». Pronouns are handled above.
                pattern: new RegExp(`${START}(${LETTER}{2,}ه)(?= +(${LETTER}+))`, "g"),
                check: (m) => {
                    if (options.model === false || EZAFE_PRONOUNS.includes(m[2])) return null;
                    const c = candidateAt(m.input, m.index);
                    if (!c || c.p < MODEL_SUGGEST) return null;
                    // a typo («طایقه») is the spelling rule's: no ezafe advice on it
                    if (!isKnown(m[1]) && spellingReady() && !accepted(m[1])) return null;
                    // a compound written with a space: suggest the compound, not an ezafe
                    const compound = spacedCompound(m[1], m[2]);
                    if (compound) {
                        return {
                            message: `اگر «${m[1]} ${m[2]}» یک ترکیب است، با نیم‌فاصله نوشته می‌شود: «${compound}»`,
                            replacement: compound,
                            end: m[1].length + 1 + m[2].length,
                            fix: false,
                            source: "دستور خط، ترکیب‌ها، ب-۱۱، ص ۶۶"
                        };
                    }
                    const fixed = m[1].slice(0, -1) + target;
                    const sure = c.p >= MODEL_FIX && isKnown(m[1]);
                    return {
                        message: `اگر «${m[1]}» در حالت اضافه است (احتمال ${toPersianDigits(Math.round(c.p * 100))}٪)، «${fixed}» نوشته می‌شود`,
                        replacement: fixed,
                        fix: sure ? undefined : false
                    };
                }
            },
            {
                // the ezafe typed as a separate hamza: «بهانهء»، «بهانه ء»، «خانه‌ٔ»
                pattern: new RegExp(`${START}(${LETTER}*ه)(?:[ ${ZWNJ}]?ء|${ZWNJ}\u0654)(?!${LETTER})`, "g"),
                check: (m) => {
                    if (isPronouncedHe(m[1])) return null;
                    return { message: `نشانهٔ اضافه پس از «ه»ی غیرملفوظ «${target}» است`, replacement: m[1].slice(0, -1) + target };
                }
            },
            {
                pattern: options.style === "he-hamza" ? /ۀ/g : /هٔ/g,
                check: () => ({ message: `شکل یکدستِ نشانهٔ اضافه «${target}» است`, replacement: target })
            }
        ]
    };
});
