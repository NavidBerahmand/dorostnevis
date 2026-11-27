/**
 * The chip on each card: a Persian name for every rule the page runs (test/page-test.ts checks
 * that none is missing, so a raw id such as «spoken-spelling» never shows; 1.5.2).
 */
export const RULE_LABELS: Record<string, string> = {
    "normalize-characters": "نویسه‌ها",
    "zwnj-cleanup": "نیم‌فاصله",
    "mi-prefix": "می-",
    "bi-prefix": "بی-",
    "plural-ha": "ها",
    "tar-tarin": "تر/ترین",
    "ezafe-he": "کسرۀ اضافه",
    "copula-attachment": "ام/است",
    lexicon: "فهرست‌های کتاب",
    "joined-words": "ترکیب‌ها",
    "compound-verbs": "فعل مرکب",
    numbers: "عدد",
    "verb-prefix-alef": "بـ/نـ پیش از ا",
    "hamza-tanvin": "همزه و تنوین",
    "arabic-prefixes": "سوء/ضد/غیر",
    dictionary: "فرهنگ املایی",
    "word-spacing": "فاصله‌گذاری",
    spelling: "غلط تایپی",
    punctuation: "نشانه‌گذاری",
    "over-broken": "شکستن بی‌جا",
    "may-break": "شکستن روا",
    "redundant-verbs": "فعل زائد",
    "arabic-plurals": "جمع عربی",
    prepositions: "حرف اضافه",
    calques: "ترجمه‌زدگی",
    redundancy: "حشو",
    "repeated-words": "تکرار",
    "long-sentences": "جملۀ بلند",
    invisible: "فاصله و نویسۀ نادیدنی",
    "spaced-compounds": "ترکیب‌ها",
    misspellings: "غلط رایج",
    "ra-placement": "جای «را»",
    "comma-before-va": "ویرگول پیش از «و»",
    "word-choice": "واژه‌گزینی",
    phrases: "تعبیر نادرست",
    "final-he": "«ه»ی پایانی",
    gozar: "گذار/گزار",
    "spoken-spelling": "املای شکسته",
    "spoken-word": "واژۀ محاوره‌ای",
    "typing-shortcuts": "نوشتار شتاب‌زده"
};

/*
 * A change that cannot be seen (1.5.2: «داره... ← داره…» looked the same twice): letters that look
 * alike, invisible characters, «...» and «…», «هٔ» and «ۀ», a space and a no-break space. Such a card
 * says the change in words: «سه نقطۀ جدا ← یک نویسۀ سه‌نقطه».
 */
const NAMES: Array<[string, string]> = [
    ["...", "سه نقطۀ جدا"], ["…", "یک نویسۀ سه‌نقطه"], ["..", "دو نقطه"],
    ["هٔ", "«ه» با همزۀ جدا (هٔ)"], ["ۀ", "یک نویسۀ «ۀ»"],
    ["ي", "«ی» عربی"], ["ى", "«ى» عربی"], ["ی", "«ی» فارسی"], ["ك", "«ک» عربی"], ["ک", "«ک» فارسی"],
    ["ہ", "«ه» اردو"], ["ە", "«ه» کردی"], ["ھ", "«ه» دوچشم"], ["ه", "«ه» فارسی"], ["ة", "«ة» عربی"], ["ۃ", "«ة» اردو"],
    ["٤", "«۴» عربی"], ["٥", "«۵» عربی"], ["٦", "«۶» عربی"], ["۴", "«۴» فارسی"], ["۵", "«۵» فارسی"], ["۶", "«۶» فارسی"],
    [" ", "فاصلۀ نشکن"], [" ", "فاصلۀ نشکن باریک"], [" ", "فاصلۀ باریک"], [" ", "فاصلۀ مویی"], [" ", "فاصلۀ پهن"], [" ", "فاصلۀ پهن"], ["　", "فاصلۀ پهن"],
    ["‌", "نیم‌فاصله"], ["​", "فاصلۀ صفر"], ["‍", "اتصال‌دهندۀ نادیدنی"], ["‎", "نشانۀ چپ‌به‌راست"], ["‏", "نشانۀ راست‌به‌چپ"],
    ["⁠", "پیوند نادیدنی"], ["﻿", "BOM نادیدنی"], ["­", "خط تیرۀ نرم"], ["ـ", "کشیده"],
    ["ً", "تنوین"], ["ٔ", "همزۀ بالا"], ["ئ", "«ئ»"], [" ", "فاصلۀ معمولی"], ["\t", "تب"], ["", "هیچ"]
];
const NON_JOINING = "اآأإدذرزژوؤۀة";
/** What the reader sees: look-alikes folded, invisible characters dropped (a ZWNJ only where it changes nothing). */
export function visible(s: string): string {
    return s
        .normalize("NFKC")
        .replace(/هٔ/g, "ۀ")
        .replace(/ۀ/g, "ۀ")
        .replace(/[يى]/g, "ی")
        .replace(/ك/g, "ک")
        .replace(/[ہەھ]/g, "ه")
        .replace(/ۃ/g, "ة")
        .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0x6f0 - 0x660))
        .replace(/…/g, "...")
        .replace(/[      　\t]/g, " ")
        .replace(/[​‍‎‏⁠﻿­ـ]/g, "")
        .replace(new RegExp(`(?<=[${NON_JOINING}])‌|^‌|‌$|‌(?=[\\s.،؛:!؟…])`, "g"), "");
}
const charName = (c: string) => {
    const hit = NAMES.find(([x]) => x === c)?.[1];
    if (hit) return hit;
    if (/[٠-٩]/.test(c)) return `رقم عربی «${String.fromCharCode(c.charCodeAt(0) + 0x90)}»`;
    if (/[۰-۹]/.test(c)) return `رقم فارسی «${c}»`;
    return `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
};
const nameOf = (s: string) => {
    const hit = NAMES.find(([c]) => c === s);
    if (hit) return hit[1];
    return [...s].map(charName).join(" و ");
};
/**
 * If `before` and `after` look the same, the change in words: the part that differs, named
 * («سه نقطۀ جدا ← یک نویسۀ سه‌نقطه»). null if the reader can see the change.
 */
export function explainChange(before: string, after: string): [string, string] | null {
    if (before === after || visible(before) !== visible(after)) return null;
    let a = 0;
    while (a < before.length && a < after.length && before[a] === after[a]) a++;
    let b = 0;
    while (b < before.length - a && b < after.length - a && before[before.length - 1 - b] === after[after.length - 1 - b]) b++;
    // «...» against «…»: the whole run of dots, not a dot
    let x = before.slice(a, before.length - b);
    let y = after.slice(a, after.length - b);
    if (/^\.+$/.test(x) || /^\.+$/.test(y)) {
        const run = (s: string, i: number) => s.slice(i).match(/^[.…]+/)?.[0] ?? "";
        while (a > 0 && /[.…]/.test(before[a - 1]) && before[a - 1] === after[a - 1]) a--;
        x = run(before, a);
        y = run(after, a);
    }
    return [nameOf(x), nameOf(y)];
}
