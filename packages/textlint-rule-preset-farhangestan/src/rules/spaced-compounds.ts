/*
 * ترکیب‌های فاصله‌دار: «جامعه شناس» ← «جامعه‌شناس»، «دانش آموزان» ← «دانش‌آموزان»
 *
 * همۀ ترکیب‌های فرهنگ املایی که با نیم‌فاصله یا پیوسته آمده‌اند؛ با فاصله نوشتنشان
 * غلط است (کتاب بر سلیقۀ ویکی‌پدیا مقدّم است). شمارش ویکی‌پدیا فقط رنگ را تعیین می‌کند
 * (scripts/lists/build_compounds.py):
 * - قرمز: صورت فاصله‌دار دو کلمۀ مستقل نمی‌تواند باشد («آموز» به‌تنهایی کلمه نیست).
 * - زرد: می‌تواند دو کلمه هم باشد («کار خانه» = «کارِ خانه»، «خانۀ دار»)؛ پیشنهاد با
 *   «اگر … یک واژه است».
 * - کنار گذاشته: با حرف اضافه و مانند آن («به نام»، «در گذشته») یا با فعل («قرار داد»).
 * ترکیب‌های فهرست پیشین (۱.۳.۱، برگزیده با شمارش ویکی‌پدیا) همان قرمز می‌مانند.
 * پسوند پیوسته پس از جزء آخر هم پذیرفته است: «رئیس جمهوری»، «جمع آوری‌ها»؛ پسوندی که از
 * جزء آخر کلمۀ مستقل («آموزش») یا فعل («یابیم») بسازد، زرد یا بی‌گزارش است.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, ZWNJ, WORD, WORD_CHAR, LETTER, toPersianDigits } from "../util/persian";
import data from "../dict/spaced-compounds.json";
import commonNouns from "../dict/hazm-common-nouns.json";
import hazmAdjectives from "../dict/hazm-adjectives.json";

/** Words of their own: «دست سازمان» is «دست» + «سازمان», not «دست‌ساز» + «مان». */
const STANDALONE = new Set<string>([...commonNouns.words, ...hazmAdjectives.adjectives]);
/** Last words that make two words of a spaced pair: the spoken «را», pronouns. */
const TWO_WORDS_LAST = new Set(["رو", "را", "من", "تو", "او", "ما", "شما", "اون", "اونا", "منم", "توام", "اینو", "اونو"]);
/** A light verb as the last word: «پاک کنی» is a compound verb (compound-verbs: spaced), not «پاک‌کنی». */
const LIGHT_VERB_WORD = new RegExp(
    "^(?:" +
        // compound-verbs' forms: past stems with a person ending or «ن», bare present stems with a person ending
        "(?:کرد|شد|نمود|گردید|داد|گرفت|داشت|زد|گفت|یافت)(?:|م|ی|یم|ید|ند|ن)" +
        "|(?:ن?می\u200c?|ب|ن)?(?:کن|شو|نما|گرد|ده|گیر|دار|زن|گوی|یاب)(?:م|ی|د|یم|ید|ند)" +
        // a negated past: «حال ندارم» is «ندارم», not «حال‌ندار» + «م» (1.6.1)
        "|ن(?:کرد|شد|داد|گرفت|داشت|زد|گفت|یافت)(?:|م|ی|یم|ید|ند|ن)" +
    ")$"
);

interface Entry {
    spaced: string;
    to: string;
    page: number;
    /** the 2nd edition of دستور خط overrides the farhang's form */
    book?: boolean;
    /** the spaced form can also be two words (yellow) */
    amb?: boolean;
    /** suffixes after the last part that make it a standalone word (yellow) or a verb (no report) */
    ambSuf?: string[];
    verbSuf?: string[];
}
type Row = [string, string | number, number, number, string?, string?];


