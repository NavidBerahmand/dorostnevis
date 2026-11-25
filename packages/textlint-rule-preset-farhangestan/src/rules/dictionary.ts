/*
 * فرهنگ املایی خطّ فارسی (فرهنگستان، ۱۳۹۴)
 *
 * برای کلمه‌هایی که دستور خط قاعدهٔ مشخصی برایشان ندارد، شکل مرجّح فرهنگ
 * املایی ملاک است. کلمه با «حروف یکسان» در فرهنگ پیدا می‌شود (نیم‌فاصله
 * نادیده گرفته می‌شود): «آبپاش»، «آب‌پاش»، «زبانشناسی»، «زبان‌شناسی».
 *
 * - اگر شکل متن یکی از شکل‌های مجاز فرهنگ باشد («/»، «،»، «ـ» در فرهنگ)،
 *   دست نمی‌خورد: «نبضگاه» و «نبض‌گاه» هر دو درست‌اند.
 * - در غیر این صورت به شکل مرجّح تبدیل می‌شود: «زبانشناسی» ← «زبان‌شناسی».
 * - جایی که فرهنگ با ویراست دوم دستور خط تعارض دارد («همدرد» در فرهنگ،
 *   «هم‌درد» طبق فهرست بستهٔ «هم-» در ویراست دوم)، ویراست دوم ملاک است
 *   (src/dict/farhang-v2-overrides.json، ساخته‌شده با
 *   scripts/check-farhang-conflicts.cjs).
 * - دو مدخل با حروف یکسان و معنای متفاوت («آبرو»، «آب‌رو») فقط گزارش
 *   می‌شوند، بی اصلاح خودکار.
 */
import { createPatternRule } from "../util/pattern-rule";
import { START, END, WORD, ZWNJ, NON_JOINING } from "../util/persian";
import { FARHANG, FARHANG_OVERRIDES, BOOK_JOINED } from "../util/words";

const SOURCE = "فرهنگ املایی خطّ فارسی";

/**
 * Ordinary words (and names) that share their letters with a dictionary
 * compound: «آشکار» is not «آش‌کار», «بینا» is not «بی‌نا». Found by
 * listing every common word the dictionary would split (see README).
 */
const HOMOGRAPHS = new Set(["آشکار", "بینا", "بلبل", "سنگسر", "جهانگیر", "جهانبخش", "ایرانمهر", "شیء"]);

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
                if (BOOK_JOINED.has(word) || HOMOGRAPHS.has(word)) return null;
                const key = word.replace(new RegExp(ZWNJ, "g"), "");
                const row = FARHANG[key];
                if (!row) return null;
                const [preferred, others, page] = row;
                const override = FARHANG_OVERRIDES[key];
                const target = override ?? preferred;
                const seen = visibleForm(word);
                if (target && seen === visibleForm(target)) return null;
                if (!override && [preferred ?? "", ...others].some((f) => visibleForm(f) === seen)) return null;
                const source = override
                    ? `دستور خط (ویراست دوم)؛ فرهنگ املایی، ص ${page}، «${preferred}» دارد`
                    : `${SOURCE}، ص ${page}`;
                if (!target) {
                    return {
                        message: `این کلمه در فرهنگ به چند شکل و با معنای متفاوت آمده: «${others.join("»، «")}»`,
                        fix: false,
                        source
                    };
                }
                return { message: `املای مرجّح «${target}» است`, replacement: target, source };
            }
        }
    ]
}));
