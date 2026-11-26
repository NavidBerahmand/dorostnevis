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
 * (کلمهٔ مختوم به «ه»: «خانهها» ← «خانه‌ها») اصلاح خودکار دارد.
 * با گزینهٔ { "mode": "required-only" } فقط موارد الزامی (کلمهٔ مختوم به «ه»)
 * گزارش می‌شوند و نویسنده می‌تواند «ها» را در بقیهٔ موارد پیوسته بنویسد.
 */
import commonNouns from "../dict/hazm-common-nouns.json";
import hazmAdjectives from "../dict/hazm-adjectives.json";
import { createPatternRule } from "../util/pattern-rule";
import { START, END, LETTER, NON_JOINING, ZWNJ, joinWithHalfSpace } from "../util/persian";
import { isKnown, isDictionaryWord } from "../util/words";

export interface Options {
    mode?: "recommended" | "required-only";
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
                message: "«ها»ی جمع با فاصلهٔ کامل نوشته نمی‌شود",
                replacement: joinWithHalfSpace(m[1], "ها" + (m[2] ?? ""))
            })
        },
        {
            pattern: PATTERN,
            check: (m) => {
                const stem = m[1];
                const suffix = m[2] ?? "";
                if (NOT_PLURAL.has(stem + "ها")) return null;
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
                    return {
                        message: `این کلمه دو خوانش دارد: «${copula}» یا «${stem + ZWNJ}ها${suffix}»؛ هر دو با نیم‌فاصله`,
                        fix: false
                    };
                }
                const endsWithHe = stem.endsWith("ه");
                if (options.mode === "required-only" && !endsWithHe) return null;
                const separate = stem + ZWNJ + "ها" + suffix;
                // the book requires it only after «ه» (تبصره، بند ۵); elsewhere both forms
                // are correct and separating is a recommendation: reported, never fixed
                if (!endsWithHe) {
                    return {
                        message: `پیوسته هم درست است؛ کتاب جدانویسی «ها» را توصیه می‌کند: «${separate}»`,
                        fix: false
                    };
                }
                return {
                    message: "پس از «ه» نشانهٔ جمع «ها» باید جدا (با نیم‌فاصله) نوشته شود",
                    replacement: separate
                };
            }
        }
    ]
}));
