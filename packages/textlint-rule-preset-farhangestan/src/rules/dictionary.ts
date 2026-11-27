/*
 * فرهنگ املایی خطّ فارسی (فرهنگستان، ۱۳۹۴)
 *
 * برای کلمه‌هایی که دستور خط قاعدۀ مشخصی برایشان ندارد، شکل مرجّح فرهنگ
 * املایی ملاک است. کلمه با «حروف یکسان» در فرهنگ پیدا می‌شود (نیم‌فاصله
 * نادیده گرفته می‌شود): «آبپاش»، «آب‌پاش»، «زبانشناسی»، «زبان‌شناسی».
 *
 * - اگر شکل متن یکی از شکل‌های مجاز فرهنگ باشد («/»، «،»، «ـ» در فرهنگ)،
 *   دست نمی‌خورد: «نبضگاه» و «نبض‌گاه» هر دو درست‌اند.
 * - در غیر این صورت به شکل مرجّح تبدیل می‌شود: «زبانشناسی» ← «زبان‌شناسی».
 * - جایی که فرهنگ با ویراست دوم دستور خط تعارض دارد («همدرد» در فرهنگ،
 *   «هم‌درد» طبق فهرست بستۀ «هم-» در ویراست دوم)، ویراست دوم ملاک است
 *   (src/dict/farhang-v2-overrides.json، ساخته‌شده با
 *   scripts/check-farhang-conflicts.cjs).
 * - دو مدخل با حروف یکسان و معنای متفاوت («آبرو»، «آب‌رو») فقط گزارش
 *   می‌شوند، بی اصلاح خودکار.
 */
import { otherReading, homographMessage } from "../util/homograph";
import { createPatternRule } from "../util/pattern-rule";
import { START, END, WORD, ZWNJ, NON_JOINING, toPersianDigits } from "../util/persian";
import { FARHANG, FARHANG_OVERRIDES, BOOK_JOINED } from "../util/words";
import { PRODUCTIVE_STEMS } from "./joined-words";
import { isKnown } from "../util/words";
import { corpusBucket } from "../util/speller";

/**
 * A common word with a pronoun or the spoken «را» run on («پسرو» = «پسر» + «و»، «چشمشو» = «چشم» + «ش» +
 * «و»، «گلوش» = «گلو» + «ش»), when the farhang's compound with the same letters («پس‌رو»، «چشم‌شو»، «گل‌وش»)
 * is the other reading: the ending, or null. 1.6.1: these were red.
 */
/** «کردن» next («کنید، کرد، می‌کنه، بکنین»). */
const LIGHT_VERB_NEXT = /^ +(?:ن?می‌?|ب|ن)?(?:کن|کرد)[\p{L}‌]*/u;
const SPOKEN_RA = ["شونو", "تونو", "مونو", "شو", "مو", "تو", "رو", "و"];
const PRONOUN = ["شان", "تان", "مان", "شون", "تون", "مون", "ش", "م", "ت"];
function cliticReading(word: string, target: string): { base: string; ending: string; spoken: boolean } | null {
    if (word.includes(ZWNJ)) return null;
    const first = target.split(/[‌ ]/)[0];
    for (const [endings, spoken] of [[SPOKEN_RA, true], [PRONOUN, false]] as Array<[string[], boolean]>) {
        for (const ending of endings) {
            if (!word.endsWith(ending)) continue;
            const base = word.slice(0, -ending.length);
            if (base.length < 2 || !isKnown(base) || (corpusBucket(base) ?? 0) < 8) continue;
            // the spoken «را» is «رو» after a vowel («اونارو»)، «و» after a consonant («پسرو»)
            if (ending === "رو" && !/[اویه]$/.test(base)) continue;
            if (ending === "و" && /[اوی]$/.test(base)) continue;
            // «چشمشو» = «چشم» + «ش» + «و» even though «چشم‌شو» starts with «چشم»; a bare pronoun needs another first part
            if (base === first && !(spoken && ending.length > 1 && ending !== "رو")) continue;
            return { base, ending, spoken };
        }
    }
    return null;
}

const SOURCE = "فرهنگ املایی خطّ فارسی";

/**
 * Ordinary words (and names) that share their letters with a dictionary
 * compound: «آشکار» is not «آش‌کار», «بینا» is not «بی‌نا», «خونده» (spoken «خوانده») is not
 * «خون‌ده», «نیکخواه» (a surname) is not «نیک‌خواه» (1.6.0). Found by
 * listing every common word the dictionary would split (see README).
 */
const HOMOGRAPHS = new Set(["آشکار", "بینا", "بلبل", "سنگسر", "جهانگیر", "جهانبخش", "ایرانمهر", "شیء", "خونده", "نیکخواه"]);
/** Joined «اینهمه/آنهمه»: «این‌همه» or «این همه» is a reading; word-spacing asks (one card, 1.5.2). */
const ASKED_ELSEWHERE = new Set(["اینهمه", "آنهمه"]);

