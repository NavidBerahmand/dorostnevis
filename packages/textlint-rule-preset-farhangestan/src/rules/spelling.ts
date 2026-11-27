/*
 * غلط تایپی (خارج از دستور خط)
 *
 * کلمه‌ای که در واژه‌نامه نیست و یک کلمۀ پرکاربرد با یک حرف تفاوت به آن
 * نزدیک است: «طایقه» ← «طایفه»، «مشمل» ← «مشتمل»؛ یا دو کلمۀ چسبیده:
 * «درکانادا» ← «در کانادا» (از ۱.۵.۰ فقط نامزدی که از معیار کیفیت بگذرد: util/speller.ts؛ از ۱.۶.۴
 * بی نامزد، علامتی نیست، و کنار نام هم نه: nameContext؛ و شکل گفتاری «چمدون» غلط تایپی نیست:
 * util/colloquial.ts). فقط پیشنهاد، بدون اصلاح خودکار: نام‌های خاص و
 * کلمه‌های تازه هم در واژه‌نامه نیستند. واژه‌نامه: شکل‌هایی که دست‌کم سه
 * بار در ویکی‌پدیای فارسی آمده‌اند، به‌اضافۀ Hazm و فرهنگ املایی
 * (scripts/spelling/).
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../util/persian";
import { spellingCheck, accepted, spellingReady, corpusBucket, nameFirst } from "../util/speller";
import { spoken, knownish, registerSegments, spokenAt } from "../util/colloquial";
import { gozarCorrection } from "./gozar";
import { MISSPELLED, misspelledHomophone } from "./misspellings";
import { handledByShortcuts } from "./typing-shortcuts";
import { FARHANG, FARHANG_OVERRIDES, isKnown } from "../util/words";
import { verbForm } from "./mi-prefix";
import compounds from "../dict/compounds.json";
import hamza from "../dict/hamza.json";
import arabic from "../dict/arabic.json";
import multiSpelling from "../dict/multi-spelling.json";

/** The book's lists, wrong form → right form: a suggestion is offered in its right form. */
const LISTED = new Map<string, string>(
    [compounds, hamza, arabic, multiSpelling].flatMap((d) => (d.entries as Array<{ from: string[]; to: string; fix?: boolean }>).filter((e) => e.fix !== false).flatMap((e) => e.from.map((f) => [f, e.to] as [string, string])))
);
const NUMBER = /^(یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده|بیست|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود|صد|یکصد|دویست|سیصد|چهارصد|پانصد|ششصد|هفتصد|هشتصد|نهصد|هزار|میلیون|میلیارد)$/;
/** A suggestion as the other rules want it written («زبانشناس» → «زبان‌شناس»، «میرود» → «می‌رود»); null: not one to offer. */
function written(s: string): string | null {
    // «هشتاد هزار»: the numbers rule joins the parts of a number
    if (s.includes(" ") && s.split(" ").every((p) => NUMBER.test(p))) return null;
    const listed = LISTED.get(s);
    if (listed) return listed;
    const key = s.replace(new RegExp(ZWNJ, "g"), "");
    const f = FARHANG_OVERRIDES[key] ?? FARHANG[key]?.[0];
    if (f && f.replace(new RegExp(ZWNJ, "g"), "") === key) return f.replace(/هٔ/g, "ۀ");
    const mi = s.match(/^(ن?می)([^\u200c].+)$/);
    if (mi && verbForm(mi[2])) return mi[1] + ZWNJ + mi[2];
    return s;
}

/**
 * A function word run into a frequent word («درزنجان» → «در زنجان»، spoken «روبا» → «رو با»), or a tanvin
 * typed as «آ» («واقعآ» → «واقعاً»): sure whatever is around it. Not before a rare word: «واحیده» is the
 * name «Vahide», not «و احیده».
 */
