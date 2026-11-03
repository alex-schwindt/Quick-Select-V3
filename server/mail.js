/* ============================================================
   HHpro - Shared helpers for the request-style APIs
   (server/ahu-requests.js, server/feedback.js): JSON replies,
   upload file names, storage keys and sending email.

   Email goes through the Cloudflare Email Service binding `EMAIL`
   (wrangler.jsonc "send_email") from EMAIL_FROM. ENV_LABEL (set on
   the staging environment) is put in front of every subject, and
   STORAGE_PREFIX keeps staging uploads apart from the live site's
   in the shared R2 bucket.
   ============================================================ */

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };

export function json(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** Exact emails or '@domain' entries, matched ignoring case. */
export function matches(email, entries) {
    return (entries || []).some((entry) => {
        const e = String(entry).trim().toLowerCase();
        return !!e && (e.startsWith('@') ? email.endsWith(e) : email === e);
    });
}

export function safeName(name) {
    const base = String(name || '').split(/[\\/]/).pop()
        .replace(/[^A-Za-z0-9 ._()\-]/g, '_').replace(/^\.+/, '').trim().slice(0, 120);
    return base || 'file';
}

export function newId(prefix) {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    return prefix + '_' + Date.now().toString(36) +
        [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}

/** R2 key for an uploaded file, under the environment's STORAGE_PREFIX. */
export function storageKey(env, ...parts) {
    return String(env.STORAGE_PREFIX || '') + parts.join('/');
}

export const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function fmtSize(n) {
    return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
}

// Base64 text works with both the deployed binding and wrangler dev's
// local email simulator (which can't serialize ArrayBuffer attachments).
export function toBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
}

/**
 * Read uploaded files back from R2 as email attachments, in order, until
 * `maxBytes` would be exceeded. files: [{ name, size, type }].
 * Returns { attachments, attachedNames }.
 */
export async function loadAttachments(env, keyFor, files, maxBytes) {
    const attachments = [], attachedNames = [];
    let used = 0;
    for (const f of files) {
        if (used + f.size > maxBytes) continue;
        const obj = await env.DOCS.get(keyFor(f.name));
        if (!obj) continue;
        attachments.push({ content: toBase64(await obj.arrayBuffer()), filename: f.name,
                           type: f.type || 'application/octet-stream', disposition: 'attachment' });
        attachedNames.push(f.name);
        used += f.size;
    }
    return { attachments, attachedNames };
}

/**
 * Send one message. Never throws: returns { status: 'sent' | 'not configured' |
 * 'no recipients' | 'failed', error?, recipients }.
 */
export async function sendMail(env, { to, fromName, replyTo, subject, html, text, attachments }) {
    if (!env.EMAIL || !env.EMAIL_FROM) return { status: 'not configured', recipients: to };
    if (!to || !to.length) return { status: 'no recipients', recipients: [] };
    const label = env.ENV_LABEL ? `[${env.ENV_LABEL}] ` : '';
    try {
        await env.EMAIL.send({
            to, from: { email: env.EMAIL_FROM, name: fromName || 'HHpro' },
            replyTo, subject: label + subject, html, text,
            attachments: attachments && attachments.length ? attachments : undefined
        });
        return { status: 'sent', recipients: to };
    } catch (err) {
        return { status: 'failed', error: `${err.code || ''} ${err.message || err}`.trim().slice(0, 500), recipients: to };
    }
}
