/* ============================================================
   HHpro - Feedback button (bug reports / feature requests)
   ------------------------------------------------------------
   A "Feedback" button in the site header opens a short form:
   type, description and up to three files (screenshots). The
   page the person was on - view, product, filter settings, site
   version, screen size and browser - is attached automatically so
   reports can be reproduced. Sent to server/feedback.js, which
   saves it and emails H&H (server/recipients.js "feedback").

     HHpro.Feedback.createButton()  - header button (main.js, ui.js)
     HHpro.Views.feedback_admin     - all feedback (admins)
   ============================================================ */

(function () {
    'use strict';
    window.HHpro = window.HHpro || {};
    HHpro.Views = HHpro.Views || {};

    var TYPES = ['Bug', 'Feature request', 'Data issue', 'Other'];
    var MAX_FILES = 3;
    var MAX_FILE_BYTES = 10 * 1024 * 1024;

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    function api(path, opts) {
        return fetch(path, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, opts || {}))
            .then(function (res) {
                return res.json().catch(function () { return {}; }).then(function (body) {
                    if (!res.ok) throw new Error(body.error || ('HTTP ' + res.status));
                    return body;
                });
            });
    }

    function fmtSize(n) {
        return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
    }

    /** What the person was looking at, for reproducing the report. */
    function captureContext() {
        var cur = (HHpro.App && HHpro.App.current) || {};
        var ctx = { page: cur.view || '' };
        var key = cur.params && cur.params.productKey;
        if (key && HHpro.Data && HHpro.Data.getProduct) {
            var p = HHpro.Data.getProduct(key);
            ctx.product = (p ? p.displayName : key) + ' (' + key + ')';
        }
        var filters = [];
        Array.prototype.forEach.call(document.querySelectorAll('.filter-bar .filter-group'), function (g) {
            var lab = g.querySelector('.filter-label');
            var input = g.querySelector('select, input');
            if (!lab || !input || !input.value || input.value === '__all__') return;
            filters.push(lab.textContent.trim() + ' = ' + input.value);
        });
        if (filters.length) ctx.filters = filters.join('; ');
        var s = document.querySelector('script[src*="app.js"]');
        var m = s && /[?&]v=([\w.-]+)/.exec(s.getAttribute('src'));
        if (m) ctx.version = m[1];
        ctx.screen = window.innerWidth + ' x ' + window.innerHeight;
        ctx.browser = navigator.userAgent;
        return ctx;
    }

    // ------------------------------------------------------------
    // Form
    // ------------------------------------------------------------

    function openForm() {
        var context = captureContext();
        var files = [];

        var backdrop = el('div', 'modal-backdrop');
        var modal = el('div', 'modal fb-modal');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.appendChild(el('h2', 'modal-title', 'Send feedback'));
        modal.appendChild(el('p', 'modal-desc',
            'Report a problem, flag a data issue, or ask for something new. The page you are on is included automatically.'));

        var typeWrap = el('div', 'fb-types');
        var chosen = 'Bug';
        TYPES.forEach(function (t) {
            var b = el('button', 'fb-type' + (t === chosen ? ' is-active' : ''), t);
            b.type = 'button';
            b.addEventListener('click', function () {
                chosen = t;
                Array.prototype.forEach.call(typeWrap.children, function (c) { c.classList.toggle('is-active', c === b); });
            });
            typeWrap.appendChild(b);
        });
        modal.appendChild(typeWrap);

        var text = el('textarea', 'modal-input fb-text');
        text.rows = 6;
        text.maxLength = 8000;
        text.placeholder = 'What happened, or what would you like to see? For bugs, what did you expect instead?';
        modal.appendChild(text);

        var fileInput = el('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'image/*,.pdf,.xlsx,.xls,.csv,.txt,.docx';
        fileInput.hidden = true;
        var fileList = el('ul', 'fb-files');
        var fileErr = el('p', 'fb-error');
        var addFile = el('button', 'modal-btn modal-btn-secondary fb-add', 'Attach screenshot or file');
        addFile.type = 'button';
        addFile.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
            fileErr.textContent = '';
            Array.prototype.forEach.call(fileInput.files, function (f) {
                if (files.length >= MAX_FILES) { fileErr.textContent = 'At most ' + MAX_FILES + ' files.'; return; }
                if (f.size > MAX_FILE_BYTES) { fileErr.textContent = f.name + ' is larger than 10 MB.'; return; }
                files.push(f);
            });
            fileInput.value = '';
            drawFiles();
        });
        function drawFiles() {
            fileList.innerHTML = '';
            files.forEach(function (f, i) {
                var li = el('li', null, f.name + ' (' + fmtSize(f.size) + ') ');
                var x = el('button', 'fb-remove', '×');
                x.type = 'button';
                x.title = 'Remove';
                x.addEventListener('click', function () { files.splice(i, 1); drawFiles(); });
                li.appendChild(x);
                fileList.appendChild(li);
            });
        }
        modal.appendChild(fileInput);
        modal.appendChild(addFile);
        modal.appendChild(fileList);
        modal.appendChild(fileErr);

        var ctxNote = el('details', 'fb-context');
        ctxNote.appendChild(el('summary', null, 'Included with your feedback'));
        var dl = el('dl');
        [['Page', context.page], ['Product', context.product], ['Filters', context.filters],
         ['Site version', context.version], ['Screen', context.screen]].forEach(function (r) {
            if (!r[1]) return;
            dl.appendChild(el('dt', null, r[0]));
            dl.appendChild(el('dd', null, r[1]));
        });
        ctxNote.appendChild(dl);
        modal.appendChild(ctxNote);

        var status = el('p', 'fb-status');
        status.setAttribute('role', 'status');
        modal.appendChild(status);

        var actions = el('div', 'modal-actions');
        var cancel = el('button', 'modal-btn modal-btn-secondary', 'Cancel');
        cancel.type = 'button';
        var send = el('button', 'modal-btn modal-btn-primary', 'Send');
        send.type = 'button';
        actions.appendChild(cancel);
        actions.appendChild(send);
        modal.appendChild(actions);

        function close() {
            document.removeEventListener('keydown', onKey);
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        }
        function onKey(e) { if (e.key === 'Escape') close(); }
        cancel.addEventListener('click', close);
        backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
        document.addEventListener('keydown', onKey);

        send.addEventListener('click', function () {
            var message = text.value.trim();
            if (!message) { text.focus(); status.className = 'fb-status is-error'; status.textContent = 'Please add a description.'; return; }
            send.disabled = cancel.disabled = true;
            status.className = 'fb-status';
            status.textContent = 'Sending…';
            var id;
            api('api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ type: chosen, message: message, context: context }) })
                .then(function (res) {
                    id = res.id;
                    return files.reduce(function (p, f) {
                        return p.then(function () {
                            return api('api/feedback/' + id + '/files/' + encodeURIComponent(f.name), {
                                method: 'PUT', headers: { 'Content-Type': f.type || 'application/octet-stream' }, body: f
                            });
                        });
                    }, Promise.resolve());
                })
                .then(function () { return api('api/feedback/' + id + '/submit', { method: 'POST' }); })
                .then(function () {
                    status.textContent = 'Thanks - your feedback was sent.';
                    setTimeout(close, 1400);
                })
                .catch(function (err) {
                    send.disabled = cancel.disabled = false;
                    status.className = 'fb-status is-error';
                    status.textContent = 'Could not send: ' + err.message;
                });
        });

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        text.focus();
    }

    // ------------------------------------------------------------
    // Admin list
    // ------------------------------------------------------------

    function fmtDate(iso) {
        var d = new Date(iso);
        return isNaN(d) ? '—' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    }

    HHpro.Views.feedback_admin = {
        render: function (root) {
            root.innerHTML = '';
            if (HHpro.Cart && typeof HHpro.Cart.init === 'function') HHpro.Cart.init();
            root.appendChild(HHpro.UI.buildHeader('Feedback'));
            var main = el('main', 'app-main ahu-page');
            var top = el('div', 'ahu-topbar');
            top.appendChild(el('h1', 'ahu-title', 'Feedback'));
            var back = el('button', 'ahu-btn');
            back.type = 'button';
            back.appendChild(HHpro.UI.icon('folder'));
            back.appendChild(el('span', null, 'All saved projects'));
            back.addEventListener('click', function () { HHpro.App.showView('admin'); });
            top.appendChild(back);
            main.appendChild(top);
            var holder = el('div');
            main.appendChild(holder);
            root.appendChild(main);
            if (!(HHpro.ProjectSync && HHpro.ProjectSync.isAdmin())) {
                holder.appendChild(el('p', 'ahu-hint', 'This page is only available to administrators.'));
                return;
            }
            holder.appendChild(el('p', 'ahu-hint', 'Loading…'));
            api('api/admin/feedback').then(function (res) {
                holder.innerHTML = '';
                holder.appendChild(table(res.feedback || [], res.statuses || []));
            }, function () {
                holder.innerHTML = '';
                holder.appendChild(el('p', 'ahu-error', 'Could not load feedback.'));
            });
        }
    };

    function table(list, statuses) {
        if (!list.length) return el('p', 'ahu-hint', 'No feedback yet.');
        var t = el('table', 'ahu-table fb-table');
        var head = el('tr');
        ['Submitted', 'From', 'Type', 'Feedback', 'Where', 'Email', 'Status'].forEach(function (h) { head.appendChild(el('th', null, h)); });
        var thead = el('thead'); thead.appendChild(head); t.appendChild(thead);
        var tbody = el('tbody');
        list.forEach(function (f) {
            var tr = el('tr');
            tr.appendChild(el('td', null, fmtDate(f.submittedAt)));
            tr.appendChild(el('td', null, f.owner));
            tr.appendChild(el('td', null, f.type));
            var msg = el('td', 'fb-message');
            msg.appendChild(el('div', null, f.message));
            (f.files || []).forEach(function (file) {
                var a = el('a', 'fb-file-link', file.name + ' (' + fmtSize(file.size) + ')');
                a.href = 'api/feedback/' + f.id + '/files/' + encodeURIComponent(file.name);
                a.setAttribute('download', file.name);
                msg.appendChild(a);
            });
            tr.appendChild(msg);
            var c = f.context || {};
            var where = el('td', 'fb-where');
            [c.product || c.page, c.filters, c.version ? 'v ' + c.version : '', c.screen].forEach(function (x) {
                if (x) where.appendChild(el('div', null, x));
            });
            if (c.browser) where.title = c.browser;
            tr.appendChild(where);
            var em = el('td', null, f.emailStatus || '—');
            if (f.emailError) em.title = f.emailError;
            tr.appendChild(em);
            var st = el('td');
            var sel = el('select', 'ahu-input ahu-status-select');
            statuses.forEach(function (s) { var o = el('option', null, s); o.value = s; sel.appendChild(o); });
            sel.value = f.status;
            sel.addEventListener('change', function () {
                api('api/admin/feedback/' + f.id + '/status', {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: sel.value })
                }).catch(function (e) { alert('Could not update the status: ' + e.message); sel.value = f.status; });
            });
            st.appendChild(sel);
            tr.appendChild(st);
            tbody.appendChild(tr);
        });
        t.appendChild(tbody);
        return t;
    }

    HHpro.Feedback = {
        open: openForm,
        captureContext: captureContext,
        /** Header button - added next to Log out in both headers. */
        createButton: function () {
            var btn = el('button', 'header-action');
            btn.type = 'button';
            btn.title = 'Report a problem or request a feature';
            btn.appendChild(HHpro.UI.icon('file-plus'));
            btn.appendChild(el('span', null, 'Feedback'));
            btn.addEventListener('click', openForm);
            return btn;
        }
    };
})();
