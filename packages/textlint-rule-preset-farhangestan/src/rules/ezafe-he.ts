/*
 * کسرۀ اضافه پس از «ه»ی غیرملفوظ
 *
 * دستور خط، «کسرۀ اضافه» (ص ۴۷):
 *   برای کلمه‌های مختوم به «ها»ی غیرملفوظ، در حالت اضافه، از علامت «ۀ/ ‍ۀ»
 *   استفاده می‌شود: برنامۀ روزانه، بندۀ خدا، به‌مثابۀ، خانۀ او، رانندۀ ماهر
 *   … کلمه‌های مختوم به «ها»ی ملفوظ، در حالت اضافه، کسره می‌گیرند:
 *   بازدهِ تولید، گرهِ کور، فرماندهِ سپاه
 *
 * - «خانه ی من»، «خانه‌ی من»، «خانه‌یِ من» ← «خانۀ من»
 * - نشانۀ اضافه یک شکل دارد: «ۀ» (U+06C0، شکلی که کتاب چاپ کرده)، و «خانهٔ من» (ه + همزۀ بالا
 *   U+0654) ← «خانۀ من» (از نسخۀ ۱.۵.۰ به تصمیم کاربر: قلم صفحه U+0654 را مثل «ء» می‌کشد؛
 *   کتاب هر دو را یکی می‌داند). گزینۀ { "style": "he-hamza" } برعکس عمل می‌کند.
 *
 * «ه»ی ملفوظ (راه، کوه، فقیه، گره…) کنار گذاشته می‌شود: کلمه‌ای که پیش از
 * «ه» مصوّت بلند (ا، و، ی) دارد یا در فهرست زیر است.
 *
 * کسرۀ اضافه‌ای که «ه» نوشته شده: «کتابه من» ← «کتاب من». کسرۀ اضافه پس
 * از حرف بی‌صدا نوشته نمی‌شود (یا با ـِ نشان داده می‌شود). فقط وقتی که
 * «کتابه» خودش کلمۀ شناخته‌شده‌ای نیست و «کتاب» هست:
 * فقط پیشنهاد، فقط برای اسم رایج و پیش از ضمیر (من، تو، او…): روی ویکی‌پدیا تقریباً
 * همۀ موردهای دیگر واژۀ درست یا نام بودند («پیشرانه»، «نزده ولی»).
 * شکل‌های گفتاری مثل «خونه» (خانه) و «نشونه» (نشانه) کنار گذاشته می‌شوند.
 *
 * کسرۀ اضافۀ جاافتاده («خانه قبلی» ← «خانۀ قبلی»): اینکه کلمه در حالت اضافه
 * است یا نه را قاعده نمی‌تواند بگوید؛ یک مدل آماری کوچک (src/util/ezafe-model.ts)
 * از روی کلمه‌های اطراف حدس می‌زند. اگر مدل دست‌کم ۹۰٪ مطمئن باشد و کلمه
 * شناخته‌شده باشد اصلاح خودکار (در صفحه همیشه زرد)، و از ۸۰٪ به بالا فقط پیشنهاد؛ در سطر
 * محاوره‌ای فقط برای چند کلمه (از ۱.۶.۳). با گزینۀ { "model": false } خاموش می‌شود.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, LETTER_RANGE, ZWNJ, toPersianDigits } from "../util/persian";
import { isKnown, isDictionaryWord, endsWithSilentHe, hasPronouncedHe } from "../util/words";
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
import { verbForm, isParticiple, isPresentStem } from "./mi-prefix";
import { missingMadd } from "../util/madd";
import { isSpokenStem, spoken as spokenForm, registerSegments } from "../util/colloquial";
import hazmAdjectives from "../dict/hazm-adjectives.json";
import commonNouns from "../dict/hazm-common-nouns.json";
import { ezafeCandidates, EzafeCandidate, isFiniteVerb } from "../util/ezafe-model";
import { inBank } from "../util/colloquial-bank";
import { accepted, spellingReady } from "../util/speller";

/**
 * Thresholds on the calibrated probability (scripts/ezafe-model/train.py, calibrate.py). Since 1.6.3 the bar
 * is set by hand-judged cards (see README): a card only where at least 9 in 10 are right.
 */
