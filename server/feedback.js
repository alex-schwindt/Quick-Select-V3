/* ============================================================
   HHpro - Feedback API (bug reports / feature requests)
   ------------------------------------------------------------
   The header Feedback button (JS/feedback.js) sends:

     POST /api/feedback                        -> { id } (status 'pending')
     PUT  /api/feedback/<id>/files/<name>      -> optional screenshot / file
     POST /api/feedback/<id>/submit            -> status 'new' + email
     GET  /api/feedback                        -> the signed-in user's feedback
     GET  /api/feedback/<id>/files/<name>      -> download (owner or admin)
     GET  /api/admin/feedback                  -> everything (admins)
     PUT  /api/admin/feedback/<id>/status      -> { status } (admins)

   Saved in D1 (table `feedback`) before any email goes out; files in
   R2 under FEEDBACK/<id>/. Recipients: recipients.js `feedback`.
   ============================================================ */

import { isAdmin } from './projects.js';
import { feedbackRecipients } from './recipients.js';
import { json, safeName, newId, storageKey, esc, fmtSize, loadAttachments, sendMail } from './mail.js';

const TYPES = ['Bug', 'Feature request', 'Data issue', 'Other'];
const STATUSES = ['new', 'planned', 'in progress', 'done', "won't do"];
const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE = 8000;
const MAX_FILES = 3;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ID_RE = /^fb_[a-z0-9]{8,40}$/;

let schemaReady = null;

function ensureSchema(db) {
    if (!schemaReady) {
        schemaReady = db.prepare(`CREATE TABLE IF NOT EXISTS feedback (
                id           TEXT PRIMARY KEY,
                owner        TEXT NOT NULL,
                type         TEXT NOT NULL,
                message      TEXT NOT NULL,
                context      TEXT NOT NULL DEFAULT '{}',
                status       TEXT NOT NULL,
                files        TEXT NOT NULL DEFAULT '[]',
                created_at   TEXT NOT NULL,
                submitted_at TEXT,
                email_status TEXT,
                email_error  TEXT
            )`).run().catch((err) => { schemaReady = null; throw err; });
    }
    return schemaReady;
}

const fileKey = (env, id, name) => storageKey(env, 'FEEDBACK', id, name);

function summaryOf(r) {
    let files = [], context = {};
    try { files = JSON.parse(r.files || '[]'); } catch (e) { /* keep empty */ }
    try { context = JSON.parse(r.context || '{}'); } catch (e) { /* keep empty */ }
    return {
        id: r.id, owner: r.owner, type: r.type, message: r.message, context, status: r.status,
        createdAt: r.created_at, submittedAt: r.submitted_at,
        emailStatus: r.email_status, emailError: r.email_error,
        files: files.map((f) => ({ name: f.name, size: f.size }))
    };
}

async function getRow(db, id) {
    return db.prepare('SELECT * FROM feedback WHERE id = ?').bind(id).first();
}

async function create(db, email, request) {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: 'feedback is too long' }, 413);
    let body;
    try { body = JSON.parse(text); } catch (e) { return json({ error: 'invalid JSON' }, 400); }
    const type = TYPES.includes(body && body.type) ? body.type : 'Other';
    const message = String((body && body.message) || '').trim().slice(0, MAX_MESSAGE);
    if (!message) return json({ error: 'please describe the issue or request' }, 400);
    const context = (body && typeof body.context === 'object' && body.context) || {};
    const id = newId('fb');
    await db.prepare(
        `INSERT INTO feedback (id, owner, type, message, context, status, files, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'pending', '[]', ?6)`
    ).bind(id, email, type, message, JSON.stringify(context).slice(0, 16000), new Date().toISOString()).run();
    return json({ id });
}

