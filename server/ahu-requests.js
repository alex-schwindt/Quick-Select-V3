/* ============================================================
   HHpro - Air Handler Design Request API (D1 + R2 + email)
   ------------------------------------------------------------
   A request is filled in on the site (JS/ahu_request.js), then:

     POST /api/ahu-requests                      -> { id } new request (status 'pending')
     PUT  /api/ahu-requests/<id>/files/<name>    -> upload one attachment (raw body)
     POST /api/ahu-requests/<id>/submit          -> mark submitted + email the recipients
     GET  /api/ahu-requests                      -> the signed-in user's requests (summary)
     GET  /api/ahu-requests/<id>                 -> one request in full (owner or admin)
     GET  /api/ahu-requests/<id>/files/<name>    -> download an attachment (owner or admin)
     GET  /api/admin/ahu-requests                -> every request (admins)
     PUT  /api/admin/ahu-requests/<id>/status    -> { status } (admins)

   The request is saved before any email goes out, so nothing is
   lost if email isn't configured or fails - it still shows on the
   Admin page. Email goes through the Cloudflare Email Service
   binding `EMAIL` (wrangler.jsonc "send_email") from EMAIL_FROM
   (wrangler.jsonc "vars"); recipients come from ahu-recipients.js.

   The browser sends a ready-made `summary` (titled sections of
   label / value rows) alongside the raw form, so this file renders
   the email without knowing the form's fields.
   ============================================================ */

import RECIPIENTS from './ahu-recipients.js';
import { isAdmin } from './projects.js';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
const MAX_FORM_BYTES = 512 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 12;
const MAX_TOTAL_BYTES = 75 * 1024 * 1024;
const MAX_ATTACH_BYTES = 18 * 1024 * 1024;      // 25 MiB message limit less base64 overhead
const STATUSES = ['submitted', 'in review', 'quoted', 'closed'];
const ID_RE = /^ahu_[a-z0-9]{8,40}$/;

let schemaReady = null;

function ensureSchema(db) {
    if (!schemaReady) {
        schemaReady = db.prepare(`CREATE TABLE IF NOT EXISTS ahu_requests (
                id           TEXT PRIMARY KEY,
                owner        TEXT NOT NULL,
                project_name TEXT,
                status       TEXT NOT NULL,
                data         TEXT NOT NULL,
                files        TEXT NOT NULL DEFAULT '[]',
                created_at   TEXT NOT NULL,
                submitted_at TEXT,
                email_status TEXT,
                email_error  TEXT
            )`).run().catch((err) => { schemaReady = null; throw err; });
    }
    return schemaReady;
}

