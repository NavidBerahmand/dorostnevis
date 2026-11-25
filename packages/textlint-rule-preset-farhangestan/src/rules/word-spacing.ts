/*
 * فاصله‌گذاری پیشوندها، پیشوندواره‌ها و چند کلمهٔ پرکاربرد
 *
 * دستور خط، «املای بعضی از واژه‌ها و پیشوندها و پسوندها» (ص ۳۴–۴۰):
 *
 * ۱. پیشوندهایی که فاصلهٔ کامل گرفته‌اند (ص ۳۶–۳۷):
 *    - پیوندناپذیرها بی‌فاصله: «باز آفرینی» ← «بازآفرینی»، «نا خودآگاه» ← «ناخودآگاه»
 *    - پیوندپذیرها با نیم‌فاصله: «زیست فناوری» ← «زیست‌فناوری»، «پیش بینی» ← «پیش‌بینی»،
 *      «نیمه تعطیل» ← «نیمه‌تعطیل»
 *    فقط وقتی شکل پیوسته در فرهنگ املایی یا فهرست کتاب هست. «با، در، زیر،
 *    چند» کنار گذاشته شده‌اند، چون حرف اضافه و کلمهٔ مستقل هم هستند
 *    («با دقت»، «زیر زمین»). «هم» فقط پیشنهاد می‌شود («او هم کار دارد»).
 * ۲. «این، آن» با فاصلهٔ کامل از کلمهٔ بعد (ص ۳۴): «آنروز» ← «آن روز».
 * ۳. «به» در نقش حرف اضافه با فاصلهٔ کامل (ص ۳۸): «بهبرادرم» ← «به برادرم»؛
 *    در قیدها و حروف اضافهٔ مرکّب با نیم‌فاصله: «بهسختی» ← «به‌سختی».
 *    ۲ و ۳ فقط وقتی کلمهٔ پیوسته ناشناخته است و جزء دوم اسمی پرکاربرد است،
 *    تا نام‌هایی مثل «بهراد» و «آندرس» دست نخورند.
 * ۴. «چه» با فاصلهٔ کامل از کلمهٔ بعد، جز «چرا، چطور، چقدر، چگونه» (ص ۳۴):
 *    «چه‌کسی» ← «چه کسی».
 * ۵. «ابو» با کلمهٔ بعد بی‌فاصله (ص ۳۵): «ابو القاسم» ← «ابوالقاسم».
 * ۶. «همی» پیشوند فعل با نیم‌فاصله (ص ۳۹): «همی گوید» ← «همی‌گوید»؛ فقط
 *    پیشنهاد، چون «همی»ِ تأکید با فاصله نوشته می‌شود.
 */
import { createPatternRule, PatternResult } from "../util/pattern-rule";
import { START, END, LETTER, ZWNJ, isNonJoining } from "../util/persian";
import { isKnown, isDictionaryWord, BOOK_JOINED } from "../util/words";
import { verbForm } from "./mi-prefix";
import commonNouns from "../dict/hazm-common-nouns.json";

const COMMON_NOUNS = new Set<string>(commonNouns.words);

const S_PREFIX = "دستور خط، «پیشوندها و پیشوندواره‌ها»، ص ۳۶–۳۷";
const S_DEMONSTRATIVE = "دستور خط، «این، آن»، ص ۳۴";
const S_BE = "دستور خط، «به»، ص ۳۸";
const S_CHE = "دستور خط، «چه»، ص ۳۴";
const S_ABU = "دستور خط، «ابو»، ص ۳۵";
const S_HAMI = "دستور خط، «می و همی»، ص ۳۹";

