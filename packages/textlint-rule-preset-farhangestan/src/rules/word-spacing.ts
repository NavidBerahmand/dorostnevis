/*
 * فاصله‌گذاری پیشوندها، پیشوندواره‌ها و چند کلمۀ پرکاربرد
 *
 * دستور خط، «املای بعضی از واژه‌ها و پیشوندها و پسوندها» (ص ۳۴–۴۰):
 *
 * ۱. پیشوندهایی که فاصلۀ کامل گرفته‌اند (ص ۳۶–۳۷):
 *    - پیوندناپذیرها بی‌فاصله: «باز آفرینی» ← «بازآفرینی»، «نا خودآگاه» ← «ناخودآگاه»
 *    - پیوندپذیرها با نیم‌فاصله: «زیست فناوری» ← «زیست‌فناوری»، «پیش بینی» ← «پیش‌بینی»،
 *      «نیمه تعطیل» ← «نیمه‌تعطیل»
 *    فقط وقتی شکل پیوسته در فرهنگ املایی یا فهرست کتاب هست. «با، در، زیر،
 *    چند» کنار گذاشته شده‌اند، چون حرف اضافه و کلمۀ مستقل هم هستند
 *    («با دقت»، «زیر زمین»). «هم» فقط پیشنهاد می‌شود («او هم کار دارد»).
 * ۲. «این، آن» با فاصلۀ کامل از کلمۀ بعد (ص ۳۴): «آنروز» ← «آن روز».
 * ۳. «به» در نقش حرف اضافه با فاصلۀ کامل (ص ۳۸): «بهبرادرم» ← «به برادرم»؛
 *    در قیدها و حروف اضافۀ مرکّب با نیم‌فاصله: «بهسختی» ← «به‌سختی».
 *    ۲ و ۳ فقط وقتی کلمۀ پیوسته ناشناخته است و جزء دوم اسمی پرکاربرد است،
 *    تا نام‌هایی مثل «بهراد» و «آندرس» دست نخورند.
 * ۴. «چه» با فاصلۀ کامل از کلمۀ بعد، جز «چرا، چطور، چقدر، چگونه» (ص ۳۴):
 *    «چه‌کسی» ← «چه کسی».
 * ۵. «ابو» با کلمۀ بعد بی‌فاصله (ص ۳۵): «ابو القاسم» ← «ابوالقاسم».
 * ۶. «همی» پیشوند فعل با نیم‌فاصله (ص ۳۹): «همی گوید» ← «همی‌گوید»؛ فقط
 *    پیشنهاد، چون «همی»ِ تأکید با فاصله نوشته می‌شود.
 */
import { createPatternRule, PatternResult } from "../util/pattern-rule";
import { START, END, LETTER, ZWNJ, isNonJoining } from "../util/persian";
import { isKnown, isDictionaryWord, BOOK_JOINED } from "../util/words";
import { verbForm } from "./mi-prefix";
import { missingMadd } from "../util/madd";
import { corpusBucket } from "../util/speller";
import { registerSegments, spokenAt } from "../util/colloquial";
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
    "کس", "کسی", "مطلب", "حرف", "حرف‌ها", "راه", "دنیا", "جهان", "عمل", "امر", "نظر", "مسیر", "صورت", "شکل"
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

/** Words after which «این همه» is «this» + «all» («این همه در…»، «این همه را»), not «so much»: «این همه» first. */
const AFTER_THIS_ALL = new Set(["در", "به", "از", "را", "با", "برای", "او", "وی", "پس", "هنوز", "باید", "نباید", "یا", "تا", "که", "و", "هم", "نیز", "بر", "این", "آن", "است", "بود", "هست", "نیست", "رو", "مال", "مال", "اینا", "اونا"]);

/**
 * «اینهمه»، «آنهمه» (1.5.2): written joined they are wrong either way, but which way is a reading.
 * «این‌همه» (so much, the farhang's form and the book's «و نظایر آن»: «بااین‌همه»، ص ۳۴) before a
 * noun or after «با»; «این همه» («this» + «all») before a preposition, a pronoun or a verb. One
 * yellow card with both replacements, the likelier first (Persian Wikipedia: «این همه سال/چیز/
 * تلاش» but «این همه در/به/از/را»).
 */