const MODEL_FIX = 0.9;
/**
 * 1.6.3, measured on cards judged by hand (Wikipedia, written sentences): 90% right from 0.6 to 0.7, 78% from
 * 0.7 to 0.8, 95% from 0.8 to 0.9 and above 0.9. Below 0.8 the cards fall under the bar (1.6.2: 0.6).
 */
const MODEL_SUGGEST = 0.8;
/**
 * In a spoken sentence, or a line that has one (blogs, forums), no threshold reached the bar: 73% right from 0.8
 * to 0.9, 85% from 0.9 to 0.95, 83% above (180 judged cards); a written sentence in such a line 84% from 0.8.
 * There only the words that were right every time are suggested (60 of 60 judged): «همه»، «درباره»، «ادامه»،
 * «زمینه»، «نسخه» («همۀ کارها»، «دربارۀ این فیلم»، «ادامۀ مطلب»، «زمینۀ کاری»، «نسخۀ جدید»).
 */
const MODEL_SUGGEST_SPOKEN = 0.8;
/** Before a pronoun the model's probability is low even where the ezafe is right; below this, none was. */
const PRONOUN_MIN_P = 0.3;
/** A compound written with a space («جامعه شناسان»): suggested as in 1.6.2. */
const COMPOUND_SUGGEST = 0.6;
const COMPOUND_SUGGEST_SPOKEN = 0.8;
const SPOKEN_HEADS = new Set(["همه", "درباره", "ادامه", "زمینه", "نسخه"]);
/** Does the line around `index` have a spoken sentence (informal text)? */
function informalLine(input: string, index: number): boolean {
    const a = input.lastIndexOf("\n", index - 1) + 1;
    const e = input.indexOf("\n", index);
    const b = e < 0 ? input.length : e;
    return registerSegments(input).some((x) => x.spoken && x.start < b && x.end > a);
}
/** A pronoun ending or a copula written as a word: «تونو»، «ش»، «اشون»، «هاتونو»، «ست»، «اس». */
const CLITIC_WORD = /^(?:(?:ها|های)?(?:م|ت|ش|مان|تان|شان|مون|تون|شون|ام|ات|اش|امون|اتون|اشون)(?:و|رو|ه|ست|اس)?|ها(?:و|رو)?|ست|اس)$/;
/** A light verb that is also a noun («داد» cry): still an ezafe's second part. */
const NOUN_TOO = new Set(["داد"]);

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
    /** "he-yeh" (default) → ۀ (U+06C0, the book's form); "he-hamza" → هٔ (ه + U+0654). */
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
    if (PRONOUNCED_HE.has(word) || hasPronouncedHe(word)) return true;
    const before = word[word.length - 2];
    // long vowel before ه → pronounced: راه، کوه، فقیه، شبیه، گناه
    return before === "ا" || before === "و" || before === "ی" || before === "آ";
}

const PRONOUNS = new Set([
    "من", "تو", "او", "ما", "شما", "آنها", "آن‌ها", "ایشان", "اون", "اونا", "اونها", "اون‌ها",
    "خودم", "خودت", "خودش", "خودمان", "خودتان", "خودشان", "خودمون", "خودتون", "خودشون"
]);

/*
 * A verb never takes the ezafe (1.5.2: «قبول میکنه مدارک رو» was offered «میکنۀ»). Verb forms in
 * «ه»: «می/نمی» + a stem + an ending (written «می‌کند» or spoken «میکنه، میره، میگه»); spoken
 * subjunctives and present forms («بره، بشه، باشه، بکنه، داره»); and participles («شده، کرده،
 * گرفته»). In a written sentence a participle that is also a noun or an adjective keeps its
 * ezafe («بستۀ نرم‌افزاری»، «نوشتۀ او»، «خستۀ راه»); in a spoken one every verb-like word is left alone.
 */
const SPOKEN_ENDS = ["ه", "ن", "م", "ی", "یم", "ین", "ید", "ند", "د"];
/** Spoken present forms without a prefix that are no common noun («داره» is not «اداره»). */
const SPOKEN_BARE = new Set(["داره", "نداره", "باشه", "نباشه", "بشه", "نشه", "بره", "نره", "کنه", "شه", "ره", "گه", "تونه"]);
/** A present stem, also as said after «می» («میندازه» = «می» + «انداز»، «میفته» = «می» + «افت»). */
const anyStem = (st: string) => isPresentStem(st) || isSpokenStem(st) || isPresentStem("ا" + st) || isPresentStem("آ" + st);
const stemWithEnd = (rest: string) =>
    SPOKEN_ENDS.some((e) => rest.length > e.length && rest.endsWith(e) && anyStem(rest.slice(0, -e.length))) || verbForm(rest) !== null;