function json(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function matches(email, entries) {
    return (entries || []).some((entry) => {
        const e = String(entry).trim().toLowerCase();
        return !!e && (e.startsWith('@') ? email.endsWith(e) : email === e);
    });
}

/** Everyone who gets this submitter's requests (deduplicated). */
export function recipientsFor(submitter) {
    const out = new Set((RECIPIENTS.always || []).map((e) => String(e).trim().toLowerCase()));
    (RECIPIENTS.bySubmitter || []).forEach((rule) => {
        if (matches(submitter, rule.match)) (rule.to || []).forEach((e) => out.add(String(e).trim().toLowerCase()));
    });
    return [...out].filter(Boolean);
}

function safeName(name) {
    const base = String(name || '').split(/[\\/]/).pop()
        .replace(/[^A-Za-z0-9 ._()\-]/g, '_').replace(/^\.+/, '').trim().slice(0, 120);
    return base || 'file';
}

function newId() {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    return 'ahu_' + Date.now().toString(36) + [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}

const fileKey = (id, name) => `REQUESTS/AHU/${id}/${name}`;

async function getRow(db, id) {
    return db.prepare('SELECT * FROM ahu_requests WHERE id = ?').bind(id).first();
}

function summaryOf(r) {
    let files = [];
    try { files = JSON.parse(r.files || '[]'); } catch (e) { /* keep empty */ }
    return {
        id: r.id, owner: r.owner, projectName: r.project_name, status: r.status,
        createdAt: r.created_at, submittedAt: r.submitted_at,
        emailStatus: r.email_status, emailError: r.email_error,
        files: files.map((f) => ({ name: f.name, size: f.size }))
    };
}

// ---------------- create / upload / submit ----------------

async function create(db, email, request) {
    const text = await request.text();
    if (text.length > MAX_FORM_BYTES) return json({ error: 'request is too large' }, 413);
    let body;
    try { body = JSON.parse(text); } catch (e) { return json({ error: 'invalid JSON' }, 400); }
    if (!body || typeof body !== 'object' || !body.summary || !Array.isArray(body.summary.sections)) {
        return json({ error: 'missing summary' }, 400);
    }
    const id = newId();
    const name = String(body.summary.projectName || '').slice(0, 300);
    await db.prepare(
        `INSERT INTO ahu_requests (id, owner, project_name, status, data, files, created_at)
         VALUES (?1, ?2, ?3, 'pending', ?4, '[]', ?5)`
    ).bind(id, email, name, JSON.stringify({ form: body.form || {}, summary: body.summary }),
           new Date().toISOString()).run();
    return json({ id });
}

async function upload(env, email, id, rawName, request) {
    const row = await getRow(env.DB, id);
    if (!row || row.owner !== email) return json({ error: 'not found' }, 404);
    if (row.status !== 'pending') return json({ error: 'request already submitted' }, 409);
    const files = JSON.parse(row.files || '[]');
    const name = safeName(rawName);
    const others = files.filter((f) => f.name !== name);
    if (others.length >= MAX_FILES) return json({ error: `at most ${MAX_FILES} files` }, 400);

    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength) return json({ error: 'empty file' }, 400);
    if (bytes.byteLength > MAX_FILE_BYTES) return json({ error: 'file is larger than 25 MB' }, 413);
    const total = others.reduce((s, f) => s + f.size, 0) + bytes.byteLength;
    if (total > MAX_TOTAL_BYTES) return json({ error: 'attachments total more than 75 MB' }, 413);

    const type = (request.headers.get('Content-Type') || 'application/octet-stream').split(';')[0];
    await env.DOCS.put(fileKey(id, name), bytes, { httpMetadata: { contentType: type } });
    others.push({ name, size: bytes.byteLength, type });
    await env.DB.prepare('UPDATE ahu_requests SET files = ? WHERE id = ?').bind(JSON.stringify(others), id).run();
    return json({ name, size: bytes.byteLength });
}

async function submit(env, email, id, origin) {
    const row = await getRow(env.DB, id);
    if (!row || row.owner !== email) return json({ error: 'not found' }, 404);
    if (row.status !== 'pending') return json({ error: 'request already submitted' }, 409);
    const now = new Date().toISOString();
    await env.DB.prepare(`UPDATE ahu_requests SET status = 'submitted', submitted_at = ? WHERE id = ?`)
        .bind(now, id).run();

    const sent = await sendRequestEmail(env, { ...row, status: 'submitted', submitted_at: now }, origin);
    await env.DB.prepare('UPDATE ahu_requests SET email_status = ?, email_error = ? WHERE id = ?')
        .bind(sent.status, sent.error || null, id).run();
    return json({ id, submitted: true, email: sent.status, recipients: sent.recipients || [] });
}

// ---------------- email ----------------

const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Base64 text works with both the deployed binding and wrangler dev's
// local email simulator (which can't serialize ArrayBuffer attachments).
function toBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
}

function fmtSize(n) {
    return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
}