/** ZWNJ after a non-joining letter changes nothing on screen: ignore it when comparing. */
const INVISIBLE_ZWNJ = new RegExp(`(?<=[${NON_JOINING}])${ZWNJ}|^${ZWNJ}+|${ZWNJ}+$`, "g");
const ZWNJ_RUN = new RegExp(`${ZWNJ}{2,}`, "g");
/** Doubled ZWNJs are zwnj-cleanup's job; invisible ones are ignored. */
function visibleForm(s: string): string {
    return s.replace(ZWNJ_RUN, ZWNJ).replace(INVISIBLE_ZWNJ, "");
}

export default createPatternRule(() => ({
    source: SOURCE,
    checks: [
        {
            pattern: new RegExp(`${START}${WORD}${END}`, "g"),
            check: (m) => {
                const word = m[0];
                if (BOOK_JOINED.has(word) || HOMOGRAPHS.has(word) || ASKED_ELSEWHERE.has(word)) return null;
                const key = word.replace(new RegExp(ZWNJ, "g"), "");
                const row = FARHANG[key];
                if (!row) return null;
                const [preferred, others, page] = row;
                const override = FARHANG_OVERRIDES[key];
                // the ezafe mark is always «ۀ» (since 1.4.0), also where the farhang prints «ۀ»
                const target = (override ?? preferred)?.replace(/هٔ/g, "ۀ") ?? null;
                const seen = visibleForm(word);
                if (target && seen === visibleForm(target)) return null;
                if (!override && [preferred ?? "", ...others].some((f) => visibleForm(f) === seen)) {
                    // the farhang accepts this form too, with one that has a ZWNJ: «زندگینامه» / «زندگی‌نامه».
                    // The book requires the ZWNJ when the second part is «-نامه/-خانه» (الف-۱، تبصرۀ ۵، ص ۶۰)
                    // or a present stem (ب-۲، ص ۶۲). Otherwise both stand (the farhang may list them as equals).
                    if (!preferred || !preferred.includes(ZWNJ) || word.includes(ZWNJ)) return null;
                    const last = preferred.split(ZWNJ).pop()!;
                    const suffixoid = /^(نامه|خانه)/.test(last);
                    if (!suffixoid && ![...PRODUCTIVE_STEMS, "ساز"].some((st) => last === st || last.startsWith(st))) return null;
                    return {
                        message: `این ترکیب با نیم‌فاصله نوشته می‌شود: «${preferred}»`,
                        replacement: preferred,
                        source: suffixoid ? "دستور خط، ترکیب‌ها، الف-۱، تبصرۀ ۵، ص ۶۰" : "دستور خط، ترکیب‌ها، ب-۲، ص ۶۲"
                    };
                }
                // «پسرو»، «چشمشو»: a word with the spoken «را» (or a pronoun) is far likelier than a rare compound;
                // and where the farhang itself prints these letters («گلوش») only the 2nd edition's rule differs
                const clitic = target ? cliticReading(word, target) : null;
                if (clitic && (clitic.spoken || (override && visibleForm(preferred ?? "") === seen))) return null;
                const source = override
                    ? `دستور خط (ویراست جدید)؛ فرهنگ املایی، ص ${toPersianDigits(page)}، «${preferred}» دارد`
                    : `${SOURCE}، ص ${toPersianDigits(page)}`;
                if (!target) {
                    return {
                        message: `این کلمه در فرهنگ به چند شکل و با معنای متفاوت آمده: «${others.join("»، «")}»`,
                        // one button per form the farhang gives, for the writer to choose by meaning
                        ...(() => {
                            const forms = others.filter((f) => visibleForm(f) !== seen).map((f) => f.replace(/هٔ/g, "ۀ"));
                            return forms.length ? { replacement: forms[0], alternatives: forms.slice(1) } : {};
                        })(),
                        fix: false,
                        source
                    };
                }
                // «فرمانده‌ی سپاه»: «فرمانده» + an ezafe written «ی» (the book: «فرماندهِ سپاه»), or «فرماندهی» (command).
                // Before another word both readings stand: a choice, never red (1.6.3; before, «فرماندهی» in red)
                const ye = word.match(new RegExp(`^(.+ه)${ZWNJ}ی$`));
                if (ye && target === key && isKnown(ye[1]) && /^ +[\p{L}]/u.test(m.input.slice(m.index + word.length))) {
                    return {
                        message: `اگر «${ye[1]}» در حالت اضافه است، کسره می‌گیرد: «${ye[1]}\u0650»؛ اگر یک کلمه است: «${target}»`,
                        replacement: ye[1] + "\u0650",
                        alternatives: [target],
                        fix: false,
                        source: "دستور خط، «کسرۀ اضافه»، ص ۴۷"
                    };
                }
                // «کمکم»: also «کمک» + «م», a different word: never red
                const other = otherReading(word, target);
                // «کمکم کنید»، «کمکم کرد»: the noun with its pronoun before a light verb, not «کم‌کم» (1.6.1)
                if (other && LIGHT_VERB_NEXT.test(m.input.slice(m.index + word.length))) return null;
                if (other) return { message: homographMessage(word, target, other), replacement: target, alternatives: [word], fix: false, source };
                return { message: `املای مرجّح «${target}» است`, replacement: target, source };
            }
        }
    ]
}));