const FUNCTION_SPLIT = /^(?:و|در|از|به|با|که|رو|تو|تا|هر|برای|واسه) (.+)$/;
function sure(suggestion: string): boolean {
    if (/اً$/.test(suggestion)) return true;
    const rest = suggestion.match(FUNCTION_SPLIT)?.[1];
    return !!rest && (rest.includes(" ") || (corpusBucket(rest) ?? -1) >= 8);
}
/** Words before a name: titles, kin, and places, works and groups by kind («روستای …»، «کوه …»، «مجلۀ …»، «همسر …»). */
const NAME_CUES = new Set(
    ("آقای آقا خانم خانوم دکتر مهندس استاد پروفسور کنت ژنرال سرهنگ سردار ملا شیخ حاج حاجی سید میرزا جناب سرکار سر " +
        "شهر شهرستان استان روستای روستا دهستان بخش کوه رود رودخانه دریاچه جزیره بندر محله تپه دره دشت بند سد پایگاه " +
        "تئاتر مجله مجلۀ نشریه نشریۀ روزنامه روزنامۀ شرکت گروه تیم باشگاه برند فیلم سریال آلبوم ترانه رمان ایستگاه " +
        "خیابان میدان بزرگراه کاخ قلعه قلعۀ مسجد امامزاده قبیله طایفه ایل خاندان شهرداری ولسوالی آرامگاه سلطان " +
        "پدر مادر پسر دختر همسر برادر خواهر فرزند نوه").split(" ")
);
const PERSIAN_WORD = new RegExp(`^${LETTER}[${"\\u0621-\\u063A\\u0641-\\u064A\\u06CC\\u06A9\\u06AF\\u067E\\u0686\\u0698\\u0622"}${ZWNJ}]{2,}$`);
/**
 * The word is in a name (1.6.4; on held-out Wikipedia 92 of 160 judged cards were names): after a title,
 * a first name or a place word («کارل وندلینگر»، «رودخانه‌های پخیر»), next to a word the lexicon has not
 * or hardly has (across «،» and «و» in a list: «پیپه، جفه، پونکه و تویری»), alone in parentheses
 * («(هرهز)»), in a list with another such word («سپیار، کیش، اکشک»), before «نام داشت» or «، استان …», before
 * its Latin spelling in the same clause («جاثی، معادل انگلیسی Hercules») or an Arabic «ال…» word
 * («نیاطی القلب»).
 */
