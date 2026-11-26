// «این پیشنهاد غلط است» on vajban.com: a Cloudflare Pages Function that keeps the
// report in the D1 database bound as DB. Only the fields the reader saw in the
// dialog are stored; no IP address or other identifier.
const FIELDS = ["rule", "ruleLabel", "message", "source", "original", "suggestion", "context", "comment", "mode"];
const MAX = { context: 600, message: 400, source: 300, comment: 1000 };

export async function onRequestPost({ request, env }) {
    let body;
    try {
        body = await request.json();
    } catch {
        return new Response("bad json", { status: 400 });
    }
    if (!body || typeof body !== "object" || typeof body.original !== "string" || !body.original.trim()) {
        return new Response("missing fields", { status: 400 });
    }
    const row = FIELDS.map((k) => String(body[k] ?? "").slice(0, MAX[k] ?? 200));
    await env.DB.prepare(
        `INSERT INTO reports (${FIELDS.map((f) => `"${f}"`).join(", ")}, at) VALUES (${FIELDS.map(() => "?").join(", ")}, ?)`
    )
        .bind(...row, new Date().toISOString())
        .run();
    return new Response(null, { status: 204 });
}

export function onRequest() {
    return new Response("method not allowed", { status: 405, headers: { Allow: "POST" } });
}
