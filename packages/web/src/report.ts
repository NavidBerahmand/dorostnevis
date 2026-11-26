/**
 * «این پیشنهاد غلط است»: a reader reports a wrong suggestion.
 *
 * Nothing is sent without the reader seeing exactly what goes, in a dialog,
 * and pressing «فرستادن». Inside claude.ai the report is saved with the
 * artifact's `db` capability under `reports/<viewer id>/items/<id>`: the
 * reader can write only their own subtree and only the owner (and editors)
 * can read them all. On the site's own host (vajban.com, Cloudflare Pages) it
 * is posted to /api/report, which keeps it in a D1 database. Elsewhere (a
 * file opened locally, a viewer who may not write), the same report is copied
 * to the clipboard instead.
 */

export type Report = {
    rule: string;
    ruleLabel: string;
    message: string;
    source: string;
    original: string;
    suggestion: string;
    context: string;
    comment: string;
    mode: string;
    at: string;
};

type Store = { db: any; uid: string } | { server: true } | null;

const claude = (window as unknown as { claude?: { use?: (name: string) => Promise<any> } }).claude;
let storePromise: Promise<Store> | null = null;

/** The db and this viewer's id, or null where reports cannot be saved. */
function store(): Promise<Store> {
    if (!storePromise) {
        storePromise = (async () => {
            // the site's own host: the Pages Function at /api/report
            if (!claude?.use) return /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname) ? { server: true } : null;
            try {
                const [db, user] = await Promise.all([claude.use("db"), claude.use("user")]);
                if (!db || !user) return null;
                const uid: string | null = await user.id();
                return uid ? { db, uid } : null;
            } catch {
                return null;
            }
        })();
    }
    return storePromise;
}

/** The sentence around [start, end), at most ~240 characters. */
export function sentenceAround(text: string, start: number, end: number): string {
    const STOP = /[.!؟?\n]/;
    let s = start;
    while (s > 0 && !STOP.test(text[s - 1]) && start - s < 160) s--;
    let e = end;
    while (e < text.length && !STOP.test(text[e]) && e - end < 160) e++;
    if (e < text.length && text[e] !== "\n") e++;
    return (s > 0 && !STOP.test(text[s - 1]) ? "…" : "") + text.slice(s, e).trim() + (e < text.length && !STOP.test(text[e - 1]) ? "…" : "");
}

const FIELDS: Array<[keyof Report, string]> = [
    ["context", "جمله"],
    ["original", "کلمه"],
    ["suggestion", "پیشنهاد ابزار"],
    ["message", "توضیح ابزار"],
    ["ruleLabel", "قاعده"],
    ["source", "منبع"]
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Opens the consent dialog for one report; resolves true if it was sent or copied. */
export async function openReport(report: Report): Promise<boolean> {
    const dialog = $<HTMLDialogElement>("report-dialog");
    const preview = $<HTMLDListElement>("report-preview");
    const comment = $<HTMLTextAreaElement>("report-comment");
    const send = $<HTMLButtonElement>("report-send");
    const note = $<HTMLParagraphElement>("report-note");
    const result = $<HTMLParagraphElement>("report-result");

    preview.replaceChildren();
    for (const [k, label] of FIELDS) {
        if (!report[k]) continue;
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = report[k];
        preview.append(dt, dd);
    }
    comment.value = "";
    result.textContent = "";
    send.disabled = true;
    send.textContent = "…";
    note.textContent = "";
    dialog.showModal();

    const st = await store();
    send.disabled = false;
    if (st && "server" in st) {
        send.textContent = "فرستادن گزارش";
        note.textContent = "همین موارد و توضیح شما برای سازندهٔ ابزار فرستاده می‌شود؛ نام، نشانی یا هیچ شناسه‌ای از شما فرستاده نمی‌شود. بقیهٔ متن شما فرستاده نمی‌شود و دیگران گزارش را نمی‌بینند.";
    } else if (st) {
        send.textContent = "فرستادن گزارش";
        note.textContent = "همین موارد و توضیح شما برای سازندهٔ ابزار ذخیره می‌شود، با شناسهٔ حسابتان (نه نام یا ایمیل). بقیهٔ متن شما فرستاده نمی‌شود و دیگر بازدیدکنندگان گزارش را نمی‌بینند.";
    } else {
        send.textContent = "رونوشت گزارش";
        note.textContent = "در این نسخه از صفحه گزارش مستقیم فرستاده نمی‌شود. گزارش در حافظهٔ موقت (کلیپ‌بورد) رونوشت می‌شود تا آن را برای سازنده بفرستید.";
    }

    return new Promise<boolean>((resolve) => {
        const done = (ok: boolean) => {
            send.removeEventListener("click", onSend);
            dialog.removeEventListener("close", onClose);
            if (dialog.open) dialog.close();
            resolve(ok);
        };
        const onClose = () => done(false);
        const onSend = async (ev: Event) => {
            ev.preventDefault();
            const full: Report = { ...report, comment: comment.value.trim().slice(0, 1000), at: new Date().toISOString() };
            send.disabled = true;
            if (st && "server" in st) {
                try {
                    const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(full) });
                    if (res.ok) {
                        done(true);
                        return;
                    }
                    result.textContent = "گزارش فرستاده نشد. گزارش رونوشت می‌شود.";
                } catch {
                    result.textContent = "گزارش فرستاده نشد. گزارش رونوشت می‌شود.";
                }
            } else if (st) {
                try {
                    const mine = st.db.doc(`reports/${st.uid}`);
                    await mine.collection("items").add(full);
                    await mine.set({ updated: full.at });
                    done(true);
                    return;
                } catch (e) {
                    const code = (e as { code?: string })?.code;
                    if (code === "quota_exceeded") {
                        result.textContent = "جای گزارش‌ها پر شده است؛ گزارش را رونوشت کنید و جداگانه بفرستید.";
                    } else if (code === "invalid_argument" || code === "not_granted") {
                        result.textContent = "سطح دسترسی شما به این صفحه اجازهٔ ذخیرهٔ گزارش نمی‌دهد. گزارش رونوشت می‌شود.";
                    } else {
                        result.textContent = "گزارش ذخیره نشد. گزارش رونوشت می‌شود.";
                    }
                }
            }
            const text = FIELDS.filter(([k]) => full[k]).map(([k, label]) => `${label}: ${full[k]}`).concat(full.comment ? [`توضیح من: ${full.comment}`] : []).join("\n");
            try {
                await navigator.clipboard.writeText("گزارش پیشنهاد غلط در واج‌بان\n" + text);
                result.textContent = (result.textContent ? result.textContent + " " : "") + "رونوشت شد.";
                window.setTimeout(() => done(true), 1200);
            } catch {
                result.textContent = "رونوشت خودکار ممکن نشد؛ متن بالا را انتخاب و رونوشت کنید.";
                send.disabled = false;
            }
        };
        send.addEventListener("click", onSend);
        dialog.addEventListener("close", onClose);
    });
}