/** After a participle in writing, words that start a new phrase: «تبدیل شده این همخوان»، «نخواسته خود را». */
const PHRASE_START = new Set(["این", "آن", "خود", "خودش", "خودشان", "او", "وی", "ما", "آنها", "آن‌ها", "ایشان", "همه", "هر", "هیچ", "یک"]);
const NOT_CONTENT = new Set(["که", "را", "نیز", "هم", "او", "وی", "من", "ما", "تو", "شما", "آنها", "آن‌ها", "ایشان", "این", "آن", "هرگز", "هنوز", "تنها", "اگر", "چون"]);
/**
 * `prev`/`next`: the words around it, if known. In writing a participle keeps its ezafe as an adjective
 * after the word it belongs to («شناخته‌شدۀ هرات»، «خشک‌شدۀ پسته»، «اشغال‌شدۀ این کشور» is the one
 * kind of miss), never as the verb of a clause («تبدیل شده این همخوان»، «او نخواسته خود را»).
 */
export function verbLike(word: string, spoken: boolean, prev?: string, next?: string): boolean {
    const mi = word.match(/^(?:بر|در|باز|ور|وا)?ن?می\u200c?(.{1,})$/);
    if (mi && stemWithEnd(mi[1])) return true;
    if (SPOKEN_BARE.has(word) && (spoken || !COMMON_NOUNS.has(word))) return true; // «برۀ کوچک» in writing
    // a participle: in speech only a noun keeps its ezafe («رشتۀ»، «بستۀ مدارک»), in writing an adjective too
    if (isParticiple(word)) {
        if (COMMON_NOUNS.has(word)) return false;
        if (spoken) return true;
        if (ADJECTIVES.has(word)) return false;
        if (prev === undefined) return true;
        return !prev || NOT_CONTENT.has(prev) || (next !== undefined && PHRASE_START.has(next));
    }
    if (spoken && !COMMON_NOUNS.has(word)) {
        // «بشه، بگه، نکنه، بذاره»: «ب/ن» + a stem + an ending (not a noun: «نمونه»)
        const sub = word.match(/^[بن](.{2,})$/);
        if (sub && stemWithEnd(sub[1])) return true;
    }
    return false;
}

/** Light verbs after a noun in speech: «استفاده کنه»، «ادامه بدین»، «علاقه دارم» (a compound verb, no ezafe). */
const LIGHT_VERBS = new Set(
    ["کن", "کنه", "کنم", "کنی", "کنیم", "کنین", "کنید", "کنن", "کنند", "کرد", "کردم", "کردی", "کردیم", "کردین", "کردید", "کردن", "کردند",
     "بده", "بدم", "بدی", "بدیم", "بدین", "بدید", "بدن", "داد", "دادم", "دادی", "دادن", "دادند", "داره", "دارم", "داری", "داریم", "دارین", "دارید", "دارن", "دارند",
     "داشت", "داشتم", "داشتی", "داشتن", "بشه", "بشم", "بشی", "بشن", "شد", "شدم", "شدی", "شدن", "شدند", "بزن", "بزنه", "زد", "زدم", "زدن", "بکن", "بکنه", "بگیر", "بگیره", "گرفت", "باشه", "بود", "بودم"]
);
/** Pronoun endings written apart («خانه ام»، «شماره ات»، «درباره اش»): the next word is no ezafe's second part. */
const CLITICS = new Set(["ام", "ات", "اش", "ای", "ایم", "اید", "اند", "تان", "شان", "مان", "ها", "های", "هایی", "هایم", "هایت", "هایش", "هایمان", "هایتان", "هایشان"]);
/** …and in speech («هامون» is also a lake). */
const SPOKEN_CLITICS = new Set(["تون", "شون", "مون", "هام", "هات", "هاش", "هامون", "هاتون", "هاشون", "هاس"]);
/** In speech: «یه لحظه صبر کن»، «یه دفعه»، «در اون باره». */
const IDIOM_AFTER: Record<string, Set<string>> = { لحظه: new Set(["یه", "یک"]), دفعه: new Set(["یه", "یک"]), ذره: new Set(["یه", "یک"]), خورده: new Set(["یه", "یک"]), باره: new Set(["این", "اون", "آن", "همین", "همون"]) };
/** Spoken words in «ه» that are never an ezafe's head: «آره»، «واسه». */
const SPOKEN_NOT_EZAFE = new Set(["آره", "واسه", "دیگه", "اگه", "چیه", "کیه", "ممکنه", "لازمه", "همینه", "همونه"]);
/**
 * In speech, a word + «ه» for «است» or the definite marker («منه»، «همینه»، «ممکنه»، «مسئوله»): the
 * word without «ه» is known, the word with it is not, and it is not a spoken form of a word in «ه» («خونه»).
 */