function thisMuch(d: string, prev: string, next: string): PatternResult {
    const zw = d + ZWNJ + "همه";
    const sp = d + " همه";
    const spacedFirst = prev !== "با" && (next === "" || AFTER_THIS_ALL.has(next) || verbForm(next) !== null || /^ن?می/.test(next));
    const [first, second] = spacedFirst ? [sp, zw] : [zw, sp];
    return {
        message: `اگر «${zw}» (این‌قدر) است با نیم‌فاصله، و اگر «${d}» + «همه» است با فاصله: «${first}» یا «${second}»`,
        replacement: first,
        alternatives: [second],
        fix: false,
        source: S_DEMONSTRATIVE
    };
}

function joinedWord(word: string, prev = "", next = ""): PatternResult | null {
    if (isKnown(word) || BOOK_JOINED.has(word) || missingMadd(word)) return null; // «اینده» is «آینده» (1.6.0)
    for (const d of ["این", "آن"]) {
        if (!word.startsWith(d)) continue;
        const rest = word.slice(d.length);
        if (rest === "ست" || rest === "رو") return null; // «اینست»، «ازاینرو»: in the word lists
        if (rest === "همه") return thisMuch(d, prev, next);
        // a compound the farhang writes with a half-space («این‌قدر»، «آن‌چنان»، «این‌چنین»): the farhang's
        // rule reports it; «این» + space here would contradict it (1.5.2)
        if (isDictionaryWord(d + ZWNJ + rest)) return null;
        if (CONJUNCTION_PARTS.has(rest)) {
            const fixed = d + ZWNJ + rest;
            return { message: `در حروف ربط مرکّب، «${d}» با نیم‌فاصله نوشته می‌شود: «${fixed}»`, replacement: fixed, source: S_DEMONSTRATIVE };
        }
        if (rest.length >= 2 && commonNoun(rest)) {
            const fixed = d + " " + rest;
            // a joined name is possible («آندریا»): fix only the most common nouns
            const sure = AFTER_DEMONSTRATIVE.has(rest);
            return {
                message: `«${d}» با فاصلۀ کامل از کلمۀ بعد نوشته می‌شود: «${fixed}»`,
                replacement: fixed,
                fix: sure ? undefined : false,
                source: S_DEMONSTRATIVE
            };
        }
    }
    // «بهتون، بهشون، بهمون»: «به» + a spoken pronoun, never marked (1.5.2; «تون» is also a noun)
    if (word.startsWith("به") && !/^به(شون|تون|مون|شان|تان|مان)$/.test(word)) {
        const rest = word.slice(2);
        if (rest.length >= 2 && (commonNoun(rest) || BE_ZWNJ.has(rest))) {
            const fixed = afterBe(rest);
            const how = fixed.includes(ZWNJ) ? "در قید و حرف اضافۀ مرکّب با نیم‌فاصله" : "در نقش حرف اضافه با فاصلۀ کامل";
            return { message: `«به» ${how} نوشته می‌شود: «${fixed}»`, replacement: fixed, source: S_BE };
        }
    }
    return null;
}

const S_TYPING = "قراردادهای رایج حروف‌نگاری فارسی (در دستور خط نیامده)";
/**
 * «و» run into the next word (1.6.0, beyond the function words above): «ومن»، «وبعد»، «وحتی»، «وفقط».
 * Only when the whole token is no word (Hazm, the farhang, or seen in Wikipedia) and what follows
 * «و» is a common one; never these words and parts of compounds: «وبا» (cholera)، «وهم»، «واسم»
 * (spoken «برای من»)، «واست»، «ورا»، «واو»، «حمل‌ونقل»، «آب‌وهوا».
 */
