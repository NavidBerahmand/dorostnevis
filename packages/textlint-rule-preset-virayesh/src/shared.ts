/**
 * Shared pieces of the language-editing rules. These are editorial advice, not
 * rules of دستور خط: every report is a suggestion for the writer to judge.
 */
export { createPatternRule } from "../../textlint-rule-preset-farhangestan/src/util/pattern-rule";
export type { PatternResult } from "../../textlint-rule-preset-farhangestan/src/util/pattern-rule";
export { START, END, LETTER, ZWNJ, WORD } from "../../textlint-rule-preset-farhangestan/src/util/persian";

export const SOURCE = (topic: string) => `ویرایش زبانی، ${topic}؛ توصیۀ رایج ویراستاران، در دستور خط نیامده`;

/** «می‌گیرد»، «می گیرد»، «میگیرد» all match; spaces and ZWNJs inside a key are optional. */
export function flex(s: string): string {
    return s.replace(/[‌ ]/g, "[‌ ]?");
}
/** The lookup key of a matched form: no spaces or ZWNJs. */
export const squash = (s: string) => s.replace(/[‌ ]/g, "");

/** Alternation of the keys of a map, longest first, each with flexible spacing. */
export function alternation(keys: Iterable<string>): string {
    return [...keys].sort((a, b) => b.length - a.length).map(flex).join("|");
}