function spokenCopula(word: string): boolean {
    const st = word.slice(0, -1);
    if (isKnown(word) || st.length < 2 || !isKnown(st)) return false;
    const f = spokenForm(word);
    return !(f && f.formal.endsWith("ه"));
}

/** Words after which a word in «ه» is never in the ezafe: «خانه که»، «نامه به»، «کتاب‌خانه از». */
const NEVER_EZAFE_BEFORE = new Set([
    "که", "را", "و", "هم", "از", "به", "با", "تا", "یا", "اگه", "اگر", "است", "هست", "نیست", "بود", "شد", "می", "نمی", "خیلی", "اینجا", "اونجا"
]);

/** «کتابه» written for «کتابِ»: the stem, if this is that mistake. */
function ezafeWrittenAsHe(word: string): string | null {
    const stem = word.slice(0, -1);
    if (stem.length < 2 || isKnown(word) || !isKnown(stem)) return null;
    // «نزده»، «نکرده»: a past participle, not «نزد» + ezafe
    if (isParticiple(word)) return null;
    if ("اآوهة".includes(stem[stem.length - 1])) return null;
    // spoken forms of known words: «خونه» (خانه)، «نشونه» (نشانه)
    const i = word.lastIndexOf("ون");
    if (i >= 0 && isKnown(word.slice(0, i) + "ان" + word.slice(i + 2))) return null;
    return stem;
}

const EZAFE_PRONOUNS = ["من", "تو", "او", "ما", "شما", "ایشان", "آنها", "آن‌ها", "وی"];
/** Conjunctions and adverbs in «ه»: «بلکه ما»، «همیشه او» are not ezafes. */
const NOT_EZAFE = new Set([
    "بلکه", "که", "چه", "آنچه", "بالاخره", "خلاصه", "آخه", "دیگه", "اگه", "هرچه", "چنانچه", "اگرچه", "گرچه", "همیشه", "البته", "تازه", "دوباره", "همواره",
    "هماره", "یکباره", "وگرنه", "نه", "آهسته", "ناگه", "شبانه", "روزانه", "همانا", "زیراکه", "چنانکه", "آنکه", "اینکه"
]);

/*
 * 1.6.3 (the owner: «کسرۀ اضافه رو درست کن»). 300 cards judged by hand on blog and Wikipedia text found the
 * certain pronoun check wrong in «با این همه وی…»، «در نتیجه او…»، «اعضای خانواده او را … صدا می‌زدند»،
 * «بله من…»، «چهارشنبه تو راه» (spoken «تو» = in) and the model wrong on names, numbers before a counter
 * word, verbs and words that begin a new phrase. What follows narrows both.
 */