const WAW_NOT = new Set(["وبا", "وهم", "واسم", "واست", "واسه", "واسش", "واسمون", "واستون", "واسشون", "ورا", "واو", "وبم", "وجو", "ونیم", "وتی", "ودم", "وزد", "ونقل", "وکار", "وهوا", "وهوای", "وراه", "وتن", "وپرورش", "وغیره", "وپیشینه", "وآل", "وسیما", "ومی", "ونه", "وشو", "وقتی", "وزیر", "ولی", "والا", "ورزش", "وسط", "وقت", "وام", "ویژه", "وار", "واری", "وارد", "واقع", "والد", "وصل", "وجه", "وکیل", "وطن", "وزن", "ورق", "وفا", "وفات", "وعده", "وحشی", "واحد", "وادار", "وانمود", "ورود"]);
/** Pronouns, adverbs and conjunctions «هم» (also) is run into: «ماهم»، «شماهم»، «اگرهم» (1.6.0). */
const HAM_HEADS = new Set(["ما", "شما", "او", "اون", "اونا", "آنها", "آن‌ها", "اینها", "این‌ها", "ایشان", "اگر", "اگه", "هنوز", "بعد", "شاید", "حالا", "امروز", "الان", "باز", "دیگر", "دیگه", "آنجا", "اینجا", "اونجا", "قبلا", "بعدا", "خودم", "خودش", "خودت", "خودمان", "خودشون", "تازه", "یکبار", "بار", "حتما", "اکنون", "امسال", "دیروز", "فردا", "آخر"]);
/** A simple preposition run into a pronoun, a demonstrative, a number or a common noun (1.6.0): «دریک»، «ازمن»، «باتوجه». */
const PREP_JOINED: Record<string, string> = Object.fromEntries(
    ["در", "از", "با", "بر"].flatMap((p) =>
        ["این", "آن", "همین", "همان", "هر", "یک", "همه", "من", "تو", "او", "ما", "شما", "آنها", "اینها", "خود", "خودم", "خودت", "خودش", "سال", "خانه", "ایران", "جهان", "سایت", "حال"].map((w) => [p + w, p + " " + w])
    ).concat([["باتوجه", "با توجه"], ["بعدهم", "بعد هم"]])
);
/**
 * The book joins a simple preposition and a noun stem into a compound preposition («ازطریقِ،
 * ازنظرِ، براساسِ، درضمنِ، بعداز»، ص ۶۹): those stay. «با توجه به» has three parts: spaced
 * (تبصرۀ ۲). Not before a half-space («ازاین‌رو»، «دراین‌باره»: the compound lists).
 */
const PREP_KEEP = new Set(["درحال", "ازخود", "باخود", "برخود", "درهم", "ازهم", "باهم", "برهم", "درهمه", "درتو"]);
/** A number run into what it counts (1.6.0): «یکماه»، «دوسال»، «چندروز». Not «یکسان»، «یکدیگر»، «۵ساله»، «دوستون». */
const COUNTED = ["سال", "ماه", "روز", "هفته", "ساعت", "دقیقه", "ثانیه", "نفر", "شب", "عدد", "نوع", "قسمت", "مرحله", "دسته", "گروه", "کشور", "تیم", "مورد", "دفعه", "سالی", "ماهی", "روزی", "ساعتی", "هفته‌ای", "نفری", "شبی"];
const NUM_JOINED = new RegExp(`${START}(یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|چند)(${COUNTED.join("|")})${END}`, "g");

