/* Gate for firms/<key>/* - each engineering firm's schedule templates.
   Served only when the signed-in user is allowed that firm; everyone
   else gets a plain 404, so the response doesn't confirm the firm
   exists. See server/access.js and server/firm-access.js. */

import { accessEmail, firmsFor } from '../../server/access.js';

function notFound() {
    return new Response('Not found', {
        status: 404,
        headers: { 'Cache-Control': 'private, no-store' }
    });
}

export async function onRequest(context) {
    const { request, env } = context;
    const match = /^\/firms\/([a-z0-9_]+)\//.exec(new URL(request.url).pathname);
    if (!match) return notFound();

    const email = await accessEmail(request, env);
    if (!firmsFor(email).includes(match[1])) return notFound();

    const res = await context.next();
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'private, no-store');
    return out;
}