// «انگلیسی زبان» ← «انگلیسی‌زبان»: the farhang has «انگلیسی‌زبان» (ص ۷۸)، «فارسی‌زبان» (ص ۴۶۵)،
// «آذری‌زبان» (ص ۳۵); other languages by the same pattern. «X زبان» is also «X» + «زبان»
// («زبان فارسی زبان رسمی است»), so only «X زبانان» and «X زبان» after a plural or a
// people-noun («کشورهای انگلیسی زبان»، «مردم فارسی زبان») are taken.
const LANG_PAGE: Record<string, number> = { انگلیسی: 78, فارسی: 465, آذری: 35 };
const LANGS = [
    "انگلیسی", "فارسی", "آذری", "عربی", "ترکی", "فرانسوی", "آلمانی", "روسی", "اسپانیایی", "کردی", "ایتالیایی",
    "چینی", "ژاپنی", "پرتغالی", "هلندی", "ارمنی", "یونانی", "لاتین", "عبری", "هندی", "اردو", "پشتو", "بلوچی", "ترکمنی", "گرجی", "تاجیکی"
];
const PEOPLE = /(?:ها|های|مردم|جوامع|ملل|اقوام|جمعیت|جامعه|جامعۀ|جامعهٔ|کشور|مناطق|منطقه|منطقۀ|منطقهٔ|افراد|نویسندگان|شاعران|کاربران|خانواده|خانواده‌های)$/;
// «X زبان» of a language is left to the check below, which looks at the context
const isLang = (spaced: string) => /^\S+ زبان(ان)?$/.test(spaced) && LANGS.includes(spaced.split(" ")[0]);
const ENTRIES = new Map<string, Entry>((data.entries as Entry[]).filter((e) => !isLang(e.spaced)).map((e) => [e.spaced, e]));
for (const [spaced, to, page, kind, amb, verb] of data.more as Row[]) {
    if (ENTRIES.has(spaced) || isLang(spaced)) continue;
    // a joined target with a silent «ه» inside («همه مهم» → «همهمهم») cannot be right: the book puts a ZWNJ there
    if (to === 1 && /ه /.test(spaced)) continue;
    ENTRIES.set(spaced, {
        spaced,
        to: to === 0 ? spaced.replace(/ /g, ZWNJ) : to === 1 ? spaced.replace(/ /g, "") : (to as string),
        page,
        amb: (kind & 1) === 1,
        book: (kind & 2) === 2,
        ambSuf: amb ? amb.split(",") : undefined,
        verbSuf: verb ? verb.split(",") : undefined
    });
}
const SUFFIXES = ["", "ی", "ها", "های", "ان", "ات", "ش", "شان", "ای", "یی", "م", "ت", "مان", "تان"];
const MAX_PARTS = Math.max(...[...ENTRIES.keys()].map((k) => k.split(" ").length));

/** The compound that starts at the matched word, if any: the most words first, then the longest last part. */
function findCompound(m: RegExpExecArray): { len: number; e: Entry; suf: string; amb: boolean } | null {
    const words: Array<{ w: string; at: number }> = [{ w: m[1], at: 0 }];
    const rest = m[2] ?? "";
    for (const w of rest.matchAll(new RegExp(WORD, "g"))) words.push({ w: w[0], at: m[1].length + w.index! });
    for (let n = Math.min(MAX_PARTS, words.length); n >= 2; n--) {
        const head = words.slice(0, n - 1).map((x) => x.w).join(" ");
        const last = words[n - 1];
        // the last word up to its end or a ZWNJ («جمع آوری‌ها»: «آوری», then «‌ها» stays)
        const cuts = [last.w.length];
        for (let i = last.w.length - 1; i > 0; i--) if (last.w[i] === ZWNJ) cuts.push(i);
        for (const cut of cuts) {
            const tok = last.w.slice(0, cut);
            for (const suf of SUFFIXES) {
                if (suf && !tok.endsWith(suf)) continue;
                const e = ENTRIES.get(`${head} ${tok.slice(0, tok.length - suf.length)}`);
                if (!e) continue;
                if (suf && e.verbSuf?.includes(suf)) continue;
                // the last word with its «suffix» is a word of its own («سازمان»، «بافت»): not this compound
                if (suf && STANDALONE.has(tok)) continue;
                if (LIGHT_VERB_WORD.test(tok)) continue;
                return { len: last.at + cut, e, suf, amb: !!e.amb || (!!suf && !!e.ambSuf?.includes(suf)) };
            }
        }
    }
    return null;
}
/** A light verb next: «زبان باز کرد» is «باز کرد», not «زبان‌باز» (only for the two-word readings). */
const LIGHT_VERB = new RegExp(
    `^\\s+(?:ن?می${ZWNJ}?|ب|ن)?(?:کرد|کن|شد|شو|داد|ده|زد|زن|گرفت|گیر|آمد|آی|آورد|آور|خورد|خور|کشید|کش|داشت|دار|ساخت|ساز|نمود|نما|گشت|گرد|رفت|رو|بست|بند|افتاد|افت|انداخت|انداز|یافت|یاب)`
);
/** Spaces between the parts, the special Unicode ones too (another rule makes those plain). */
const SPACE = "[ \\u00A0\\u2000-\\u200A\\u202F\\u205F\\u3000]";
// one report per run of words: a later word inside a reported compound starts nothing
let lastInput = "";
let lastIndex = -1;
let coveredTo = -1;

