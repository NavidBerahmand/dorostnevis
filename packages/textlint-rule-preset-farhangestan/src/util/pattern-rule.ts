import type { TextlintRuleContext, TextlintFixableRuleModule, TextlintRuleReportHandler } from "@textlint/types";

/**
 * One check inside a rule: a global RegExp and a function that decides
 * what (if anything) to report for each match.
 */
export interface PatternCheck {
    pattern: RegExp;
    /**
     * Return null to ignore the match. Otherwise return the replacement for
     * the matched range (or `fix: false` to report without an automatic fix).
     * `start`/`end` default to the whole match; set them to narrow the range.
     */
    check: (match: RegExpExecArray) => PatternResult | null;
}

export interface PatternResult {
    message: string;
    replacement?: string;
    fix?: boolean;
    /** Overrides the rule's source for this report (e.g. a dictionary entry's page). */
    source?: string;
    /**
     * A certain error, not a matter of taste (for the language-editing rules, which are
     * otherwise suggestions): the page marks it red and «اعمال همه» fixes it. Needs a fix.
     */
    certain?: boolean;
    /**
     * Other replacements that fit as well as `replacement` («گاهاً» → «گاهی»، «گاه»، «احیاناً»):
     * reported, as suggestions, only with the option `suggestions`.
     */
    alternatives?: string[];
    /**
     * How sure (since 1.4.0): "error" (the default with a fix: red), "maybe" (a reading to judge:
     * yellow), "suggestion" (not an error, a recommendation: blue, «پیشنهاد»). Only "suggestion"
     * is marked in the message (KIND_SUGGESTION), so the page can tell it from a «maybe».
     */
    kind?: "error" | "maybe" | "suggestion";
    /** Offsets relative to the start of the match. */
    start?: number;
    end?: number;
    /**
     * Where the replacement goes, if not over the report (offsets relative to the match): an
     * unclosed «« is reported on itself and closed at the end of its sentence.
     */
    fixStart?: number;
    fixEnd?: number;
}

export interface PatternRuleSpec {
    /** Short Persian explanation of the rule, plus its source in دستور خط. */
    source: string;
    checks: PatternCheck[];
    /** false: replacements keep Arabic «ي/ك» (normalize-characters, which decides about them). */
    persianLetters?: boolean;
}
/** «ي، ك» → «ی، ک». */
const toPersianLetters = (s: string) => s.replace(/ي/g, "ی").replace(/ك/g, "ک");

/**
 * Build a fixable textlint rule from a list of pattern checks.
 * Every message gets the rule's source appended so a writer can look it up.
 */
/**
 * `part` (an option of every pattern rule): "certain" reports only the checks marked
 * `certain`, "suggest" only the others; left out, both. The page runs a language-editing
 * rule twice, once for each part, so the two can be coloured and fixed apart.
 */
export type PatternPart = { part?: "certain" | "suggest"; suggestions?: boolean };

/**
 * With the option `suggestions` (the page), a report the writer must judge (`fix: false`, or
 * any with `alternatives`) still carries its replacement as a fix, once per alternative, and
 * its message starts with this mark (U+2063, invisible): the page shows it yellow, with a
 * button for each replacement, and never makes it in «درست‌کن». Without the option (the
 * command line, the tests) such reports have no fix, as before.
 */
export const SUGGESTION = "\u2063";
export const isSuggestion = (message: string) => /^\u2064?\u2063/.test(message);
/** U+2064 (invisible): the report is a recommendation, not an error («پیشنهاد», blue on the page). */
export const KIND_SUGGESTION = "\u2064";

export function createPatternRule<T extends object = object>(
    buildSpec: (options: T) => PatternRuleSpec
): TextlintFixableRuleModule<T & PatternPart> {
    const reporter = (context: Readonly<TextlintRuleContext>, options?: T & PatternPart): TextlintRuleReportHandler => {
        const { Syntax, RuleError, report, getSource, fixer, locator } = context;
        const spec = buildSpec((options ?? {}) as T);
        const part = options?.part;
        return {
            [Syntax.Str](node) {
                const text = getSource(node);
                for (const { pattern, check } of spec.checks) {
                    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
                    let m: RegExpExecArray | null;
                    while ((m = re.exec(text)) !== null) {
                        if (m[0].length === 0) {
                            re.lastIndex++;
                            continue;
                        }
                        const result = check(m);
                        if (!result) continue;
                        if (part && (part === "certain") !== !!result.certain) continue;
                        const start = m.index + (result.start ?? 0);
                        const end = m.index + (result.end ?? m[0].length);
                        const fs = result.fixStart === undefined ? start : m.index + result.fixStart;
                        const fe = result.fixEnd === undefined ? end : m.index + result.fixEnd;
                        const kindMark = options?.suggestions && result.kind === "suggestion" ? KIND_SUGGESTION : "";
                        const message = `${result.message} (${result.source ?? spec.source})`;
                        const canFix = result.fix !== false && result.replacement !== undefined;
                        // a replacement is written in Persian letters (1.6.0): «میتونيم» → «می‌تونیم», not «می‌تونيم» (the
                // Arabic «ي» would bring normalize-characters back on the same word)
                if (spec.persianLetters !== false) {
                    if (result.replacement !== undefined) result.replacement = toPersianLetters(result.replacement);
                    if (result.alternatives) result.alternatives = result.alternatives.map(toPersianLetters);
                }
                const choices = [result.replacement, ...(result.alternatives ?? [])].filter((x, i, a): x is string => x !== undefined && a.indexOf(x) === i);
                        if (options?.suggestions && choices.length && (!canFix || choices.length > 1)) {
                            // a certain fix keeps its own report (red, «درست‌کن» makes it); the other
                            // replacements come as suggestions beside it, one mark more each
                            // (textlint drops a second report with the same message and range)
                            for (const [i, text] of choices.entries()) {
                                const mark = canFix ? SUGGESTION.repeat(i) : SUGGESTION.repeat(i + 1);
                                report(node, new RuleError(kindMark + mark + message, { padding: locator.range([start, end]), fix: fixer.replaceTextRange([fs, fe], text) }));
                            }
                            continue;
                        }
                        report(
                            node,
                            new RuleError(kindMark + message, {
                                padding: locator.range([start, end]),
                                ...(canFix ? { fix: fixer.replaceTextRange([fs, fe], result.replacement!) } : {})
                            })
                        );
                    }
                }
            }
        };
    };
    return { linter: reporter, fixer: reporter };
}

/** Show invisible characters in messages so the writer can see the change. */
export function visible(s: string): string {
    return s.replace(/‌/g, "[نیم‌فاصله]").replace(/‏/g, "[RLM]").replace(/‎/g, "[LRM]");
}