async function upload(env, email, id, rawName, request) {
    const row = await getRow(env.DB, id);
    if (!row || row.owner !== email) return json({ error: 'not found' }, 404);
    if (row.status !== 'pending') return json({ error: 'already submitted' }, 409);
    const files = JSON.parse(row.files || '[]');
    const name = safeName(rawName);
    const others = files.filter((f) => f.name !== name);
    if (others.length >= MAX_FILES) return json({ error: `at most ${MAX_FILES} files` }, 400);
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength) return json({ error: 'empty file' }, 400);
    if (bytes.byteLength > MAX_FILE_BYTES) return json({ error: 'file is larger than 10 MB' }, 413);
    const type = (request.headers.get('Content-Type') || 'application/octet-stream').split(';')[0];
    await env.DOCS.put(fileKey(env, id, name), bytes, { httpMetadata: { contentType: type } });
    others.push({ name, size: bytes.byteLength, type });
    await env.DB.prepare('UPDATE feedback SET files = ? WHERE id = ?').bind(JSON.stringify(others), id).run();
    return json({ name, size: bytes.byteLength });
}

export function renderFeedbackEmail(row, origin, attachedNames) {
    const ctx = JSON.parse(row.context || '{}');
    const files = JSON.parse(row.files || '[]');
    const first = String(row.message).split('\n')[0].slice(0, 70);
    const subject = `HHpro ${row.type}: ${first}${row.message.length > first.length ? '…' : ''}`;
    const ctxRows = [
        ['From', row.owner], ['Page', ctx.page], ['Product', ctx.product], ['Filters', ctx.filters],
        ['Site version', ctx.version], ['Screen', ctx.screen], ['Browser', ctx.browser]
    ].filter((r) => r[1]);
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111">` +
        `<h2 style="margin:0 0 8px">${esc(row.type)}</h2>` +
        `<p style="margin:0 0 14px;white-space:pre-wrap">${esc(row.message)}</p>` +
        `<table style="border-collapse:collapse;font-size:12px;color:#333">` +
        ctxRows.map((r) => `<tr><td style="padding:2px 12px 2px 0;color:#777;vertical-align:top">${esc(r[0])}</td><td style="padding:2px 0">${esc(r[1])}</td></tr>`).join('') +
        `</table>` +
        (files.length ? `<p style="margin:12px 0 0">Files: ` + files.map((f) =>
            `${esc(f.name)} (${fmtSize(f.size)})${attachedNames.includes(f.name) ? '' : ' - download from HHpro Admin > Feedback'}`).join(', ') + `</p>` : '') +
        `<p style="margin:14px 0 0;color:#777">Feedback ${esc(row.id)}${origin ? ` &middot; <a href="${esc(origin)}">${esc(origin)}</a> &gt; Admin &gt; Feedback` : ''}</p></div>`;
    const text = [row.type, '', row.message, '', ...ctxRows.map((r) => `${r[0]}: ${r[1]}`), '',
                  ...files.map((f) => `File: ${f.name} (${fmtSize(f.size)})`), `Feedback ${row.id}`].join('\n');
    return { subject, html, text };
}

async function submit(env, email, id, origin) {
    const row = await getRow(env.DB, id);
    if (!row || row.owner !== email) return json({ error: 'not found' }, 404);
    if (row.status !== 'pending') return json({ error: 'already submitted' }, 409);
    const now = new Date().toISOString();
    await env.DB.prepare(`UPDATE feedback SET status = 'new', submitted_at = ? WHERE id = ?`).bind(now, id).run();
    const files = JSON.parse(row.files || '[]');
    const { attachments, attachedNames } = await loadAttachments(env, (n) => fileKey(env, id, n), files, 18 * 1024 * 1024);
    const msg = renderFeedbackEmail(row, origin, attachedNames);
    const sent = await sendMail(env, { to: feedbackRecipients(), fromName: 'HHpro Feedback', replyTo: row.owner,
                                       subject: msg.subject, html: msg.html, text: msg.text, attachments });
    await env.DB.prepare('UPDATE feedback SET email_status = ?, email_error = ? WHERE id = ?')
        .bind(sent.status, sent.error || null, id).run();
    return json({ id, submitted: true, email: sent.status });
}