export default createPatternRule(() => ({
    source: "فرهنگ املایی خطّ فارسی",
    checks: [
        {
            pattern: new RegExp(`${START}((?:غیر${ZWNJ}?)?(${LANGS.join("|")})) زبان(ان)?${END}`, "g"),
            check: (m) => {
                if (!m[3]) {
                    const prev = m.input.slice(0, m.index).trimEnd().split(/\s+/).pop() ?? "";
                    if (!PEOPLE.test(prev)) return null;
                }
                const page = LANG_PAGE[m[2]];
                return {
                    message: `«زبان» در این ترکیب صفت می‌سازد و با نیم‌فاصله نوشته می‌شود: «${m[1]}${ZWNJ}زبان${m[3] ?? ""}»`,
                    replacement: `${m[1]}${ZWNJ}زبان${m[3] ?? ""}`,
                    source: page
                        ? `فرهنگ املایی، ص ${toPersianDigits(page)}`
                        : `فرهنگ املایی، ص ${toPersianDigits(78)}، به قیاس «انگلیسی‌زبان»`
                };
            }
        },
        {
            pattern: new RegExp(`${START}(${LETTER}${WORD_CHAR}*)(?=((?:${SPACE}+${WORD}){1,${MAX_PARTS - 1}}))`, "g"),
            check: (m) => {
                if (m.input !== lastInput || m.index <= lastIndex) coveredTo = -1; // a new text
                lastInput = m.input;
                lastIndex = m.index;
                if (m.index < coveredTo) return null;
                const found = findCompound(m);
                if (!found) return null;
                const { len: end, e, suf, amb } = found;
                coveredTo = m.index + end;
                // «هر دو روی لحاف»: «both on», not «دوروی» (two-faced)
                const prevWord = m.input.slice(0, m.index).trimEnd().split(/\s+/).pop() ?? "";
                if (prevWord === "هر" && /^(دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده)$/.test(m[1])) return null;
                // the ezafe mark is always «ۀ» (the farhang's «ۀ» is the same letter)
                const to = (e.to + suf).replace(/هٔ/g, "ۀ").replace(/(?<=[اآدذرزژو])\u200c/g, "");
                const how = e.to.includes(ZWNJ) ? "با نیم‌فاصله" : "پیوسته";
                const source = e.book
                    ? `دستور خط (ویراست جدید)؛ فرهنگ املایی، ص ${toPersianDigits(e.page)}، «${e.spaced.replace(/ /g, ZWNJ)}» دارد`
                    : `فرهنگ املایی، ص ${toPersianDigits(e.page)}`;
                if (amb) {
                    if (LIGHT_VERB.test(m.input.slice(m.index + end))) return null;
                    // the two-word reading, surely (1.6.1): the last word is the spoken «را» or a pronoun («دو رو»
                    // = «دو را»، «بدن ما»), or a number counts on («یک بار دو بار»)
                    const lastWord = m.input.slice(m.index, m.index + end).split(/\s+/).pop() ?? "";
                    if (TWO_WORDS_LAST.has(lastWord)) return null;
                    if (/^(یک|یه|دو|سه) /.test(e.spaced) && /^\s*(یک|دو|سه|چهار|پنج|[0-9۰-۹])/.test(m.input.slice(m.index + end))) return null;
                    return {
                        message: `اگر «${m.input.slice(m.index, m.index + end).replace(/\s+/g, " ")}» یک واژه است، ${how} نوشته می‌شود: «${to}»`,
                        replacement: to,
                        fix: false,
                        end,
                        source
                    };
                }
                return { message: `این ترکیب یک کلمه است و ${how} نوشته می‌شود: «${e.to.replace(/هٔ/g, "ۀ")}»`, replacement: to, end, source };
            }
        }
    ]
}));