export function renderEmail(row, origin, attachedNames) {
    const data = JSON.parse(row.data || '{}');
    const s = data.summary || {};
    const files = JSON.parse(row.files || '[]');
    const title = `Air Handler Design Request - ${s.projectName || 'Untitled project'}`;
    const html = [];
    const text = [];
    html.push(`<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111">`);
    html.push(`<h2 style="margin:0 0 4px">${esc(title)}</h2>`);
    html.push(`<p style="margin:0 0 12px;color:#555">Submitted by ${esc(row.owner)} on ${esc(new Date(row.submitted_at || row.created_at).toUTCString())} &middot; Request ${esc(row.id)}</p>`);
    text.push(title, `Submitted by ${row.owner} - request ${row.id}`, '');
    if (s.configuration) {
        html.push(`<p style="margin:0 0 12px"><b>Configuration (airflow order):</b><br>${esc(s.configuration)}</p>`);
        text.push('Configuration (airflow order):', s.configuration, '');
    }
    if (Array.isArray(s.warnings) && s.warnings.length) {
        html.push(`<div style="margin:0 0 12px;padding:8px 10px;border:1px solid #f59e0b;background:#fff8e6">` +
                  `<b>Check with the engineer:</b><ul style="margin:4px 0 0 18px;padding:0">` +
                  s.warnings.map((w) => `<li>${esc(w)}</li>`).join('') + `</ul></div>`);
        text.push('Check with the engineer:', ...s.warnings.map((w) => ' - ' + w), '');
    }
    (s.sections || []).forEach((sec) => {
        const rows = (sec.rows || []).filter((r) => r && r[1] !== '' && r[1] != null);
        if (!rows.length) return;
        html.push(`<h3 style="margin:16px 0 4px;font-size:14px;border-bottom:1px solid #ccc">${esc(sec.title)}</h3>`);
        html.push(`<table style="border-collapse:collapse;font-size:13px">` + rows.map((r) =>
            `<tr><td style="padding:2px 14px 2px 0;color:#555;vertical-align:top;white-space:nowrap">${esc(r[0])}</td>` +
            `<td style="padding:2px 0;vertical-align:top">${esc(r[1]).replace(/\n/g, '<br>')}</td></tr>`).join('') + `</table>`);
        text.push(`== ${sec.title} ==`, ...rows.map((r) => `${r[0]}: ${r[1]}`), '');
    });
    if (files.length) {
        html.push(`<h3 style="margin:16px 0 4px;font-size:14px;border-bottom:1px solid #ccc">Attachments</h3><ul style="margin:0 0 0 18px;padding:0">`);
        text.push('== Attachments ==');
        files.forEach((f) => {
            const att = attachedNames.includes(f.name);
            const note = att ? 'attached' : 'too large to attach - download from HHpro (Admin > Design Requests)';
            html.push(`<li>${esc(f.name)} (${fmtSize(f.size)}) - ${note}</li>`);
            text.push(` - ${f.name} (${fmtSize(f.size)}) - ${note}`);
        });
        html.push('</ul>');
        text.push('');
    }
    html.push(`<p style="margin:16px 0 0;color:#555">Open HHpro${origin ? ` (<a href="${esc(origin)}">${esc(origin)}</a>)` : ''} &gt; Admin &gt; Design Requests to see the request and download its files.</p></div>`);
    text.push(`Open HHpro${origin ? ' (' + origin + ')' : ''} > Admin > Design Requests to see the request and download its files.`);
    return { subject: title, html: html.join(''), text: text.join('\n') };
}

async function sendRequestEmail(env, row, origin) {
    const to = recipientsFor(row.owner);
    if (!env.EMAIL || !env.EMAIL_FROM) return { status: 'not configured', recipients: to };
    if (!to.length) return { status: 'no recipients' };
    try {
        // Attach files in upload order until the message would exceed the limit.
        const files = JSON.parse(row.files || '[]');
        const attachments = [], attachedNames = [];
        let used = 0;
        for (const f of files) {
            if (used + f.size > MAX_ATTACH_BYTES) continue;
            const obj = await env.DOCS.get(fileKey(row.id, f.name));
            if (!obj) continue;
            attachments.push({ content: toBase64(await obj.arrayBuffer()), filename: f.name,
                               type: f.type || 'application/octet-stream', disposition: 'attachment' });
            attachedNames.push(f.name);
            used += f.size;
        }
        const msg = renderEmail(row, origin, attachedNames);
        await env.EMAIL.send({
            to, from: { email: env.EMAIL_FROM, name: 'HHpro Design Requests' },
            replyTo: row.owner, subject: msg.subject, html: msg.html, text: msg.text,
            attachments: attachments.length ? attachments : undefined
        });
        return { status: 'sent', recipients: to };
    } catch (err) {
        return { status: 'failed', error: `${err.code || ''} ${err.message || err}`.trim().slice(0, 500), recipients: to };
    }
}

// ---------------- reads ----------------

