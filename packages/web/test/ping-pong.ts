/**
 * The «no ping-pong» checker: no rule may take back what another rule (or itself) just fixed.
 *
 * For a text, in a mode (formal or «گفت‌وگو»), as the page runs the rules:
 * - every single fix is made and the text linted again: a new message on the changed
 *   letters must not give the old text back, bring the fixing rule back over a further step,
 *   object from a rule of higher precedence, or object without a fix (lint-setup.ts, conflictsOf);
 * - «درست‌کن» (the certain fixes only, as the page makes them) is run to its end: it must stop (no cycle, at most four
 *   rounds), and no red mark may be left on the letters it changed;
 * - the automatic typing fixes are made as the page makes them (five rounds): none may be
 *   left over, and no fix the page offers on their letters may be taken back by them.
 * Used by test/no-ping-pong-test.ts; the same logic ran over ~15,000 texts for 1.3.1.
 */
import { TextlintKernel } from "@textlint/kernel";
import { Msg, Settings, lintOptions, conflictsOf, isAuto, isCertainMsg, isTentative, applyCertain, editsOf, touches, applyFix, splitMessage, rank } from "../src/lint-setup";

const kernel = new TextlintKernel();
const vis = (s: string) => s.replace(/‌/g, "‹").replace(/\n/g, "⏎");
const desc = (m: Msg, t: string) =>
    `${m.ruleId}: «${vis(t.slice(m.range[0], m.range[1]))}»${m.fix ? `→«${vis(m.fix.text)}»` : ""} ${splitMessage(m).text} [${rank(m)}]`;

function pickAuto(msgs: Msg[], text: string): Msg[] {
    const c = msgs.filter((m) => isAuto(m, text)).sort((x, y) => x.fix!.range[0] - y.fix!.range[0] || x.fix!.range[1] - y.fix!.range[1]);
    const out: Msg[] = [];
    let ls = -1;
    let le = -1;
    for (const m of c) {
        const [s, e] = m.fix!.range;
        if (s < le || s === ls) continue;
        out.push(m);
        ls = s;
        le = e;
    }
    return out.reverse();
}
/** The letters put in by the change a → b, as [start, end) in b. */
function spansOf(a: string, b: string): Array<[number, number]> {
    const spans: Array<[number, number]> = [];
    let d = 0;
    for (const e of editsOf(a, [0, a.length], b)) {
        spans.push([e.pos + d, e.pos + d + e.inserted.length]);
        d += e.inserted.length - e.removed.length;
    }
    return spans;
}

export async function pingPong(text: string, settings: Settings): Promise<string[]> {
    const problems: string[] = [];
    const full = lintOptions(settings);
    const auto = lintOptions(settings, false, true);
    const cache = new Map<string, Msg[]>();
    const lint = async (t: string) => {
        let r = cache.get(t);
        if (!r) cache.set(t, (r = (await kernel.lintText(t, full)).messages as unknown as Msg[]));
        return r;
    };
    const alint = async (t: string) => (await kernel.lintText(t, auto)).messages as unknown as Msg[];
    const say = (what: string) => problems.push(`[${settings.mode}] ${what}\n      in «${vis(text)}»`);

    // each fix on its own
    const msgs = await lint(text);
    for (const m of msgs) {
        if (!m.fix) continue;
        const fixed = applyFix(text, m.fix);
        for (const c of await conflictsOf(lint, text, m, msgs)) {
            // a yellow/blue suggestion a rule objects to is left out by the page's guard: not a conflict
            if (c.kind === "changes" || (isTentative(m) && c.kind !== "restores")) continue;
            say(`${c.kind}: ${desc(m, text)}  ⇒  ${desc(c.by, fixed)}`);
        }
    }

    // «درست‌کن», to its end
    let cur = text;
    const seen = [text];
    let rounds = 0;
    for (; rounds < 8; rounds++) {
        const next = applyCertain(cur, await lint(cur));
        if (next === cur) break;
        if (seen.includes(next)) {
            say(`apply-all cycles: «${vis(next)}»`);
            break;
        }
        seen.push(next);
        cur = next;
    }
    if (rounds > 4) say(`apply-all takes ${rounds} rounds: «${vis(cur)}»`);
    if (cur !== text) {
        const spans = spansOf(text, cur);
        for (const d of await lint(cur)) {
            if (!isCertainMsg(d) || d.ruleId === "spelling") continue; // red marks only
            if (editsOf(cur, d.fix!.range, d.fix!.text).some((e2) => spans.some(([s, e]) => touches(e2, s, e)))) {
                say(`apply-all leaves a red mark on its own fix: «${vis(cur)}»  ⇒  ${desc(d, cur)}`);
            }
        }
    }

    // the automatic typing fixes
    let at = text;
    let am = await alint(at);
    for (let round = 0; round < 5; round++) {
        const fx = pickAuto(am, at);
        if (!fx.length) break;
        for (const m of fx) at = applyFix(at, m.fix!);
        am = await alint(at);
    }
    const left = pickAuto(am, at);
    if (left.length) say(`automatic fixes do not settle: «${vis(at)}»  ⇒  ${desc(left[0], at)}`);
    if (at !== text) {
        const spans = spansOf(text, at);
        for (const d of await lint(at)) {
            if (!d.fix || isAuto(d, at)) continue;
            if (!editsOf(at, d.fix.range, d.fix.text).some((e2) => spans.some(([s, e]) => touches(e2, s, e)))) continue;
            const t3 = applyFix(at, d.fix);
            const back = pickAuto(await alint(t3), t3).filter((x) => x.range[0] <= d.range[1] + 2 && x.range[1] >= d.range[0] - 2);
            if (back.length) say(`an automatic fix takes back ${desc(d, at)}  ⇒  ${desc(back[0], t3)}`);
        }
    }
    return problems;
}