/** Prefixes the book lists, minus those that are also common free words. */
const PREFIXES = [
    // non-joining: written without a space
    "ابر", "باز", "بر", "فرا", "فرو", "نا", "وا", "ور", "پسا", "پیرا", "پیشا", "پاد", "پرا", "ترا", "دگر", "رایا", "بینا",
    // joining: written with ZWNJ
    "برون", "بوم", "تک", "درون", "زیست", "میان", "پیش", "پاره", "نصفه", "نیمه"
    // «پس» and «نیم» are left out: «پس کار کنید» (so, work), «یک و نیم صفحه»
];
/** Prefix-like words followed by a verb are usually a separate adverb: «کار پیش رفت». */
const ADVERB_LIKE = new Set(["پیش", "باز", "بر", "میان"]);
/** Never the second part of a prefixed word: «باز هم» (again), «پیش از». */
const FUNCTION_WORDS = new Set(["هم", "از", "به", "با", "در", "را", "که", "و", "تا", "نیز", "یا", "این", "آن", "چه", "هر", "بر", "رو", "روی", "سر", "او", "ما", "من", "تو"]);
/** «آن/این» + these are compound conjunctions with ZWNJ: «آن‌طور»، «این‌قدر» (ص ۳۴، تبصرۀ ۱). */
const CONJUNCTION_PARTS = new Set(["طور", "گونه", "قدر", "سان", "چنان"]);
/** Nouns that so often follow «این/آن» that a joined form is a typo, not a name. */
const AFTER_DEMONSTRATIVE = new Set([
    "روز", "روزها", "شب", "سال", "سال‌ها", "ماه", "هفته", "وقت", "زمان", "بار", "دفعه", "کار", "کارها", "حال", "چیز", "چیزها",
    "طرف", "سو", "سوی", "موقع", "لحظه", "دوره", "دوران", "مرد", "زن", "کتاب", "خانه", "شهر", "کشور", "مسئله", "موضوع",
    "مورد", "موارد", "نوع", "گروه", "قسمت", "بخش", "مقدار", "اندازه", "همه", "دو", "سه", "یکی", "دیگری", "شخص", "فرد",
    "کس", "کسی", "مطلب", "حرف", "حرف‌ها", "راه", "دنیا", "جهان", "عمل", "امر", "نظر", "مسیر", "صورت", "شکل", "رو", "ور"
]);

/** Nouns that take ZWNJ after «به» (adverbs and compound prepositions, ص ۳۸ ب). */
const BE_ZWNJ = new Set([
    "محض", "موجب", "جهت", "خاطر", "وسیله", "عنوان", "سبب", "طور", "منظور", "دلیل", "علت", "علّت", "رغم",
    "همراه", "ویژه", "خصوص", "شرط", "سوی", "طرف", "دنبال", "واسطه", "لحاظ", "نفع", "ضرر", "جز", "غیر",
    "جای", "تدریج", "سرعت", "شدت", "شدّت", "موقع", "ندرت", "هرحال", "زور", "تنهایی",
    // adverbs (ص ۳۸ ب: «به‌سختی»)
    "سختی", "سادگی", "آسانی", "راحتی", "خوبی", "درستی", "زودی", "تازگی", "کلی", "کلّی", "آرامی", "دقت", "دقّت",
    "روشنی", "وضوح", "سادگی", "آهستگی", "نرمی", "تندی", "گرمی", "خوشی", "زیبایی", "کندی", "فوریت", "فوریّت",
    "اختصار", "تفصیل", "ویژه", "عمد", "اجبار", "اشتباه", "صراحت", "مراتب", "نوبت", "ترتیب", "یقین", "طورکلی"
]);

const POSSESSIVE = ["مان", "تان", "شان", "م", "ت", "ش"];

function join(a: string, b: string): string {
    return isNonJoining(a[a.length - 1]) ? a + b : a + ZWNJ + b;
}

/** A frequent noun, possibly with a possessive ending: «روز»، «برادرم». */
function commonNoun(word: string): boolean {
    if (COMMON_NOUNS.has(word)) return true;
    return POSSESSIVE.some((p) => word.endsWith(p) && COMMON_NOUNS.has(word.slice(0, -p.length)));
}

/** «به» + noun: a ZWNJ for adverbs and compound prepositions, else a space. */
function afterBe(rest: string): string {
    if (BE_ZWNJ.has(rest)) return "به" + ZWNJ + rest;
    // adverbs in -ی from a known base: «سختی» ← «سخت»، «سادگی» ← «ساده»
    if (rest.endsWith("ی") && rest.length >= 4) {
        const base = rest.endsWith("گی") ? rest.slice(0, -2) + "ه" : rest.slice(0, -1);
        if (isKnown(base) && !commonNoun(rest)) return "به" + ZWNJ + rest;
    }
    return "به " + rest;
}

function spacedPrefix(prefix: string, rest: string): PatternResult | null {
    // «کار پیش رفت»; but a noun in -ی from a present stem is fine: «پیش بینی»، «باز آفرینی»
    if (FUNCTION_WORDS.has(rest)) return null;
    if (ADVERB_LIKE.has(prefix) && verbForm(rest) && !rest.endsWith("ی")) return null;
    // a past participle: «وضعیتی پیش آمده بود»
    if (ADVERB_LIKE.has(prefix) && rest.endsWith("ه") && verbForm(rest.slice(0, -1))) return null;
    const candidates = isNonJoining(prefix[prefix.length - 1]) ? [prefix + rest] : [prefix + ZWNJ + rest, prefix + rest];
    const fixed = candidates.find((c) => isDictionaryWord(c));
    if (!fixed) return null;
    const how = fixed.includes(ZWNJ) ? "با نیم‌فاصله" : "بی‌فاصله";
    return { message: `«${prefix}» ${how} به جزء بعد می‌چسبد: «${fixed}»`, replacement: fixed, source: S_PREFIX };
}

