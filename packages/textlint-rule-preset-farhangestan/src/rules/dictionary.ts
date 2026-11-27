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

const SOURCE = "فرهنگ املایی خطّ فارسی";

/**
 * Ordinary words (and names) that share their letters with a dictionary
 * compound: «آشکار» is not «آش‌کار», «بینا» is not «بی‌نا». Found by
 * listing every common word the dictionary would split (see README).
 */
const HOMOGRAPHS = new Set(["آشکار", "بینا", "بلبل", "سنگسر", "جهانگیر", "جهانبخش", "ایرانمهر", "شیء"]);
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
                // «کمکم»: also «کمک» + «م», a different word: never red
                const other = otherReading(word, target);
                if (other) return { message: homographMessage(word, target, other), replacement: target, alternatives: [word], fix: false, source };
                return { message: `املای مرجّح «${target}» است`, replacement: target, source };
            }
        }
    ]
}));
