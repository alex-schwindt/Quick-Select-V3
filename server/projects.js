/* ============================================================
   HHpro - Saved projects API (Cloudflare D1)
   ------------------------------------------------------------
   Every project is stored under the verified email of the person
   who saved it (server/access.js) - the browser never says whose
   it is, so nobody can read or write another user's projects
   except admins (server/admins.js), who can only read.

   The browser keeps its own copy in localStorage and syncs here
   (JS/project_sync.js), so the app stays fast and works offline.

     GET    /api/me                      -> { email, admin }
     GET    /api/projects                -> { projects:[...], deleted:{id:deletedAt}, order:[...] }
     PUT    /api/projects/<id>           -> save one project (newer updatedAt wins)
     DELETE /api/projects/<id>           -> delete (kept as a tombstone so other
                                            devices drop their copy too)
     PUT    /api/projects-order          -> { order:[ids] } manual list order
     GET    /api/admin/projects          -> every user's projects (summary)
     GET    /api/admin/projects/<owner>/<id> -> one project in full

   Tables are created on first use (ensureSchema), so a fresh
   database needs no separate migration step.
   ============================================================ */

import ADMINS from './admins.js';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
const MAX_PROJECT_BYTES = 1024 * 1024;     // D1 rows top out at 2 MB; real projects are a few KB
const ID_RE = /^[A-Za-z0-9_.-]{1,100}$/;

let schemaReady = null;

function ensureSchema(db) {
    if (!schemaReady) {
        schemaReady = db.batch([
            db.prepare(`CREATE TABLE IF NOT EXISTS projects (
                owner      TEXT NOT NULL,
                id         TEXT NOT NULL,
                name       TEXT,
                data       TEXT NOT NULL,
                created_at TEXT,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                PRIMARY KEY (owner, id)
            )`),
            db.prepare('CREATE INDEX IF NOT EXISTS projects_by_updated ON projects (updated_at)'),
            db.prepare(`CREATE TABLE IF NOT EXISTS project_order (
                owner      TEXT PRIMARY KEY,
                ids        TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )`)
        ]).catch((err) => { schemaReady = null; throw err; });
    }
    return schemaReady;
}