/** Interjections, adverbs and pronouns in «ه» that are never an ezafe's head («بله من»، «خوشبختانه تو»، «بنده تو»). */
const NEVER_HEAD = new Set(["بله", "آره", "اره", "بالله", "کاره", "نه", "خب", "بنده", "خوشبختانه", "متاسفانه", "متأسفانه", "شاید", "یکدفعه", "یه‌دفعه", "همه‌اش", "خلاصه", "تازه", "واسه", "دیگه", "اگه", "آخه", "چونکه"]);
/** «با این همه»، «در نتیجه»، «هر دفعه»، «یه دفعه»: a word that with the word before it is an adverb. */
const IDIOM_BEFORE: Record<string, Set<string>> = {
    همه: new Set(["این", "اون", "آن", "اینهمه"]),
    نتیجه: new Set(["در"]),
    دفعه: new Set(["هر", "یه", "یک", "این", "اون", "آن", "اولین", "دومین"]),
    لحظه: new Set(["هر", "یه", "یک"]),
    هفته: new Set(["هر"]),
    خلاصه: new Set(["در"]),
    ادامه: new Set(["در"])
};
/** Given names in «ه» that are no common word: «هاله جون»، «فاطمه خانم» (no ezafe). */
const NAMES = new Set([
    "فاطمه", "زهره", "طاهره", "سمیه", "حمزه", "هاله", "ژاله", "راضیه", "مرضیه", "منیژه", "نجمه", "صدیقه", "معصومه", "رقیه", "سکینه",
    "خدیجه", "ملیحه", "نفیسه", "حانیه", "هانیه", "فائزه", "فایزه", "شهره", "ساره", "ریحانه", "محبوبه", "منیره", "سمانه", "طیبه", "نسیبه",
    "نجیبه", "مائده", "فریده", "حمیده", "سعیده", "وحیده", "مجیده", "عطیه", "راحله", "جمیله", "سهیله", "نبیله", "عقیله", "فهیمه", "کریمه",
    "رحیمه", "حلیمه", "سلیمه", "زکیه", "رضیه", "نادیه", "ماریه", "آسیه", "آمنه", "زبیده", "صفیه", "مهدیه", "طه", "معاویه", "عایشه", "عاطفه",
    "یحیی‌زاده", "هله"
]);
/** Kinship words before a name («خاله صدف»، «عمه مریم»): a title, no ezafe. */
const KIN = new Set(["خاله", "عمه", "دایی‌زاده", "خاله‌زاده", "عمه‌زاده", "ننه", "بابا", "داداش", "آبجی"]);
/** After a name or a kinship word: «جون»، «خانم» (no ezafe: «هاله جون»). */
const ADDRESS = new Set(["جون", "جان", "خانم", "خانوم", "آقا", "بانو"]);
/** Counter words: «۲۴ قطعه سنگ»، «دو حلقه فیلم»، «یه بسته سیگار» (no ezafe after a number). */
const COUNTERS = new Set(["قطعه", "حلقه", "دانه", "بسته", "شاخه", "دسته", "تخته", "تکه", "قلاده", "کیسه", "شیشه", "جعبه", "کاسه", "لقمه", "کوزه", "بوته", "جلده", "رشته", "نسخه", "فقره", "پاره", "سری"]);
const NUMBER_WORDS = new Set(["یک", "یه", "دو", "سه", "چهار", "پنج", "شش", "شیش", "هفت", "هشت", "نه", "ده", "چند", "چندین", "دوتا", "سه‌تا", "صد", "هزار", "نیم"]);
const isNumberWord = (w: string) => NUMBER_WORDS.has(w) || /^[0-9۰-۹]+$/.test(w);
/** The word before `index` in `input` («» at the start or after a mark), and whether a digit comes right before. */
function wordBefore(input: string, index: number): string {
    const m = input.slice(Math.max(0, index - 40), index).match(/([\p{L}\u200c]+|[0-9۰-۹]+)[ \u200c]*$/u);
    return m?.[1] ?? "";
}
/** No ezafe on `word` before `next`, whatever the model says (1.6.3). */
function notEzafeHead(word: string, prev: string, next: string): boolean {
    if (NEVER_HEAD.has(word) || NAMES.has(word) || ADDRESS.has(next) || IDIOM_BEFORE[word]?.has(prev)) return true;
    // «خاله صدف»: a kinship word before what is no common noun (a name); «خالۀ مادرم» keeps its ezafe
    if (KIN.has(word) && !COMMON_NOUNS.has(next) && !/(?:م|ت|ش|مان|تان|شان|مون|تون|شون)$/.test(next)) return true;
    if (COUNTERS.has(word) && isNumberWord(prev)) return true;
    if (word === "گونه" && /^(هیچ|هر|این|آن|همین|همان|چه|بدین)$/.test(prev)) return true;
    // a verb next (written or spoken), that is no noun as well
    return isFiniteVerb(next);
}

