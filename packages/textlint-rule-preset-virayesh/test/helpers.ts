/** Shorthand for an invalid case: input, expected output after fixing, number of errors. */
export function inv(text: string, output: string, count = 1) {
    return { text, output, errors: Array.from({ length: count }, () => ({})) };
}
/** Human-readable ZWNJ in test sources: write «‹» instead of an invisible character. */
export function z(s: string): string {
    return s.replace(/‹/g, "‌");
}