function joinedWord(word: string): PatternResult | null {
    if (isKnown(word) || BOOK_JOINED.has(word)) return null;
    for (const d of ["این", "آن"]) {
        if (!word.startsWith(d)) continue;
        const rest = word.slice(d.length);
        if (rest === "ست") return null; // «اینست»: the word lists write «این است»
        if (CONJUNCTION_PARTS.has(rest)) {
            const fixed = d + ZWNJ + rest;
            return { message: `در حروف ربط مرکّب، «${d}» با نیم‌فاصله نوشته می‌شود: «${fixed}»`, replacement: fixed, source: S_DEMONSTRATIVE };
        }
        if (rest.length >= 2 && commonNoun(rest)) {
            const fixed = d + " " + rest;
            // a joined name is possible («آندریا»): fix only the most common nouns
            const sure = AFTER_DEMONSTRATIVE.has(rest);
            return {
                message: `«${d}» با فاصلهٔ کامل از کلمهٔ بعد نوشته می‌شود: «${fixed}»`,
                replacement: fixed,
                fix: sure ? undefined : false,
                source: S_DEMONSTRATIVE
            };
        }
    }
    if (word.startsWith("به")) {
        const rest = word.slice(2);
        if (rest.length >= 2 && (commonNoun(rest) || BE_ZWNJ.has(rest))) {
            const fixed = afterBe(rest);
            const how = fixed.includes(ZWNJ) ? "در قید و حرف اضافهٔ مرکّب با نیم‌فاصله" : "در نقش حرف اضافه با فاصلهٔ کامل";
            return { message: `«به» ${how} نوشته می‌شود: «${fixed}»`, replacement: fixed, source: S_BE };
        }
    }
    return null;
}

export default createPatternRule(() => ({
    source: S_PREFIX,
    checks: [
        {
            // «باز آفرینی»، «زیست فناوری»
            pattern: new RegExp(`${START}(${PREFIXES.join("|")}) +(${LETTER}{2,})${END}`, "g"),
            check: (m) => spacedPrefix(m[1], m[2])
        },
        {
            // «هم وطن»: a suggestion only, «هم» is also the adverb «also»
            pattern: new RegExp(`${START}هم +(${LETTER}{2,})${END}`, "g"),
            check: (m) => {
                const fixed = "هم" + ZWNJ + m[1];
                if (!isDictionaryWord(fixed) || verbForm(m[1])) return null;
                return {
                    message: `اگر «هم» پیشوند است، با نیم‌فاصله نوشته می‌شود: «${fixed}»`,
                    replacement: fixed,
                    fix: false,
                    source: "دستور خط، «هم»، ص ۴۰"
                };
            }
        },
        {
            // «آنروز»، «بهبرادرم»
            pattern: new RegExp(`${START}(?:این|آن|به)${LETTER}{2,}(?=${ZWNJ}|${END})`, "g"),
            check: (m) => joinedWord(m[0])
        },
        {
            // «چه‌کسی»
            pattern: new RegExp(`${START}چه${ZWNJ}(${LETTER}+)${END}`, "g"),
            check: (m) => {
                if (isKnown("چه" + ZWNJ + m[1])) return null;
                return { message: "«چه» با فاصلهٔ کامل از کلمهٔ بعد نوشته می‌شود", replacement: "چه " + m[1], source: S_CHE };
            }
        },
        {
            // «ابو القاسم»
            pattern: new RegExp(`${START}ابو[ ${ZWNJ}]+(${LETTER}{2,})${END}`, "g"),
            check: (m) => ({ message: "«ابو» بی‌فاصله به نام بعد می‌چسبد", replacement: "ابو" + m[1], source: S_ABU })
        },
        {
            // «همی گوید»
            pattern: new RegExp(`${START}همی +(${LETTER}{2,})${END}`, "g"),
            check: (m) => {
                if (!verbForm(m[1])) return null;
                return {
                    message: `«همی» پیشوند فعل با نیم‌فاصله نوشته می‌شود: «همی‌${m[1]}» (اگر نشانهٔ تأکید است، با فاصله درست است)`,
                    replacement: "همی" + ZWNJ + m[1],
                    fix: false,
                    source: S_HAMI
                };
            }
        }
    ]
}));
