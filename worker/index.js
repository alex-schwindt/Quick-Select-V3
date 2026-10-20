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

   Who gets which firm: server/firm-access.js. Identity check:
   server/access.js.
   ============================================================ */

import { accessEmail, firmsFor } from '../server/access.js';

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
        // Not normally reached - every other path is served straight from
        // the assets - but answer correctly if routing ever changes.
        return env.ASSETS.fetch(request);
    }
};