async function download(env, email, id, rawName) {
    const row = await getRow(env.DB, id);
    if (!row || (row.owner !== email && !isAdmin(email))) return json({ error: 'not found' }, 404);
    const name = safeName(rawName);
    const obj = await env.DOCS.get(fileKey(env, id, name));
    if (!obj) return json({ error: 'not found' }, 404);
    const headers = new Headers({ 'Cache-Control': 'private, no-store' });
    obj.writeHttpMetadata(headers);
    headers.set('Content-Disposition', `attachment; filename="${name.replace(/"/g, '')}"`);
    // User-uploaded content: always a download, never rendered or sniffed
    // as a page on the site's origin.
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Security-Policy', "sandbox; default-src 'none'");
    return new Response(obj.body, { headers });
}

async function list(db, email, all) {
    const q = all
        ? db.prepare(`SELECT * FROM feedback WHERE status != 'pending' ORDER BY submitted_at DESC`)
        : db.prepare(`SELECT * FROM feedback WHERE owner = ? AND status != 'pending' ORDER BY submitted_at DESC`).bind(email);
    const rows = await q.all();
    return json({ feedback: rows.results.map(summaryOf), statuses: STATUSES });
}

async function setStatus(db, id, request) {
    let body;
    try { body = JSON.parse(await request.text()); } catch (e) { return json({ error: 'invalid JSON' }, 400); }
    const status = String((body && body.status) || '').toLowerCase();
    if (!STATUSES.includes(status)) return json({ error: 'unknown status' }, 400);
    const res = await db.prepare(`UPDATE feedback SET status = ? WHERE id = ? AND status != 'pending'`).bind(status, id).run();
    return res.meta.changes ? json({ id, status }) : json({ error: 'not found' }, 404);
}

/** Handle /api/feedback* and /api/admin/feedback*; null for anything else. */
export async function handleFeedback(request, env, pathname, email) {
    const own = pathname === '/api/feedback' || pathname.startsWith('/api/feedback/');
    const admin = pathname === '/api/admin/feedback' || pathname.startsWith('/api/admin/feedback/');
    if (!own && !admin) return null;
    if (!email) return json({ error: 'not signed in' }, 401);
    if (!env.DB || !env.DOCS) return json({ error: 'feedback storage is not configured' }, 503);
    await ensureSchema(env.DB);
    const method = request.method;

    if (admin) {
        if (!isAdmin(email)) return json({ error: 'not found' }, 404);
        if (pathname === '/api/admin/feedback' && method === 'GET') return list(env.DB, email, true);
        const m = /^\/api\/admin\/feedback\/([^/]+)\/status$/.exec(pathname);
        if (m && method === 'PUT' && ID_RE.test(m[1])) return setStatus(env.DB, m[1], request);
        return json({ error: 'not found' }, 404);
    }
    if (pathname === '/api/feedback') {
        if (method === 'GET') return list(env.DB, email, false);
        if (method === 'POST') return create(env.DB, email, request);
        return json({ error: 'method not allowed' }, 405);
    }
    const parts = pathname.slice('/api/feedback/'.length).split('/');
    const id = parts[0];
    if (!ID_RE.test(id)) return json({ error: 'bad feedback id' }, 400);
    if (parts.length === 2 && parts[1] === 'submit' && method === 'POST') {
        return submit(env, email, id, new URL(request.url).origin);
    }
    if (parts.length === 3 && parts[1] === 'files') {
        let name;
        try { name = decodeURIComponent(parts[2]); } catch (e) { return json({ error: 'bad file name' }, 400); }
        if (method === 'PUT') return upload(env, email, id, name, request);
        if (method === 'GET') return download(env, email, id, name);
    }
    return json({ error: 'not found' }, 404);
}
