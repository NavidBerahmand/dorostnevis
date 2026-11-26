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
    /** Offsets relative to the start of the match. */
    start?: number;
    end?: number;
}

export interface PatternRuleSpec {
    /** Short Persian explanation of the rule, plus its source in دستور خط. */
    source: string;
    checks: PatternCheck[];
}

/**
 * Build a fixable textlint rule from a list of pattern checks.
 * Every message gets the rule's source appended so a writer can look it up.
 */
/**
 * `part` (an option of every pattern rule): "certain" reports only the checks marked
 * `certain`, "suggest" only the others; left out, both. The page runs a language-editing
 * rule twice, once for each part, so the two can be coloured and fixed apart.
 */
export type PatternPart = { part?: "certain" | "suggest" };

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
                        const message = `${result.message} (${result.source ?? spec.source})`;
                        const canFix = result.fix !== false && result.replacement !== undefined;
                        report(
                            node,
                            new RuleError(message, {
                                padding: locator.range([start, end]),
                                ...(canFix ? { fix: fixer.replaceTextRange([start, end], result.replacement!) } : {})
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