const COPULAS = new Set(["است", "هست", "نیست", "بود", "نبود", "باشد", "نباشد", "بودند", "هستند", "نیستند"]);
/** Places in «ه» before a pronoun: «پس از اشغال فرانسه او…» is no ezafe (the model decides). */
const PLACES = new Set(["فرانسه", "ترکیه", "روسیه", "سوریه", "مقدونیه", "مکه", "مدینه", "کوفه", "بصره", "قونیه", "کره"]);
/** Words before a noun that make «X او» a phrase of its own («این دفعه من»، «پس از این حمله او»، «هر دفعه من»). */
const DETERMINERS = new Set(["این", "آن", "اون", "همین", "همان", "همون", "هر", "یه", "یک", "چند", "چه", "هیچ", "کدام", "کدوم"]);
/**
 * Can «word pron» («خانه من») only be read as an ezafe? `next`: the word after the pronoun (undefined at a mark or
 * the end), `prev`: the word before. (Red until 1.6.2, a suggestion since 1.6.3.)
 */
function pronounCertain(word: string, pron: string, next: string | undefined, prev: string, spoken: boolean): boolean {
    if (isPronouncedHe(word) || !endsWithSilentHe(word) || !isKnown(word) || NOT_EZAFE.has(word) || inBank(word) || missingMadd(word)) return false;
    // adjectives and participles rarely take a pronoun as ezafe: «خسته من»، «رفته او»
    if ((ADJECTIVES.has(word) && !COMMON_NOUNS.has(word)) || verbForm(word.slice(0, -1)) || verbLike(word, spoken)) return false;
    if (notEzafeHead(word, prev, pron) || PLACES.has(word)) return false;
    // after «این/هر/یه…» only before a copula («این نامۀ او است»), not «این دفعه من میومدم»، «پس از این حمله او یک چشم…»
    if (DETERMINERS.has(prev) && !(next !== undefined && COPULAS.has(next))) return false;
    // «تو» is also «in» («چهارشنبه تو راه مدرسه»): only before a mark or a copula; «ما بین» is «مابین»
    if (pron === "تو" && (spoken || (next !== undefined && !COPULAS.has(next)))) return false;
    if (pron === "ما" && next === "بین") return false;
    if (next === undefined) return true;
    // «اعضای خانواده او را … صدا می‌زدند»، «در خانه من نبودم»، «پس از این حمله او یک چشم…»: the sentence may split there
    if (next === "را" || next === "رو" || DETERMINERS.has(next) || isNumberWord(next)) return false;
    // «همه ما می‌دانیم»: «همه» before a plural pronoun is its ezafe, a verb next or not
    if (word === "همه" && /^(ما|شما|آنها|آن‌ها|ایشان)$/.test(pron)) return true;
    const verbNext = next !== "است" && (verbForm(next) !== null || isFiniteVerb(next) || (/^(ن?می|ب|ن)/.test(next) && verbForm(next.replace(/^(ن?می|ب|ن)/, "")) !== null));
    return !verbNext;
}

