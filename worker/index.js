/* ============================================================
   HHpro - Cloudflare Worker entry point
   ------------------------------------------------------------
   The site is static files (dist/, built by build.sh) served
   from the Worker's assets. Cloudflare Access signs every user
   in before a request gets here. This script only runs for the
   two paths wrangler.jsonc routes to it ("run_worker_first"):

     GET /api/firms     -> { firms: [...] } the engineering-firm
                           layouts the signed-in user may load
     /firms/<key>/...   -> that firm's template file, served only
                           to users allowed the firm; everyone
                           else gets a plain 404 so the response
                           doesn't confirm the firm exists
     /api/me, /api/projects*, /api/admin/*
                        -> saved projects in D1 (server/projects.js)
     INTERNAL_ONLY files -> H&H staff only (firm-access.js "internal");
                           everyone else gets a plain 404
     /ASSETS/<key>      -> product documentation from the R2 bucket
                           (submittals, manuals, Revit, CAD), signed-in
                           users only. The site's own fonts and favicon
                           under /ASSETS/ still come from dist/.

   Who gets which firm: server/firm-access.js. Who is an admin:
   server/admins.js. Identity check: server/access.js.
   ============================================================ */

import { accessEmail, firmsFor, isInternal } from '../server/access.js';
import { handleProjects } from '../server/projects.js';

// Site files only H&H staff may load (each must also be listed under
// "run_worker_first" in wrangler.jsonc so requests reach this script).
// Empty today - add a section's JSON path here (and mark the product
// internalOnly in JS/data.js) to make it H&H-only.
const INTERNAL_ONLY = new Set([]);

const NO_STORE = { 'Cache-Control': 'private, no-store' };

function notFound() {
    return new Response('Not found', { status: 404, headers: NO_STORE });
}

async function apiFirms(request, env) {
    if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET', ...NO_STORE } });
    }
    const email = await accessEmail(request, env);
    return new Response(JSON.stringify({ firms: firmsFor(email) }), {
        status: email ? 200 : 401,
        headers: { 'Content-Type': 'application/json', ...NO_STORE }
    });
}

async function firmFile(request, env, pathname) {
    const match = /^\/firms\/([a-z0-9_]+)\//.exec(pathname);
    if (!match) return notFound();
    const email = await accessEmail(request, env);
    if (!firmsFor(email).includes(match[1])) return notFound();

    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'private, no-store');
    return out;
}

// Files under /ASSETS/ that ship with the site (dist/) rather than R2.
const SITE_ASSET_PREFIXES = ['/ASSETS/FONTS/', '/ASSETS/favicon.svg'];

const CONTENT_TYPES = {
    pdf: 'application/pdf', zip: 'application/zip', dwg: 'application/acad',
    dxf: 'application/dxf', rfa: 'application/octet-stream', rvt: 'application/octet-stream',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png'
};

async function docFile(request, env, pathname) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD', ...NO_STORE } });
    }
    if (!(await accessEmail(request, env))) return notFound();

    let key;
    try {
        key = decodeURIComponent(pathname.slice('/ASSETS/'.length));
    } catch (e) {
        return notFound();
    }
    if (!key || key.includes('..')) return notFound();

    // Files dragged into the dashboard keep their names as typed ("MINI
    // SPLITS/..."), but `wrangler r2 object put` stores spaces and other
    // characters URL-encoded ("MINI%20SPLITS/..."). Accept either.
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    const found = (await env.DOCS.head(key)) ? key
        : (encodedKey !== key && (await env.DOCS.head(encodedKey))) ? encodedKey : null;
    if (!found) return notFound();

    // Range + conditional requests pass straight through (PDF viewers fetch
    // large files in pieces).
    const object = request.method === 'HEAD'
        ? await env.DOCS.head(found)
        : await env.DOCS.get(found, { range: request.headers, onlyIf: request.headers });
    if (!object) return notFound();

    const headers = new Headers(NO_STORE);
    object.writeHttpMetadata(headers);
    if (!headers.get('Content-Type')) {
        const ext = key.split('.').pop().toLowerCase();
        headers.set('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
    }
    headers.set('ETag', object.httpEtag);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'private, max-age=3600');

    if (request.method === 'HEAD') {
        headers.set('Content-Length', String(object.size));
        return new Response(null, { status: 200, headers });
    }
    if (!('body' in object)) return new Response(null, { status: 304, headers });   // onlyIf matched
    if (object.range && request.headers.has('Range')) {
        const start = object.range.offset ?? (object.size - object.range.suffix);
        const length = object.range.length ?? (object.size - start);
        headers.set('Content-Range', `bytes ${start}-${start + length - 1}/${object.size}`);
        return new Response(object.body, { status: 206, headers });
    }
    return new Response(object.body, { status: 200, headers });
}

export default {
    async fetch(request, env) {
        const { pathname } = new URL(request.url);
        if (pathname.startsWith('/ASSETS/')) {
            if (SITE_ASSET_PREFIXES.some(p => pathname.startsWith(p))) return env.ASSETS.fetch(request);
            return docFile(request, env, pathname);
        }
        if (pathname === '/api/firms') return apiFirms(request, env);
        if (pathname.startsWith('/firms/')) return firmFile(request, env, pathname);
        if (INTERNAL_ONLY.has(pathname)) {
            if (!isInternal(await accessEmail(request, env))) return notFound();
            const res = await env.ASSETS.fetch(request);
            const out = new Response(res.body, res);
            out.headers.set('Cache-Control', 'private, no-store');
            return out;
        }
        if (pathname.startsWith('/api/')) {
            const res = await handleProjects(request, env, pathname, await accessEmail(request, env));
            return res || notFound();
        }
        // Not normally reached - every other path is served straight from
        // the assets - but answer correctly if routing ever changes.
        return env.ASSETS.fetch(request);
    }
};