function json(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function isAdmin(email) {
    return !!email && ADMINS.some((a) => String(a).trim().toLowerCase() === email);
}

async function readJson(request) {
    const text = await request.text();
    if (text.length > MAX_PROJECT_BYTES) return { error: 'too large' };
    try {
        return { value: JSON.parse(text) };
    } catch (e) {
        return { error: 'invalid JSON' };
    }
}

function iso(v, fallback) {
    const s = String(v || '');
    return isNaN(Date.parse(s)) ? fallback : new Date(s).toISOString();
}

async function listOwn(db, email) {
    const rows = await db.prepare(
        'SELECT id, data, updated_at, deleted_at FROM projects WHERE owner = ?'
    ).bind(email).all();
    const projects = [], deleted = {};
    for (const r of rows.results) {
        if (r.deleted_at) deleted[r.id] = r.deleted_at;
        else projects.push(JSON.parse(r.data));
    }
    const ord = await db.prepare('SELECT ids FROM project_order WHERE owner = ?').bind(email).first();
    return json({ projects, deleted, order: ord ? JSON.parse(ord.ids) : [] });
}

async function saveOwn(db, email, id, request) {
    const body = await readJson(request);
    if (body.error) return json({ error: body.error }, 400);
    const p = body.value;
    if (!p || typeof p !== 'object' || p.id !== id) return json({ error: 'project id mismatch' }, 400);
    const now = new Date().toISOString();
    const updated = iso(p.updatedAt, now);
    const created = iso(p.createdAt, updated);
    // Newer wins: an older copy arriving late (another tab, a device that
    // was offline) never overwrites a newer save.
    const res = await db.prepare(
        `INSERT INTO projects (owner, id, name, data, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)
         ON CONFLICT (owner, id) DO UPDATE SET
            name = excluded.name, data = excluded.data, updated_at = excluded.updated_at,
            deleted_at = NULL
         WHERE excluded.updated_at >= projects.updated_at
           AND (projects.deleted_at IS NULL OR excluded.updated_at > projects.deleted_at)`
    ).bind(email, id, String(p.name || '').slice(0, 300), JSON.stringify(p), created, updated).run();
    return json({ saved: res.meta.changes > 0 });
}

async function deleteOwn(db, email, id) {
    const now = new Date().toISOString();
    await db.prepare(
        `INSERT INTO projects (owner, id, name, data, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, '', '{}', ?3, ?3, ?3)
         ON CONFLICT (owner, id) DO UPDATE SET deleted_at = ?3, data = '{}', name = ''`
    ).bind(email, id, now).run();
    return json({ deleted: true });
}

async function saveOrder(db, email, request) {
    const body = await readJson(request);
    if (body.error) return json({ error: body.error }, 400);
    const ids = Array.isArray(body.value && body.value.order) ? body.value.order : null;
    if (!ids || !ids.every((x) => typeof x === 'string' && ID_RE.test(x))) {
        return json({ error: 'order must be a list of project ids' }, 400);
    }
    await db.prepare(
        `INSERT INTO project_order (owner, ids, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (owner) DO UPDATE SET ids = excluded.ids, updated_at = excluded.updated_at`
    ).bind(email, JSON.stringify(ids), new Date().toISOString()).run();
    return json({ saved: true });
}

async function adminList(db) {
    const rows = await db.prepare(
        `SELECT owner, id, name, data, created_at, updated_at FROM projects
         WHERE deleted_at IS NULL ORDER BY owner, updated_at DESC`
    ).all();
    return json({
        projects: rows.results.map((r) => {
            let items = 0, engineer = null;
            try {
                const d = JSON.parse(r.data);
                items = Array.isArray(d.items) ? d.items.length : 0;
                engineer = d.engineer || null;
            } catch (e) { /* summary only */ }
            return { owner: r.owner, id: r.id, name: r.name, items, engineer,
                     createdAt: r.created_at, updatedAt: r.updated_at };
        })
    });
}

async function adminGet(db, owner, id) {
    const r = await db.prepare(
        'SELECT data FROM projects WHERE owner = ? AND id = ? AND deleted_at IS NULL'
    ).bind(owner, id).first();
    return r ? json({ owner, project: JSON.parse(r.data) }) : json({ error: 'not found' }, 404);
}

/**
 * Handle /api/me, /api/projects*, /api/admin/*. Returns null for any
 * other path so the caller can carry on. `email` is the verified,
 * lower-cased Access identity (null when unverified).
 */
export async function handleProjects(request, env, pathname, email) {
    const method = request.method;
    if (pathname === '/api/me') {
        if (!email) return json({ error: 'not signed in' }, 401);
        return json({ email, admin: isAdmin(email) });
    }

    const own = pathname === '/api/projects' || pathname.startsWith('/api/projects/') ||
                pathname === '/api/projects-order';
    const admin = pathname.startsWith('/api/admin/');
    if (!own && !admin) return null;

    if (!email) return json({ error: 'not signed in' }, 401);
    if (!env.DB) return json({ error: 'project storage is not configured' }, 503);
    await ensureSchema(env.DB);

    if (pathname === '/api/projects' && method === 'GET') return listOwn(env.DB, email);
    if (pathname === '/api/projects-order' && method === 'PUT') return saveOrder(env.DB, email, request);
    if (pathname.startsWith('/api/projects/')) {
        const id = decodeURIComponent(pathname.slice('/api/projects/'.length));
        if (!ID_RE.test(id)) return json({ error: 'bad project id' }, 400);
        if (method === 'PUT') return saveOwn(env.DB, email, id, request);
        if (method === 'DELETE') return deleteOwn(env.DB, email, id);
    }
    if (admin) {
        if (!isAdmin(email)) return json({ error: 'not found' }, 404);
        if (pathname === '/api/admin/projects' && method === 'GET') return adminList(env.DB);
        const m = /^\/api\/admin\/projects\/([^/]+)\/([^/]+)$/.exec(pathname);
        if (m && method === 'GET') return adminGet(env.DB, decodeURIComponent(m[1]), decodeURIComponent(m[2]));
    }
    return json({ error: 'not found' }, 404);
}
