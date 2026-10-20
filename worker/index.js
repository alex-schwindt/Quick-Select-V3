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

export default {
    async fetch(request, env) {
        const { pathname } = new URL(request.url);
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
