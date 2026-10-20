/* ============================================================
   HHpro - Project sync (HHpro.ProjectSync)
   ------------------------------------------------------------
   Keeps the browser's saved projects (localStorage, see cart.js)
   in step with the server copy (D1, see server/projects.js).

   localStorage stays the working copy, so every screen reads and
   writes projects exactly as before and the app keeps working
   offline. This module only:

     - on page load (init): pulls the server copy and merges it
       with the local one - newer updatedAt wins, projects that
       exist only locally are uploaded (which is also how each
       person's existing browser projects reach the server the
       first time they sign in), projects deleted on another
       device are dropped here;
     - after every save (notify, called by cart.js): pushes what
       changed since the last successful sync, a moment later.

   "What changed" is worked out against a baseline - the
   updatedAt of each project as the server last confirmed it -
   kept in localStorage so edits made offline are still pushed
   after a reload.

   Projects belong to the signed-in email. If a different person
   signs in on the same browser, the previous person's local copy
   is replaced by the new person's server copy rather than being
   uploaded under the wrong name.

   Without the Worker (e.g. the site opened from a plain local web
   server) /api/me fails, sync stays off and the app behaves as it
   always did: browser-only storage.
   ============================================================ */

(function () {
    'use strict';
    window.HHpro = window.HHpro || {};

    var PROJECTS_KEY = 'hhpro_projects';
    var ORDER_KEY = 'hhpro_projects_order';
    var BASELINE_KEY = 'hhpro_sync_baseline';  // { projects:{id:updatedAt}, order:'[...]' }
    var OWNER_KEY = 'hhpro_sync_owner';

    var PUSH_DELAY_MS = 1500;
    var RETRY_DELAY_MS = 30000;
    var INIT_TIMEOUT_MS = 6000;

    var me = null;          // { email, admin } once signed in and synced
    var enabled = false;
    var timer = null;
    var queue = null;       // promise chain: one sync pass at a time
    var lastError = null;

    // -----------------------------------------------------------------
    // Storage helpers
    // -----------------------------------------------------------------
    function readJSON(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) { return fallback; }
    }
    function writeJSON(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* full / blocked */ }
    }
    function readBaseline() {
        var b = readJSON(BASELINE_KEY, null);
        return (b && typeof b === 'object')
            ? { projects: b.projects || {}, order: b.order || '[]' }
            : { projects: {}, order: '[]' };
    }

    function api(method, path, body) {
        var opts = {
            method: method,
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'Accept': 'application/json' }
        };
        if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        return fetch(path, opts).then(function (res) {
            // An expired Access session answers with a redirect to the
            // sign-in page; fetch follows it cross-origin and fails, or
            // lands on HTML. Either way it isn't our JSON.
            var type = res.headers.get('Content-Type') || '';
            if (!res.ok || type.indexOf('application/json') === -1) {
                var err = new Error('sync ' + method + ' ' + path + ' -> ' + res.status);
                err.status = res.status;
                throw err;
            }
            return res.json();
        });
    }

    function withTimeout(promise, ms) {
        return new Promise(function (resolve, reject) {
            var t = setTimeout(function () { reject(new Error('sync timed out')); }, ms);
            promise.then(function (v) { clearTimeout(t); resolve(v); },
                         function (e) { clearTimeout(t); reject(e); });
        });
    }

    // -----------------------------------------------------------------
    // Initial merge
    // -----------------------------------------------------------------
    function stamp(p) { return String((p && p.updatedAt) || ''); }

    function merge(server) {
        var storedOwner = readJSON(OWNER_KEY, null);
        var sameOwner = !storedOwner || storedOwner === me.email;

        var local = sameOwner ? readJSON(PROJECTS_KEY, {}) : {};
        var localOrder = sameOwner ? readJSON(ORDER_KEY, []) : [];
        var base = sameOwner ? readBaseline() : { projects: {}, order: '[]' };
        if (!local || typeof local !== 'object') local = {};

        var serverById = {};
        (server.projects || []).forEach(function (p) { if (p && p.id) serverById[p.id] = p; });
        var deleted = server.deleted || {};

        var result = {};
        var baseline = {};

        Object.keys(serverById).forEach(function (id) {
            var s = serverById[id], l = local[id];
            baseline[id] = stamp(s);
            if (!l) {
                // Gone locally. If it was synced and the server copy hasn't
                // moved since, it was deleted here while offline: leave it
                // out, and the flush below deletes it on the server. Anything
                // else is new from another device - take it.
                var wasSynced = base.projects[id] !== undefined;
                if (!(wasSynced && base.projects[id] >= stamp(s))) result[id] = s;
            } else {
                result[id] = stamp(l) > stamp(s) ? l : s;     // newer wins; flush pushes local
            }
        });
        Object.keys(local).forEach(function (id) {
            if (serverById[id]) return;
            var l = local[id];
            // Deleted on another device: drop it here, unless it was edited
            // locally after that delete (then it is uploaded again).
            if (deleted[id] && !(stamp(l) > String(deleted[id]))) return;
            result[id] = l;                                   // flush uploads it
        });

        var serverOrder = Array.isArray(server.order) ? server.order : [];
        var order = (serverOrder.length || !localOrder.length) ? serverOrder : localOrder;

        writeJSON(PROJECTS_KEY, result);
        writeJSON(ORDER_KEY, order);
        writeJSON(BASELINE_KEY, { projects: baseline, order: JSON.stringify(serverOrder) });
        writeJSON(OWNER_KEY, me.email);
    }

    function init() {
        if (!window.fetch || !window.Promise || location.protocol === 'file:') {
            return Promise.resolve(null);
        }
        return withTimeout(api('GET', 'api/me'), INIT_TIMEOUT_MS)
            .then(function (who) {
                me = { email: String(who.email || '').toLowerCase(), admin: !!who.admin,
                       internal: !!who.internal };
                if (!me.email) throw new Error('no identity');
                return withTimeout(api('GET', 'api/projects'), INIT_TIMEOUT_MS);
            })
            .then(function (server) {
                merge(server);
                enabled = true;
                flush();
                return me;
            })
            .catch(function (err) {
                // No Worker, signed out, offline or storage not configured:
                // carry on with browser-only storage.
                lastError = err;
                enabled = false;
                if (window.console) console.warn('HHpro project sync unavailable:', err && err.message);
                return me;   // identity may still be known (e.g. storage not configured)
            });
    }

    // -----------------------------------------------------------------
    // Push changes
    // -----------------------------------------------------------------
    function notify() {
        if (!enabled) return;
        clearTimeout(timer);
        timer = setTimeout(flush, PUSH_DELAY_MS);
    }

    /**
     * Push everything that differs from the baseline. Passes run one at a
     * time; a call made while one is running queues another, and the
     * returned promise settles when that pass is done (each pass reads the
     * current state, so a queued pass with nothing left to do is free).
     */
    function flush() {
        if (!enabled) return Promise.resolve();
        queue = (queue || Promise.resolve()).then(syncPass);
        return queue;
    }

    function syncPass() {
        var local = readJSON(PROJECTS_KEY, {}) || {};
        var base = readBaseline();
        var tasks = [];

        Object.keys(local).forEach(function (id) {
            var p = local[id];
            if (base.projects[id] === stamp(p)) return;
            tasks.push(function () {
                return api('PUT', 'api/projects/' + encodeURIComponent(id), p).then(function () {
                    var b = readBaseline();
                    b.projects[id] = stamp(p);
                    writeJSON(BASELINE_KEY, b);
                });
            });
        });
        Object.keys(base.projects).forEach(function (id) {
            if (local[id]) return;
            tasks.push(function () {
                return api('DELETE', 'api/projects/' + encodeURIComponent(id)).then(function () {
                    var b = readBaseline();
                    delete b.projects[id];
                    writeJSON(BASELINE_KEY, b);
                });
            });
        });
        var order = JSON.stringify(readJSON(ORDER_KEY, []) || []);
        if (order !== base.order) {
            tasks.push(function () {
                return api('PUT', 'api/projects-order', { order: JSON.parse(order) }).then(function () {
                    var b = readBaseline();
                    b.order = order;
                    writeJSON(BASELINE_KEY, b);
                });
            });
        }

        // One at a time, so a failure stops cleanly and the rest retry later.
        var chain = tasks.reduce(function (p, task) { return p.then(task); }, Promise.resolve());
        return chain.then(function () {
            lastError = null;
        }, function (err) {
            lastError = err;
            clearTimeout(timer);
            timer = setTimeout(flush, RETRY_DELAY_MS);
        });
    }

    // Last chance to push when the tab is closed or hidden.
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden' && enabled) {
            clearTimeout(timer);
            flush();
        }
    });

    HHpro.ProjectSync = {
        init: init,
        notify: notify,
        flush: flush,
        isEnabled: function () { return enabled; },
        /** { email, admin, internal } for the signed-in user, or null. */
        me: function () { return me; },
        isAdmin: function () { return !!(me && me.admin); },
        /** H&H staff - may see internal-only sections (server/firm-access.js). */
        isInternal: function () { return !!(me && me.internal); },
        lastError: function () { return lastError; }
    };
})();