/** For the owner: the reports received, newest first, with a delete button each. */
export async function setupOwnerPanel(): Promise<void> {
    if (!claude?.use) return;
    let user: any;
    try {
        user = await claude.use("user");
    } catch {
        return;
    }
    if (!user || !(await user.canEdit())) return;
    const panel = $<HTMLDetailsElement>("reports-panel");
    const listEl = $<HTMLOListElement>("reports-list");
    const countEl = $<HTMLSpanElement>("reports-count");
    panel.hidden = false;
    let loaded = false;

    const load = async () => {
        const st = await store();
        if (!st || "server" in st) {
            countEl.textContent = "در دسترس نیست";
            return;
        }
        countEl.textContent = "…";
        try {
            const people = await st.db.collection("reports").get();
            const items: Array<{ ref: any; r: Report }> = [];
            for (const p of people.docs) {
                const snap = await st.db.collection(`reports/${p.id}/items`).get();
                for (const d of snap.docs) items.push({ ref: st.db.doc(`reports/${p.id}/items/${d.id}`), r: d.data() as Report });
            }
            items.sort((a, b) => String(b.r.at).localeCompare(String(a.r.at)));
            countEl.textContent = items.length.toLocaleString("fa-IR");
            listEl.replaceChildren();
            if (items.length === 0) {
                const li = document.createElement("li");
                li.textContent = "هنوز گزارشی نرسیده است.";
                listEl.append(li);
            }
            for (const { ref, r } of items) {
                const li = document.createElement("li");
                li.className = "report-item";
                const head = document.createElement("p");
                head.className = "report-head";
                head.textContent = `${r.ruleLabel || r.rule} · «${r.original}»${r.suggestion ? ` ← «${r.suggestion}»` : ""} · ${new Date(r.at).toLocaleDateString("fa-IR")}`;
                const ctx = document.createElement("p");
                ctx.className = "report-context";
                ctx.textContent = r.context;
                li.append(head, ctx);
                if (r.comment) {
                    const c = document.createElement("p");
                    c.className = "report-comment";
                    c.textContent = `توضیح: ${r.comment}`;
                    li.append(c);
                }
                const del = document.createElement("button");
                del.type = "button";
                del.className = "btn btn-small btn-quiet";
                del.textContent = "حذف";
                del.addEventListener("click", async () => {
                    del.disabled = true;
                    try {
                        await ref.delete();
                        li.remove();
                    } catch {
                        del.disabled = false;
                    }
                });
                li.append(del);
                listEl.append(li);
            }
        } catch {
            countEl.textContent = "خواندن ممکن نشد";
        }
    };
    panel.addEventListener("toggle", () => {
        if (panel.open && !loaded) {
            loaded = true;
            void load();
        }
    });
}
