/*
 * جاهایی که شکستن روا (و توصیه‌شده) است
 *
 * اصول شکسته‌نویسی، فصل ۲ «چه واژه‌هایی را باید شکست؟»: کلماتی که در گفتار
 * یک هجا کوتاه می‌شوند را می‌توان شکسته نوشت. این‌ها فقط پیشنهادند و اصلاح
 * خودکار ندارند: شکستن انتخاب نویسنده است، نه الزام.
 *
 * - «می‌روم، می‌گویم، می‌شوم، می‌توانم، می‌آورم» ← «می‌رم، می‌گم، می‌شم، می‌تونم، می‌آرم» (ص ۱۷–۱۸)
 * - «بیایم، بینداز» ← «بیام، بنداز» (ص ۱۷)
 * - «صدایم، پتویم» ← «صدام، پتوم» (ص ۲۰)
 * - «سرد است» ← «سرده» (ص ۲۳)؛ نه پس از «ه» و «ا» («خانه است»، «بالاست»؛ ص ۲۴)
 * - «چگونه، زیرا، می‌باید، چیست، اوست» ← «چطوری، چون، باید، چیه، اونه» (ص ۲۷–۲۹)
 */
import { createPatternRule } from "../../../textlint-rule-preset-farhangestan/src/util/pattern-rule";
import { START, END, LETTER, ZWNJ } from "../../../textlint-rule-preset-farhangestan/src/util/persian";
import { KNOWN } from "../../../textlint-rule-preset-farhangestan/src/util/words";

const BOOK = "اصول شکسته‌نویسی";
const Z = ZWNJ;

/** [formal, spoken, page] */
const PAIRS: Array<[string, string, string]> = [];
function conj(formalStem: string, spokenStem: string, formalEnds: string[], spokenEnds: string[], page: string) {
    for (const neg of ["", "ن"]) {
        formalEnds.forEach((e, i) => {
            PAIRS.push([`${neg}می${Z}${formalStem}${e}`, `${neg}می${Z}${spokenStem}${spokenEnds[i]}`, page]);
        });
    }
}
const P = ["م", "ی", "د", "یم", "ید", "ند"];
conj("رو", "ر", P, ["م", "ی", "ه", "یم", "ید", "ند"], "۱۷");
conj("گوی", "گ", P, ["م", "ی", "ه", "یم", "ید", "ند"], "۱۷");
conj("شو", "ش", P, ["م", "ی", "ه", "یم", "ید", "ند"], "۱۷");
conj("توان", "تون", P, ["م", "ی", "ه", "یم", "ید", "ند"], "۱۸");
conj("آور", "آر", P, ["م", "ی", "ه", "یم", "ید", "ند"], "۱۸");
conj("آی", "آ", ["م", "ی", "د"], ["م", "ی", "د"], "۱۷");
for (const [f, s] of [["توانستم", "تونستم"], ["توانستی", "تونستی"], ["توانست", "تونست"], ["توانستیم", "تونستیم"], ["توانستید", "تونستید"], ["توانستند", "تونستند"]]) {
    PAIRS.push([f, s, "۱۸"]);
}
PAIRS.push(["بیایم", "بیام", "۱۷"], ["بینداز", "بنداز", "۱۷"], ["چگونه", "چطوری", "۲۷"], ["زیرا", "چون", "۲۷"],
    ["می" + Z + "باید", "باید", "۲۸"], ["چیست", "چیه", "۲۹"], ["اوست", "اونه", "۲۸"], ["مرا", "من را", "۲۷"],
    ["از من", "ازم", "۲۶"], ["از تو", "ازت", "۲۶"], ["از او", "ازش", "۲۶"],
    ["به من", "به" + Z + "ام", "۲۱"], ["به تو", "به" + Z + "ات", "۲۱"], ["به او", "به" + Z + "اش", "۲۱"], ["به ایشان", "به" + Z + "شون", "۲۲"],
    ["کی است", "کیه", "۲۹"], ["چی است", "چیه", "۲۹"]);
const MAP = new Map(PAIRS.map(([f, s, p]) => [f, { spoken: s, page: p }]));

export default createPatternRule(() => ({
    source: BOOK,
    checks: [
        {
            pattern: new RegExp(`${START}(${[...MAP.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/ /g, " +")).join("|")})${END}`, "g"),
            check: (m) => {
                const e = MAP.get(m[0].replace(/ +/g, " "))!;
                return {
                    message: `در گفت‌وگو می‌توان شکسته نوشت (یک هجا کم می‌شود): «${e.spoken}»`,
                    replacement: e.spoken,
                    fix: false,
                    source: `${BOOK}، ص ${e.page}`
                };
            }
        },
        {
            // «صدایم، پتویم» → «صدام، پتوم»
            pattern: new RegExp(`${START}(${LETTER}+[اوآ])یم${END}`, "g"),
            check: (m) => {
                if (!KNOWN.has(m[1])) return null;
                return {
                    message: `در گفت‌وگو: «${m[1]}م»`,
                    replacement: `${m[1]}م`,
                    fix: false,
                    source: `${BOOK}، ص ۲۰`
                };
            }
        },
        {
            // Arabic plurals in «-ین»: «مهندسین» → «مهندس‌ها» (ص ۲۳: در گفت‌وگو «ها»، نه «ان/ین»)
            pattern: new RegExp(`${START}(م${LETTER}{3,})ین${END}`, "g"),
            check: (m) => {
                if (!KNOWN.has(m[1])) return null;
                return {
                    message: `در گفت‌وگو نشانۀ جمع «ها» به کار می‌رود: «${m[1]}${"اآدذرزژو".includes(m[1].slice(-1)) ? "" : Z}ها»`,
                    replacement: `${m[1]}${"اآدذرزژو".includes(m[1].slice(-1)) ? "" : Z}ها`,
                    fix: false,
                    source: `${BOOK}، ص ۲۳`
                };
            }
        },
        {
            // «چه می‌خوای؟» → «چی می‌خوای؟» (ص ۲۷)
            pattern: new RegExp(`${START}چه(?= +ن?می${Z})`, "g"),
            check: () => ({ message: "در گفت‌وگو «چه» بیشتر «چی» گفته می‌شود: «چی»", replacement: "چی", fix: false, source: `${BOOK}، ص ۲۷` })
        },
        {
            // «سرد است» → «سرده»؛ not after ه/ا (ص ۲۴) or و
            pattern: new RegExp(`${START}(${LETTER}+) +است${END}`, "g"),
            check: (m) => {
                const last = m[1][m[1].length - 1];
                if ("هاآو".includes(last) || m[1] === "کی" || m[1] === "چی") return null; // «کیه، چیه»: listed above
                return {
                    message: `در گفت‌وگو «است» را می‌توان شکسته نوشت: «${m[1]}ه»`,
                    replacement: `${m[1]}ه`,
                    fix: false,
                    source: `${BOOK}، ص ۲۳`
                };
            }
        }
    ]
}));