function nameContext(input: string, start: number, end: number): boolean {
    const SEP = /[\s«»"'()\[\]،,:؛.!?؟\-–]+/;
    const beforeWords = input.slice(Math.max(0, start - 60), start).split(SEP).filter(Boolean);
    const afterWords = input.slice(end, end + 60).split(SEP).filter(Boolean);
    // (the first word of the window may be cut)
    if (input.slice(Math.max(0, start - 60), start).length === 60) beforeWords.shift();
    const cue = (w: string) => NAME_CUES.has(w) || NAME_CUES.has(w.replace(/(?:\u200c?های|\u200c?ها|ۀ|ی)$/, ""));
    const prev = beforeWords[beforeWords.length - 1] ?? "";
    // a title or a place word one or two words back («ژنرال خزر پسخ»), a first name just before
    if (cue(prev) || cue(beforeWords[beforeWords.length - 2] ?? "") || nameFirst(prev)) return true;
    // «… هزاله نام داشت»، «… استپار، استان بورگس»
    if (/^\s*(?:نام|نامیده|موسوم|معروف)/.test(input.slice(end)) || /^\s*،\s*(\S+)/.test(input.slice(end)) && cue(input.slice(end).match(/^\s*،\s*([^\s،]+)/)![1])) return true;
    if (/\(\s*$/.test(input.slice(0, start)) && /^\s*[)،]/.test(input.slice(end))) return true;
    // a link or a name joined with a hyphen: «[[ونتنار …»، «گالیسیا-وولینیا»
    if (/(?:\[\[|[\p{L}]-)$/u.test(input.slice(Math.max(0, start - 2), start))) return true;
    const clause = input.slice(end, end + 60).split(/[.!?؟\n]/)[0];
    if (/[A-Za-z]{3}/.test(clause.split(/[«»"]/)[0])) return true;
    if (/^ال.{3,}/.test(afterWords[0] ?? "")) return true;
    // (a word the lexicon has not, or has seen under eight times: «کوره‌چیکا»)
    const unknown = (x: string) => PERSIAN_WORD.test(x) && (corpusBucket(x) ?? 0) < 3 && !spoken(x) && !knownish(x);
    const item = (ws: string[]) => (ws[0] === "و" ? ws[1] ?? "" : ws[0] ?? "");
    if (unknown(item([...beforeWords].reverse())) || unknown(item(afterWords))) return true;
    // in a list («سپیار، کیش، اکشک، لارک»): two one-word items on either side
    if (!/^\s*،/.test(input.slice(end))) return false;
    const after = input.slice(end, end + 60).replace(/^\s*،/, "").split("،").slice(0, 2);
    const before = input.slice(Math.max(0, start - 60), start).split("،").slice(-3, -1);
    return [...after, ...before].map((x) => x.trim()).some((x) => !/\s/.test(x) && unknown(x));
}

const SOURCE = "غلط‌یاب (واژه‌نامۀ ساخته‌شده از ویکی‌پدیای فارسی؛ در دستور خط نیامده)";

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            // a Persian word not touching Latin letters or digits («Windows۱۰»، «ATMها»)
            pattern: new RegExp(`(?<![A-Za-z0-9۰-۹])${START}${LETTER}[${"\\u0621-\\u063A\\u0641-\\u064A\\u0671-\\u06D3\\u06CC\\u06A9\\u06AF\\u067E\\u0686\\u0698"}${ZWNJ}]{2,}${END}(?![A-Za-z0-9۰-۹])`, "g"),
            check: (m) => {
                // the same unknown word twice in a paragraph is a name or a term, not a typo
                if (m.input.split(m[0]).length > 2) return null;
                // the gozar and misspellings rules correct these with the book's page
                if (gozarCorrection(m[0]) || MISSPELLED.has(m[0]) || misspelledHomophone(m[0]) || handledByShortcuts(m[0])) return null;
                // a spoken form («چمدون‌های»، «میگه»، «خانما»، «کلاهتو»): fine in a spoken sentence; in a
                // written one the spoken-word rule offers the written form (blue) where it is sure of it,
                // and a typo guess would be absurd anyway (a known word with a spoken ending)
                const inSpoken = spokenAt(registerSegments(m.input), m.index);
                if (spoken(m[0])) return null;
                // «توصورتم» in a spoken sentence: «تو صورتم» (the spoken-spelling rule)
                if (/^تو/.test(m[0]) && knownish(m[0].slice(2)) && inSpoken) return null;
                // a short word run into a spoken one: «بااون» → «با اون» (not «براون»)
                // (not a word of the lexicon: «توماس» is a name, not «تو ماس»; 1.6.4)
                const run = spellingReady() && accepted(m[0]) ? null : m[0].match(/^(با|از|به|که|تو|رو|این|اون|یه|در)(.{3,})$/);
                const rest = run ? spoken(run[2]) : null;
                if (run && rest && !rest.hint) {
                    const two = run[1] + " " + run[2];
                    return { message: `«${m[0]}» در واژه‌نامه نیست؛ شاید «${two}»`, replacement: two, fix: false };
                }
                const r = spellingCheck(m[0], inSpoken);
                // a word with nothing convincing to offer gets no card (1.6.4: «در واژه‌نامه نیست» alone was
                // right on 24 of 135 judged cards, 1 of 86 on Wikipedia: names, loanwords, spoken forms)
                if (!r || "note" in r) return null;
                const s = [...new Set(r.suggestions.map(written).filter((x): x is string => !!x && x !== m[0]))];
                if (!s.length) return null;
                // a guess (not a function word run into the next one) beside a name: the word is a name too
                if (!sure(s[0]) && nameContext(m.input, m.index, m.index + m[0].length)) return null;
                // a written word of three letters: a name or a term 8 times in 10 on held-out Wikipedia
                // («فتز»، «پبو»، «پسخ»، «کنب»، «وسو»; 1.6.4)
                if (!inSpoken && m[0].length <= 3 && !/اً$/.test(s[0])) return null;
                // a part of a compound with the word before: «تبارک وتعالی» («تبارک‌وتعالی»)
                const prevWord = m.input.slice(0, m.index).match(/([\p{L}\u200c]+)\s+$/u)?.[1] ?? "";
                if (prevWord && (isKnown(prevWord + m[0]) || isKnown(prevWord + ZWNJ + m[0]))) return null;
                // a written word one letter short of a word at its end: «محرو» (place) → «محروم»، «دوقل» (a game) → «دوقلو»
                if (!inSpoken && !s[0].includes(" ") && s[0].length === m[0].length + 1 && s[0].startsWith(m[0])) return null;
                const others = s.slice(1).map((x) => `«${x}»`).join("، ");
                return {
                    message: `«${m[0]}» در واژه‌نامه نیست؛ شاید «${s[0]}»${others ? ` (یا ${others})` : ""}`,
                    replacement: s[0],
                    alternatives: s.slice(1),
                    fix: false
                };
            }
        }
    ]
}));