async function listOwn(db, email) {
    const rows = await db.prepare(
        `SELECT * FROM ahu_requests WHERE owner = ? AND status != 'pending' ORDER BY submitted_at DESC`
    ).bind(email).all();
    return json({ requests: rows.results.map(summaryOf) });
}

async function getOne(db, email, id) {
    const row = await getRow(db, id);
    if (!row || (row.owner !== email && !isAdmin(email))) return json({ error: 'not found' }, 404);
    return json({ ...summaryOf(row), data: JSON.parse(row.data || '{}') });
}

async function download(env, email, id, rawName) {
    const row = await getRow(env.DB, id);
    if (!row || (row.owner !== email && !isAdmin(email))) return json({ error: 'not found' }, 404);
    const name = safeName(rawName);
    const obj = await env.DOCS.get(fileKey(id, name));
    if (!obj) return json({ error: 'not found' }, 404);
    const headers = new Headers({ 'Cache-Control': 'private, no-store' });
    obj.writeHttpMetadata(headers);
    headers.set('Content-Disposition', `attachment; filename="${name.replace(/"/g, '')}"`);
    return new Response(obj.body, { headers });
}

async function adminList(db) {
    const rows = await db.prepare(
        `SELECT * FROM ahu_requests WHERE status != 'pending' ORDER BY submitted_at DESC`
    ).all();
    return json({ requests: rows.results.map(summaryOf) });
}

async function adminStatus(db, id, request) {
    let body;
    try { body = JSON.parse(await request.text()); } catch (e) { return json({ error: 'invalid JSON' }, 400); }
    const status = String(body && body.status || '').toLowerCase();
    if (!STATUSES.includes(status)) return json({ error: 'unknown status' }, 400);
    const res = await db.prepare(`UPDATE ahu_requests SET status = ? WHERE id = ? AND status != 'pending'`)
        .bind(status, id).run();
    return res.meta.changes ? json({ id, status }) : json({ error: 'not found' }, 404);
}

/**
 * Handle /api/ahu-requests* and /api/admin/ahu-requests*. Returns null
 * for any other path. `email` is the verified Access identity or null.
 */
export async function handleAhuRequests(request, env, pathname, email) {
    const own = pathname === '/api/ahu-requests' || pathname.startsWith('/api/ahu-requests/');
    const admin = pathname === '/api/admin/ahu-requests' || pathname.startsWith('/api/admin/ahu-requests/');
    if (!own && !admin) return null;
    if (!email) return json({ error: 'not signed in' }, 401);
    if (!env.DB || !env.DOCS) return json({ error: 'request storage is not configured' }, 503);
    await ensureSchema(env.DB);
    const method = request.method;
    const origin = new URL(request.url).origin;

    if (admin) {
        if (!isAdmin(email)) return json({ error: 'not found' }, 404);
        if (pathname === '/api/admin/ahu-requests' && method === 'GET') return adminList(env.DB);
        const m = /^\/api\/admin\/ahu-requests\/([^/]+)\/status$/.exec(pathname);
        if (m && method === 'PUT' && ID_RE.test(m[1])) return adminStatus(env.DB, m[1], request);
        return json({ error: 'not found' }, 404);
    }

    if (pathname === '/api/ahu-requests') {
        if (method === 'GET') return listOwn(env.DB, email);
        if (method === 'POST') return create(env.DB, email, request);
        return json({ error: 'method not allowed' }, 405);
    }
    const parts = pathname.slice('/api/ahu-requests/'.length).split('/');
    const id = parts[0];
    if (!ID_RE.test(id)) return json({ error: 'bad request id' }, 400);
    if (parts.length === 1 && method === 'GET') return getOne(env.DB, email, id);
    if (parts.length === 2 && parts[1] === 'submit' && method === 'POST') return submit(env, email, id, origin);
    if (parts.length === 3 && parts[1] === 'files') {
        let name;
        try { name = decodeURIComponent(parts[2]); } catch (e) { return json({ error: 'bad file name' }, 400); }
        if (method === 'PUT') return upload(env, email, id, name, request);
        if (method === 'GET') return download(env, email, id, name);
    }
    return json({ error: 'not found' }, 404);
}