export default createPatternRule<Options>((options) => {
    const hamza = options.style === "he-hamza";
    const target = hamza ? "هٔ" : "ۀ";
    return {
        source: SOURCE,
        checks: [
            {
                // word ending in ه + (space|ZWNJ) + ی (optionally with kasra) as a separate token
                pattern: new RegExp(`${START}(${LETTER}+ه)[ ${ZWNJ}]ی\\u0650?${END}`, "g"),
                check: (m) => {
                    if (isPronouncedHe(m[1])) return null;
                    // 1.6.3: «بشه ی کمک» (a verb + «یه»)، «واسه ی» (spoken «برای»)، a word of the colloquial bank («خونه ی»:
                    // spelled as said, no card), «ن و ه ی» (letters)
                    if (isFiniteVerb(m[1]) || SPOKEN_NOT_EZAFE.has(m[1]) || NEVER_HEAD.has(m[1]) || inBank(m[1])) return null;
                    return {
                        message: `نشانۀ اضافه پس از «ه»ی غیرملفوظ «${target}» است، نه «ی» جدا`,
                        replacement: m[1].slice(0, -1) + target
                    };
                }
            },
            {
                // «کتابه من»: the next word is looked at but not consumed
                pattern: new RegExp(`${START}(${LETTER}{3,}ه)(?= (${LETTER}+)${END})`, "g"),
                check: (m) => {
                    // Narrowed in 1.4.0: on Wikipedia nearly every hit was a real word or a name
                    // («پیشرانه»، «فردینه ماه»، «نزده ولی»: 756 in 6000 articles, almost none right).
                    // Only a common noun before a pronoun, and only as a suggestion: «کتابه من».
                    const stem = ezafeWrittenAsHe(m[1]);
                    if (!stem || !COMMON_NOUNS.has(stem) || !PRONOUNS.has(m[2]) || verbLike(m[1], options.formal === false)) return null;
                    // «می تونه»، «مسئوله شما» in speech: a verb, or «است» as «ه»
                    if (/(?:^|[^\p{L}\u200c])ن?می +$/u.test(m.input.slice(0, m.index)) || (options.formal === false && spokenCopula(m[1]))) return null;
                    if (/[0-9۰-۹]\s*$/.test(m.input.slice(0, m.index))) return null; // «۱۵۰۰۰ نفره»
                    return {
                        message: `اگر کسرۀ اضافه است، با «ه» نوشته نمی‌شود: «${stem} ${m[2]}» (یا «${stem}ِ ${m[2]}»)`,
                        replacement: stem,
                        alternatives: [stem + "\u0650"],
                        fix: false
                    };
                }
            },
            {
                // «خانه من» → «خانۀ من»: before a personal pronoun the word is an ezafe, suggested where nothing
                // else can be read (1.6.3: the pronoun ends the sentence or a phrase, or a noun, an adjective or a
                // preposition follows it). Elsewhere («در نتیجه او…»، «خانواده او را … صدا زدند»، «این دفعه من…»)
                // the model below decides, as for any other word.
                pattern: new RegExp(`${START}(${LETTER}{2,}ه) (${EZAFE_PRONOUNS.join("|")})${END}(?: +([${LETTER_RANGE}${ZWNJ}]+))?`, "g"),
                check: (m) => {
                    if (!pronounCertain(m[1], m[2], m[3], wordBefore(m.input, m.index), options.formal === false)) return null;
                    // «اعوذ بالله من الشیطان»، «او حفره من حفر النیران»: Arabic
                    if (m[2] === "من" && /^[\s\p{L}\u200c]{0,25}?(?:^|\s)ال\p{L}/u.test(m.input.slice(m.index + m[0].length).replace(/^ +/, " "))) return null;
                    // what the model makes very unlikely: «با این همه وی…»، «پس از این حمله او…» (none right below 0.3)
                    const c = candidateAt(m.input, m.index);
                    if (c && c.p < PRONOUN_MIN_P && !(m[3] !== undefined && COPULAS.has(m[3]))) return null;
                    const fixed = m[1].slice(0, -1) + target;
                    return {
                        message: `نشانۀ اضافه پس از «ه»ی غیرملفوظ «${target}» است: «${fixed} ${m[2]}»`,
                        replacement: fixed,
                        end: m[1].length,
                        // a suggestion (yellow), not a red card: whether the word is in the ezafe is a reading; on cards
                        // judged by hand 39 of 40 right on Wikipedia, 50 of 55 on blogs (1.6.3), not the 99% of red
                        fix: false
                    };
                }
            },
            {
                // the model: «خانه قبلی» → «خانۀ قبلی». Pronouns are handled above.
                pattern: new RegExp(`${START}(${LETTER}{2,}ه)(?= +(${LETTER}+))`, "g"),
                check: (m) => {
                    // «بهانه ء»: the ezafe typed as a separate hamza (the check below)
                    if (options.model === false || hasPronouncedHe(m[1]) || /^[ءٔ]/.test(m[2])) return null;
                    // «اره» (آره)، «اینده» (آینده): the «آ» left out, typing-shortcuts' (1.6.0)
                    if (m[1] === "اره" || missingMadd(m[1])) return null;
                    // a verb, or a word that never comes before an ezafe's second part (1.5.2)
                    const spoken = options.formal === false;
                    const prev = m.input.slice(0, m.index).match(/([\p{L}\u200c]+)[ \u200c]*$/u)?.[1] ?? "";
                    if (verbLike(m[1], spoken, prev, m[2]) || NEVER_EZAFE_BEFORE.has(m[2]) || CLITICS.has(m[2])) return null;
                    // a pronoun next: the check above reports the clear ones; the model decides the rest
                    if (EZAFE_PRONOUNS.includes(m[2])) {
                        const after = m.input.slice(m.index + m[0].length).match(/^ +[\p{L}\u200c]+ +([\p{L}\u200c]+)/u)?.[1];
                        if (pronounCertain(m[1], m[2], after, wordBefore(m.input, m.index), spoken) || (m[2] === "ما" && after === "بین")) return null;
                    }
                    // 1.6.3: names, a counter after a number, a word written apart, a verb next, «با این همه»…
                    if (notEzafeHead(m[1], wordBefore(m.input, m.index), m[2]) || inBank(m[1])) return null;
                    // «می پره»: «می» written apart
                    if (/(?:^|[^\p{L}\u200c])ن?می +$/u.test(m.input.slice(0, m.index))) return null;
                    if (spoken) {
                        if (m[2] === "رو" || SPOKEN_CLITICS.has(m[2]) || SPOKEN_NOT_EZAFE.has(m[1]) || IDIOM_AFTER[m[1]]?.has(prev) || spokenCopula(m[1])) return null;
                        // «۲ ساله ول معطلم»: «ساله» after a number is «سال» + «است» or an adjective (1.6.3)
                        if (/^(ساله|ماهه|روزه|ساعته|دقیقه|هفته)$/.test(m[1]) && isNumberWord(wordBefore(m.input, m.index))) return null;
                        // a verb next: a compound verb or the end of a clause («استفاده کنه»، «کشته بشه»)
                        if (LIGHT_VERBS.has(m[2]) || verbLike(m[2], true) && !isParticiple(m[2])) return null;
                    }
                    // 1.6.1 (blogs: 54 of 124 model suggestions wrong), in every sentence:
                    // - only a known word: no ezafe advice on a typo, a name or a spoken form («طایقه»، «فنه»، «ماله»);
                    //   in a written sentence a word of the corpus will do («فلاسفۀ یونانی»)
                    if (!isKnown(m[1]) && (spoken || !spellingReady() || !accepted(m[1]))) return null;
                    // - a pronoun ending written apart («علاقه تونو»، «بچه اشون»، «عاشقانه ست»)، or the spoken «را»
                    if (m[2] === "رو" || CLITIC_WORD.test(m[2])) return null;
                    // - a light verb next («اجازه بدن»، «ادامه دهم»، «مطالعه کنین»): a compound verb
                    if (LIGHT_VERBS.has(m[2]) && !NOUN_TOO.has(m[2])) return null;
                    // - the word said twice («مرحله مرحله»، «لحظه لحظه»), «اون همه» (that much)
                    if (prev === m[1] || m[2] === m[1] || (m[1] === "همه" && /^(اون|آن|این|این‌|اینهمه)$/.test(prev))) return null;
                    // - the next word unknown (a typo or a run-together word: «شله زرمون»): no reading to go by
                    //   (in a spoken sentence; in a written one it is mostly a name: «جزیرۀ هومونهون»)
                    if (spoken && spellingReady() && !isKnown(m[2]) && !accepted(m[2]) && !spokenForm(m[2])) return null;
                    const c = candidateAt(m.input, m.index);
                    if (!c) return null;
                    const informal = spoken || informalLine(m.input, m.index);
                    // a compound written with a space: suggest the compound, not an ezafe
                    const compound = spacedCompound(m[1], m[2]);
                    // a compound of the farhang: the spaced-compounds rule reports it (one card, 1.6.1)
                    if (compound && isDictionaryWord(compound.replace(/\s.*$/, ""))) return null;
                    // «ایده ال» (ایده‌آل)، «همه جا»: one word written apart, no ezafe (1.6.3)
                    if (!compound && [m[1] + m[2], m[1] + ZWNJ + m[2], m[1] + ZWNJ + m[2].replace(/^ا/, "آ")].some((w) => isKnown(w))) return null;
                    if (compound ? c.p < (informal ? COMPOUND_SUGGEST_SPOKEN : COMPOUND_SUGGEST) : informal ? !SPOKEN_HEADS.has(m[1]) || c.p < MODEL_SUGGEST_SPOKEN : c.p < MODEL_SUGGEST) return null;
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
                    return { message: `نشانۀ اضافه پس از «ه»ی غیرملفوظ «${target}» است`, replacement: m[1].slice(0, -1) + target };
                }
            },
            {
                // «خانهٔ» → «خانۀ» (the other way with "he-hamza"); not after a pronounced «ه» («فرماندهٔ»): that is the final-he rule's
                pattern: new RegExp(`(${LETTER}*)${hamza ? "ۀ" : "هٔ"}`, "g"),
                check: (m) => {
                    if (hasPronouncedHe(m[1] + "ه")) return null;
                    return { message: `شکل یکدستِ نشانۀ اضافه «${target}» است`, replacement: target, start: m[1].length };
                }
            }
        ]
    };
});