export default createPatternRule(() => ({
    source: S_PREFIX,
    checks: [
        {
            // «ومن»، «وبعد»، «وحتی» → «و من»… (1.6.0)
            pattern: new RegExp(`${START}و(${LETTER}{2,})${END}`, "g"),
            check: (m) => {
                const w = m[0];
                const rest = m[1];
                if (/^(در|از|به|یا|این|آن|که|تا|برای|اگر|اما|سپس|همچنین|دیگر|هر|همه)$/.test(rest)) return null; // the check below
                if (WAW_NOT.has(w) || isKnown(w) || isDictionaryWord(w) || BOOK_JOINED.has(w)) return null;
                const bw = corpusBucket(w);
                const br = corpusBucket(rest);
                if (bw === null || br === null || bw >= 5 || br < 11) return null; // the token is seen in Wikipedia, or the rest is not common
                // «ودی»، «ونو»: names more often than «و دی»; two letters only for pronouns («ومن»)
                if (!isKnown(rest) || (rest.length < 3 && !/^(من|ما|تو|او|یه|چه|چی)$/.test(rest))) return null;
                return { message: `«و» کلمۀ جداست: «و ${rest}»`, replacement: `و ${rest}`, source: S_TYPING };
            }
        },
        {
            // «بودکه»، «استکه»، «منکه» → «بود که»… (1.6.0): «که» after a verb or a pronoun; the compound
            // conjunctions («زمانیکه»، «درحالیکه») are the lexicon's; «بلکه، آنکه، اینکه» are words
            pattern: new RegExp(`${START}(${LETTER}{2,})که${END}`, "g"),
            check: (m) => {
                const head = m[1];
                if (isKnown(m[0]) || isDictionaryWord(m[0]) || BOOK_JOINED.has(m[0])) return null;
                if (!(/^(من|تو|ما|شما|او|اون|را|است|نیست|هست|بود|نبود|شد|نشد)$/.test(head) || (verbForm(head) && /[دت]$/.test(head) && head.length >= 3))) return null;
                if ((corpusBucket(m[0]) ?? 0) >= 5) return null;
                return { message: `«که» کلمۀ جداست: «${head} که»`, replacement: `${head} که`, source: S_TYPING };
            }
        },
        {
            // «ماهم»، «شماهم»، «اگرهم» → «ما هم»… (1.6.0)
            pattern: new RegExp(`${START}(${[...HAM_HEADS].sort((a, b) => b.length - a.length).join("|")})هم${END}`, "g"),
            check: (m) => {
                const head = m[1];
                if (!HAM_HEADS.has(head) || isKnown(m[0]) || isDictionaryWord(m[0]) || BOOK_JOINED.has(m[0])) return null;
                // «اوهم» is also «Ohm» (Georg Ohm): only in a spoken sentence
                if (m[0] === "اوهم" && !spokenAt(registerSegments(m.input), m.index)) return null;
                return { message: `«هم» (به معنای «نیز») جدا نوشته می‌شود: «${head} هم»`, replacement: `${head} هم`, source: S_TYPING };
            }
        },
        {
            // «دریک»، «ازمن»، «باتوجه» → «در یک»… (1.6.0): yellow, the joined form may be a name or a compound
            pattern: new RegExp(`${START}(${Object.keys(PREP_JOINED).join("|")})${END}(?!${ZWNJ})`, "g"),
            check: (m) => {
                const w = m[0];
                if (PREP_KEEP.has(w) || isDictionaryWord(w) || BOOK_JOINED.has(w)) return null;
                const fixed = PREP_JOINED[w];
                const next = m.input.slice(m.index + w.length).match(/^ +([\p{L}‌]+)/u)?.[1] ?? "";
                // «براین اساس»، «ازاین رو»، «بااین حال»: the book's compounds (spaced-compounds' «براین‌اساس»)
                if (/^(اساس|رو|حال|پس|باره|جهت|حیث|قرار|وجود|همه|گذشته|سان|میان|طریق|نظر)$/.test(next)) return null;
                if (w === "باتوجه" && next && next !== "به") return null;
                return { message: `حرف اضافۀ ساده با فاصله از کلمۀ بعد نوشته می‌شود: «${fixed}»`, replacement: fixed, fix: false, source: "دستور خط، «حروف اضافۀ ساده و مرکّب»، ص ۶۹" };
            }
        },
        {
            // «یکماه»، «دوسال»، «چندروز» → «یک ماه»… (1.6.0): yellow
            pattern: NUM_JOINED,
            check: (m) => {
                if (isKnown(m[0]) || isDictionaryWord(m[0]) || BOOK_JOINED.has(m[0]) || m[0] === "یکدفعه") return null; // «یکدفعه» (suddenly)
                const fixed = m[1] + " " + m[2];
                return { message: `عدد و معدود جدا نوشته می‌شوند: «${fixed}»`, replacement: fixed, fix: false, source: "دستور خط، «قواعد عددنویسی»، ص ۶۵" };
            }
        },
        {
            // «و» glued to the next function word: «ودر» → «و در»، «واز» → «و از»
            // (left out because the joined form is a word: «وبا» (cholera)، «وهم»، «ونیز» (Venice)، «وبر»)
            pattern: new RegExp(`${START}و(در|از|به|یا|این|آن|که|تا|برای|اگر|اما|سپس|همچنین|دیگر|هر|همه)${END}`, "g"),
            check: (m) => {
                if (isKnown(m[0]) || isDictionaryWord(m[0])) return null;
                return {
                    message: `«و» کلمۀ جداست: «و ${m[1]}»`,
                    replacement: `و ${m[1]}`,
                    source: "قراردادهای رایج حروف‌نگاری فارسی (در دستور خط نیامده)"
                };
            }
        },
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
            check: (m) => {
                const prev = m.input.slice(0, m.index).match(/(\p{L}+)[ \u200c]*$/u)?.[1] ?? "";
                const next = m.input.slice(m.index + m[0].length).match(/^ +(\p{L}[\p{L}\u200c]*)/u)?.[1] ?? "";
                return joinedWord(m[0], prev, next);
            }
        },
        {
            // «چه‌کسی»
            pattern: new RegExp(`${START}چه${ZWNJ}(${LETTER}+)${END}`, "g"),
            check: (m) => {
                if (isKnown("چه" + ZWNJ + m[1])) return null;
                return { message: "«چه» با فاصلۀ کامل از کلمۀ بعد نوشته می‌شود", replacement: "چه " + m[1], source: S_CHE };
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
                    message: `«همی» پیشوند فعل با نیم‌فاصله نوشته می‌شود: «همی‌${m[1]}» (اگر نشانۀ تأکید است، با فاصله درست است)`,
                    replacement: "همی" + ZWNJ + m[1],
                    fix: false,
                    source: S_HAMI
                };
            }
        }
    ]
}));
