/**
 * Character classes for Persian text.
 *
 * All values are regular-expression *fragments* (strings) so they can be
 * composed into larger patterns.
 */

export const ZWNJ = "‌";
export const ZWJ = "‍";

/** Arabic-script letters used in Persian (and Arabic loanwords). */
export const LETTER_RANGE = "\\u0621-\\u063A\\u0641-\\u064A\\u0671-\\u06D3\\u06D5\\u06EE\\u06EF\\u06FA-\\u06FF";
/** Harakat, tanvin, shadda, sukun, superscript alef, hamza above/below. */
export const MARK_RANGE = "\\u064B-\\u065F\\u0670";

export const LETTER = `[${LETTER_RANGE}]`;
export const MARK = `[${MARK_RANGE}]`;
/** Anything that can be part of a Persian word, including ZWNJ. */
export const WORD_CHAR = `[${LETTER_RANGE}${MARK_RANGE}${ZWNJ}]`;
/** A whole Persian word (one or more word characters). */
export const WORD = `${WORD_CHAR}+`;

/** Lookbehind / lookahead that act as word boundaries for Persian. */
export const START = `(?<!${WORD_CHAR})`;
export const END = `(?!${WORD_CHAR})`;

/**
 * Letters that never join to the following letter (حروف منفصل).
 * دستور خط، ویژگی‌های خط فارسی، بند ه: ا، د، ذ، ر، ز، ژ، و
 * plus their variants and hamza forms.
 */
export const NON_JOINING = "اآأإٱدذرزژوؤۀةء";

/** True when `ch` does not join to the next letter. */
export function isNonJoining(ch: string): boolean {
    return NON_JOINING.includes(ch);
}

/** Remove harakat and other combining marks (for dictionary lookups). */
export function stripMarks(s: string): string {
    return s.replace(new RegExp(MARK, "g"), "");
}

/**
 * Join a prefix and the rest of a word the way دستور خط prescribes for
 * "نیم‌فاصله/بی‌فاصله": a ZWNJ after a joining letter, nothing after a
 * non-joining one.
 */
export function joinWithHalfSpace(left: string, right: string): string {
    const last = left[left.length - 1];
    return isNonJoining(last) ? left + right : left + ZWNJ + right;
}

/** Escape a literal string for use inside a RegExp. */
export function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** «96» → «۹۶» */
export function toPersianDigits(n: number | string): string {
    return String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x06f0 + Number(d)));
}
