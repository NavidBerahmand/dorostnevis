/*
 * «ها»ی جمع
 *
 * دستور خط، «ها (نشانۀ جمع)» (ص ۴۰):
 *   -ها در الحاق به کلمات به هر دو صورتِ پیوسته و جدا (با نیم‌فاصله/
 *   بی‌فاصله) به کار می‌رود، ولی جدانویسی آن، ازلحاظ آموزشی و همچنین مسائل
 *   فنّی مربوط به پردازش متن، توصیه می‌شود: کتابها/ کتاب‌ها …
 *   تبصره: «ها» در موارد زیر فقط به‌صورتِ جدا نوشته شود: … ۵. هنگامی که
 *   کلمه به «ها»ی غیرملفوظ ختم شود: خانه‌ها، میوه‌ها …
 *
 * حالت پیش‌فرض («recommended») جدانویسی توصیه‌شده را گزارش می‌کند ولی خودکار
 * اعمال نمی‌کند: پیوسته‌نویسی («آنها»، «کتابها») غلط نیست. فقط مورد الزامی
 * (کلمۀ مختوم به «ه»: «خانهها» ← «خانه‌ها») اصلاح خودکار دارد.
 * با گزینۀ { "mode": "required-only" } فقط موارد الزامی (کلمۀ مختوم به «ه»)
 * گزارش می‌شوند و نویسنده می‌تواند «ها» را در بقیۀ موارد پیوسته بنویسد.
 */
import { missingMadd } from "../util/madd";
import commonNouns from "../dict/hazm-common-nouns.json";
import hazmAdjectives from "../dict/hazm-adjectives.json";
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, NON_JOINING, ZWNJ, joinWithHalfSpace } from "../util/persian";
import { isKnown, isDictionaryWord } from "../util/words";

export interface Options {
    mode?: "recommended" | "required-only";
    /** The writer always separates «ها» (the page's setting): joined «ها» gets a fix. */
    apart?: boolean;
}

const SOURCE = "دستور خط، «ها (نشانۀ جمع)»، ص ۴۰";

/** Words that end in «ها» but are not plurals. */
const NOT_PLURAL = new Set([
    "تنها", "بها", "فقها", "سفها", "سها", "گرانبها", "خونبها", "کمبها", "پربها",
    "انتها", "اشتها", "منتها", "منهای", "منها"
]);

const SUFFIXES = "یشان|یتان|یمان|یی|یم|یت|یش|ی";

// stem must end with a joining letter (after a non-joining letter the
// joined and separated forms look the same and need no change)
const JOINING_LETTER = `(?![${NON_JOINING}])${LETTER}`;
const PATTERN = new RegExp(`${START}(${LETTER}*${JOINING_LETTER})ها(${SUFFIXES})?${END}`, "g");

// «کتاب ها» (full space before ها) is wrong in every mode — except «های» as
// the name of the letter ه («های غیرملفوظ», «های بیان حرکت») or «های و هوی».
const LETTER_NAME_FOLLOWERS = "غیرملفوظ|ملفوظ|بیان|هوز|دوچشم|و +هوی|و +هو";
const SPACED = new RegExp(
    `${START}(${LETTER}{2,}) +ها(${SUFFIXES})?${END}(?! +(?:${LETTER_NAME_FOLLOWERS})${END})`,
    "g"
);

const COMMON_NOUNS = new Set<string>(commonNouns.words);
const ADJECTIVES = new Set<string>(hazmAdjectives.adjectives);

export default createPatternRule<Options>((options) => ({
    source: SOURCE,
    checks: [
        {
            pattern: SPACED,
            check: (m) => ({
                message: "«ها»ی جمع با فاصلۀ کامل نوشته نمی‌شود",
                replacement: joinWithHalfSpace(m[1], "ها" + (m[2] ?? ""))
            })
        },
        {
            pattern: PATTERN,
            check: (m) => {
                const stem = m[1];
                const suffix = m[2] ?? "";
                if (NOT_PLURAL.has(stem + "ها") || missingMadd(m[0])) return null; // «انها» is «آنها» (1.6.0)
                // a dictionary word that merely contains «ها» (درنهایت، شیربها، بااشتها):
                // what comes before «ها» is not a word. («آنها» is a plural: «آن» is.)
                if (isDictionaryWord(m[0]) && !isKnown(stem)) return null;
                if (stem.length < 2) return null;
                // «خانهای» = «خانه» + «ای», «خستهایم» = «خسته» + «ایم», not a plural
                if ((suffix === "ی" || suffix === "یم") && isKnown(stem + "ه")) {
                    const copula = stem + "ه" + ZWNJ + "ا" + suffix;
                    // a rare «Xه» («هله» in «هلهایم», a name) is not enough for an automatic fix
                    if (!isKnown(stem) && (COMMON_NOUNS.has(stem + "ه") || ADJECTIVES.has(stem + "ه"))) {
                        return {
                            message: `«ا${suffix}» پس از «ه» با نیم‌فاصله نوشته می‌شود: «${copula}»`,
                            replacement: copula
                        };
                    }
                    // the likelier reading first: before a noun («سالهای بچگی») the plural, else «ساله‌ای»
                    const plural = stem + ZWNJ + "ها" + suffix;
                    const next = m.input.slice(m.index + m[0].length).match(/^ +([\u0621-\u06cc\u200c]+)/)?.[1];
                    const nounNext = suffix === "ی" && next !== undefined && !/^(است|بود|که|و|را|هم|شد|نیست|هست|می|نمی)$/.test(next) && !/^ن?می\u200c?/.test(next);
                    const [first, second] = nounNext ? [plural, copula] : [copula, plural];
                    return {
                        message: `این کلمه دو خوانش دارد: «${first}» یا «${second}»؛ هر دو با نیم‌فاصله`,
                        replacement: first,
                        alternatives: [second],
                        fix: false
                    };
                }
                const endsWithHe = stem.endsWith("ه");
                if (options.mode === "required-only" && !endsWithHe) return null;
                const separate = stem + ZWNJ + "ها" + suffix;
                // the book requires it only after «ه» (تبصره، بند ۵); elsewhere both forms
                // are correct and separating is a recommendation: reported, never fixed
                if (!endsWithHe) {
                    if (options.apart) return { message: `«ها» جدا نوشته می‌شود (تنظیم «ها»ی جمع: «همیشه جدا»): «${separate}»`, replacement: separate };
                    return {
                        message: `کتاب جدانویسی «ها» را توصیه می‌کند: «${separate}»؛ پیوسته هم درست است`,
                        replacement: separate,
                        kind: "suggestion",
                        fix: false
                    };
                }
                return {
                    message: "پس از «ه» نشانۀ جمع «ها» باید جدا (با نیم‌فاصله) نوشته شود",
                    replacement: separate
                };
            }
        }
    ]
}));
