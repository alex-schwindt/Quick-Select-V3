/* GET /api/firms -> { firms: [...] }: the engineering-firm layouts the
   signed-in user may load. See server/access.js and server/firm-access.js. */

import { accessEmail, firmsFor } from '../../server/access.js';

export async function onRequestGet({ request, env }) {
    const email = await accessEmail(request, env);
    return new Response(JSON.stringify({ firms: firmsFor(email) }), {
        status: email ? 200 : 401,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, no-store'
        }
    });
}
