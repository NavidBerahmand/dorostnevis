/*
 * «رو»، «اون»، «اونو» (since 1.6.2, the owner's decision): a recommendation (blue) in every sentence,
 * spoken or written, with the written forms as buttons and «نادیده»:
 * - «رو» ← «را» or «روی»: «روی» first before a noun where «رو» is a place («نشست رو صندلی»، «رو میز»),
 *   «را» first after an object («کتاب رو بده»)
 * - «اونو» ← «آن را» (or «او را»)
 * - «اون» ← «آن» (or «او»)
 * Not the idioms that keep «رو» in written Persian: «از این رو»، «رو به»، «رو در رو»، «زیر و رو».
 * With «کل متن محاوره‌ای است» (lint-setup.ts, `colloquialText`) none of these is shown.
 */
import { createPatternRule } from "../../../textlint-rule-preset-farhangestan/src/util/pattern-rule";
import { START, END } from "../../../textlint-rule-preset-farhangestan/src/util/persian";
import { verbForm, isParticiple } from "../../../textlint-rule-preset-farhangestan/src/rules/mi-prefix";
import commonNouns from "../../../textlint-rule-preset-farhangestan/src/dict/hazm-common-nouns.json";

const COMMON_NOUNS = new Set<string>(commonNouns.words);
const BOOK = "اصول شکسته‌نویسی";

const wordAfter = (s: string, i: number) => s.slice(i).match(/^[ \u00a0]+([\p{L}\p{M}\u200c]+)/u)?.[1] ?? "";
const wordsBefore = (s: string, i: number, n: number) => {
    const out: string[] = [];
    let rest = s.slice(Math.max(0, i - 60), i);
    for (let k = 0; k < n; k++) {
        const m = rest.match(/([\p{L}\p{M}\u200c]+)[ \u00a0]+$/u);
        if (!m) break;
        out.push(m[1]);
        rest = rest.slice(0, rest.length - m[0].length);
    }
    return out;
};
/** A pronoun or a demonstrative before «رو»: the object («ما رو»، «اون رو»), never «روی». */
const PRONOUN = /^(من|تو|او|ما|شما|اون|این|اونا|اینا|آن|آنها|آن‌ها|ایشون|خودم|خودت|خودش|خودمون|خودتون|خودشون|همه|همشون|همه‌شون|همه‌رو|اینو|اونو|چی|کی|کیو)$/;
/** Words after which «رو» before a noun is a place: «و رو میز»، «نشست رو صندلی». */
const PLACE_AFTER = /^(و|از|به|تو|که|برو|بذار|بذارش|بشین|نشست|افتاد|گذاشت|گذاشتم|بود|هست|نشستم|خوابید|خوابیدم|ایستاد|وایساد|بپر|پرید)$/;

export default createPatternRule(() => ({
    source: BOOK,
    checks: [
        {
            pattern: new RegExp(`${START}(رو|اونو|اون)${END}`, "g"),
            check: (m) => {
                const w = m[1];
                const s = m.input;
                const next = wordAfter(s, m.index + w.length);
                const [prev = "", prev2 = ""] = wordsBefore(s, m.index, 2);
                // «اون‌ها»، «رو‌به‌رو»: another word, written with a half-space
                if (s[m.index + w.length] === "\u200c" || s[m.index - 1] === "\u200c") return null;
                // «رو» as a term in guillemets or brackets («جوان» + «رو»)
                if (/[«(]$/.test(s.slice(0, m.index)) || /^[»)]/.test(s.slice(m.index + w.length))) return null;
                if (w === "رو") {
                    // written idioms: «از این رو»، «ازین رو»، «رو به»، «رو در رو»، «زیر و رو»، «پشت و رو»
                    if (/^(به|در|بر)$/.test(next) || /^به‌/.test(next)) return null;
                    // «رو آوردن» (turn to), «به … رو کرد»: written verbs with «رو»
                    const turnTo = /^(ن?می‌)?(آورد|آور)/.test(next) || /^(بیاور|نیاور|کرد|کردند|کرده|نمود|نمودند)/.test(next);
                    if (turnTo && /(^|\s)به\s/.test(s.slice(Math.max(0, m.index - 40), m.index))) return null;
                    // «-رو» (goer, way): «پیش رو»، «کوچ رو»، «کالسکه رو»، «دور رو»، «پیاده رو»، «روبه رو»
                    if (/^(پیش|پیشِ|روبه|کوچ|کالسکه|دور|پیاده|تند|کند|میانه|دنباله|کج|کلیسا|خود|پس|راه)$/.test(prev) && !(prev === "راه" && /^(بلد|بده|ببین|پیدا|نشون|گم|برو|برید|رفتم|رفت)/.test(next))) return null;
                    const p1 = prev.replace(/\u200c/g, "");
                    if (/^(ازین|ازاین|ازآن)$/.test(p1) || (/^(این|آن|همین|همان|هر|چه)$/.test(p1) && /^(از|به)$/.test(prev2))) return null;
                    if (prev === "و" && /^(زیر|پشت|سو|جلو)$/.test(prev2)) return null;
                    if (/^(در|به|تا)$/.test(prev) && prev2 === "رو") return null; // «رو در رو»، «رو به رو»
                    // «رو و زیر»: a side; after «را» it is «رو کرد» (showed)
                    if (next === "و" || prev === "را") return null;
                    // before a noun, where «رو» reads as a place, «روی» first (1.6.0)
                    let roy = false;
                    if (next && COMMON_NOUNS.has(next) && !verbForm(next) && !isParticiple(next) && !PRONOUN.test(prev)) {
                        roy = !prev || /[.!؟?؛:]\s*$/.test(s.slice(0, m.index)) || PLACE_AFTER.test(prev) || !!verbForm(prev);
                    }
                    const [first, second] = roy ? ["روی", "را"] : ["را", "روی"];
                    return {
                        message: "در نوشتار: اگر نشانۀ مفعول است «را»، اگر به معنای «بر» است «روی»",
                        replacement: first,
                        alternatives: [second],
                        fix: false,
                        kind: "suggestion",
                        source: `${BOOK}، ص ۲۵`
                    };
                }
                // «اون» before a name in Latin or a foreign name is left alone («اون ویلسون»)
                if (/^[  ]*[A-Za-z]/.test(s.slice(m.index + w.length))) return null;
                const [first, second] = w === "اونو" ? ["آن را", "او را"] : ["آن", "او"];
                return {
                    message: `در نوشتار: «${first}»، یا اگر به کسی اشاره دارد «${second}»`,
                    replacement: first,
                    alternatives: [second],
                    fix: false,
                    kind: "suggestion",
                    source: `${BOOK}، ص ۲۹`
                };
            }
        }
    ]
}));
