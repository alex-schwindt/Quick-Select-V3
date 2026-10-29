/* ============================================================
   HHpro - Admin view (all users' saved projects)
   ------------------------------------------------------------
   Lists every saved project on the server, newest first within
   each person. Reachable from the overview header, and only
   shown to admins (server/admins.js) - the server enforces it
   too: /api/admin/* answers 404 for everyone else.

   Read-only by design. "Copy to my projects" pulls a full copy
   into the admin's own project list, where the normal Projects /
   View Project screens open it. Editing that copy never touches
   the original user's project.
   ============================================================ */

(function () {
    'use strict';
    window.HHpro = window.HHpro || {};
    HHpro.Views = HHpro.Views || {};

    var list = null;        // last fetched summary list
    var filterText = '';

    HHpro.Views.admin = {
        render: function (root) {
            root.innerHTML = '';
            if (HHpro.Cart && typeof HHpro.Cart.init === 'function') HHpro.Cart.init();
            root.appendChild(HHpro.UI.buildHeader('Admin'));

            var main = document.createElement('main');
            main.className = 'app-main admin-view';
            root.appendChild(main);

            if (!(HHpro.ProjectSync && HHpro.ProjectSync.isAdmin())) {
                main.appendChild(message('This page is only available to administrators.'));
                return;
            }
            main.appendChild(message('Loading projects…'));
            load().then(function () { renderBody(main); }, function () {
                main.innerHTML = '';
                main.appendChild(message('Could not load projects. Check your connection and reload the page.'));
            });
        }
    };

    function load() {
        return fetch('api/admin/projects', { credentials: 'same-origin', cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error(res.status);
                return res.json();
            })
            .then(function (body) { list = body.projects || []; });
    }

    function message(text) {
        var p = document.createElement('p');
        p.className = 'admin-message';
        p.textContent = text;
        return p;
    }

    function engineerLabel(key) {
        if (!key || key === 'hoffman') return 'Hoffman & Hoffman';
        var e = (HHpro.Templates ? HHpro.Templates.listEngineers() : [])
            .filter(function (x) { return x.key === key; })[0];
        return e ? e.label : key;
    }

    function fmtDate(iso) {
        var d = new Date(iso);
        return isNaN(d) ? '—' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    }

    function renderBody(main) {
        main.innerHTML = '';

        var head = document.createElement('div');
        head.className = 'admin-titlebar';
        var h1 = document.createElement('h1');
        h1.className = 'admin-title';
        h1.textContent = 'All saved projects';
        head.appendChild(h1);
        var owners = {};
        list.forEach(function (p) { owners[p.owner] = true; });
        var count = document.createElement('span');
        count.className = 'admin-count';
        count.textContent = list.length + ' project' + (list.length === 1 ? '' : 's') + ' · ' +
            Object.keys(owners).length + ' user' + (Object.keys(owners).length === 1 ? '' : 's');
        head.appendChild(count);

        // Excel download of the projects currently listed (filter applied).
        var exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'admin-copy-btn admin-export-btn';
        exportBtn.title = 'Download the projects listed below as an Excel file';
        exportBtn.appendChild(HHpro.UI.icon('download'));
        var exportLbl = document.createElement('span');
        exportLbl.textContent = 'Export to Excel';
        exportBtn.appendChild(exportLbl);
        exportBtn.addEventListener('click', function () { exportXlsx(visibleRows(), exportBtn, status); });
        head.appendChild(exportBtn);
        main.appendChild(head);

        var search = document.createElement('input');
        search.type = 'search';
        search.className = 'admin-filter';
        search.placeholder = 'Filter by person or project name';
        search.setAttribute('aria-label', 'Filter projects');
        search.value = filterText;
        main.appendChild(search);

        var status = document.createElement('p');
        status.className = 'admin-status';
        status.setAttribute('role', 'status');
        main.appendChild(status);

        var wrap = document.createElement('div');
        wrap.className = 'admin-table-wrap';
        main.appendChild(wrap);

        function visibleRows() {
            var q = filterText.trim().toLowerCase();
            return list.filter(function (p) {
                return !q || p.owner.indexOf(q) !== -1 || String(p.name || '').toLowerCase().indexOf(q) !== -1;
            });
        }

        function draw() {
            wrap.innerHTML = '';
            var rows = visibleRows();
            if (!rows.length) {
                wrap.appendChild(message(list.length ? 'No projects match that filter.' : 'No projects have been saved yet.'));
                return;
            }
            wrap.appendChild(buildTable(rows, status));
        }
        search.addEventListener('input', function () { filterText = search.value; draw(); });
        draw();
    }

    function buildTable(rows, status) {
        var table = document.createElement('table');
        table.className = 'admin-table';
        var thead = document.createElement('thead');
        var hr = document.createElement('tr');
        ['Person', 'Project', 'Items', 'Schedule layout', 'Last saved', ''].forEach(function (t) {
            var th = document.createElement('th');
            th.textContent = t;
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);

        var tbody = document.createElement('tbody');
        rows.forEach(function (p) {
            var tr = document.createElement('tr');
            [p.owner, p.name || '(untitled)', String(p.items), engineerLabel(p.engineer), fmtDate(p.updatedAt)]
                .forEach(function (v, i) {
                    var td = document.createElement('td');
                    td.textContent = v;
                    if (i === 2) td.className = 'admin-num';
                    tr.appendChild(td);
                });
            var act = document.createElement('td');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'admin-copy-btn';
            btn.appendChild(HHpro.UI.icon('copy'));
            var lbl = document.createElement('span');
            lbl.textContent = 'Copy to my projects';
            btn.appendChild(lbl);
            btn.addEventListener('click', function () { copyProject(p, btn, status); });
            act.appendChild(btn);
            tr.appendChild(act);
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    // Excel export: one row per project, built with the schedule exporter's
    // xlsx writer (export.js) so the file matches the site's other downloads.
    function exportXlsx(rows, btn, status) {
        if (!rows.length) {
            status.textContent = 'No projects to export.';
            return;
        }
        if (!HHpro.Export || !HHpro.Export.xlsxBlobFromSections) {
            status.textContent = 'Excel export isn’t available on this page.';
            return;
        }
        function stamp(iso) {
            var d = new Date(iso);
            if (isNaN(d)) return '';
            function pad(n) { return (n < 10 ? '0' : '') + n; }
            return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
                ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
        }
        function productList(products) {
            return Object.keys(products || {}).sort().map(function (k) {
                var label = HHpro.Export.productTabLabel ? HHpro.Export.productTabLabel(k) : k;
                return label + ' (' + products[k] + ')';
            }).join(', ');
        }
        var headers = ['Account (Email)', 'Project', 'Schedule Layout', 'Items', 'Products', 'Created', 'Last Saved'];
        var data = rows.map(function (p) {
            return [p.owner, p.name || '(untitled)', engineerLabel(p.engineer), p.items,
                    productList(p.products), stamp(p.createdAt), stamp(p.updatedAt)];
        });
        var widths = headers.map(function (h, i) {
            return Math.min(60, Math.max(h.length, data.reduce(function (m, r) {
                return Math.max(m, String(r[i] == null ? '' : r[i]).length);
            }, 0)) + 2);
        });
        var grid = {
            rows: [headers.map(function (h) { return { value: h, bold: true }; })].concat(
                data.map(function (r) {
                    return r.map(function (v, i) { return { value: v, align: i === 3 ? null : 'left' }; });
                })),
            merges: [], titleRowCount: 0, numHeaderRows: 1, dataEndRow: data.length + 1,
            colCount: headers.length, colWidths: widths
        };
        btn.disabled = true;
        status.textContent = 'Preparing Excel file…';
        HHpro.Export.xlsxBlobFromSections([{ title: 'Projects', grid: grid }])
            .then(function (blob) {
                var d = new Date();
                var name = 'HHpro Projects ' + d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) +
                    '-' + ('0' + d.getDate()).slice(-2) + '.xlsx';
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
                status.textContent = 'Exported ' + rows.length + ' project' + (rows.length === 1 ? '' : 's') + '.';
            })
            .catch(function () { status.textContent = 'Could not build the Excel file.'; })
            .then(function () { btn.disabled = false; });
    }

    function copyProject(p, btn, status) {
        btn.disabled = true;
        status.textContent = 'Copying “' + (p.name || 'project') + '”…';
        fetch('api/admin/projects/' + encodeURIComponent(p.owner) + '/' + encodeURIComponent(p.id),
              { credentials: 'same-origin', cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error(res.status);
                return res.json();
            })
            .then(function (body) {
                var src = body.project || {};
                var who = p.owner.split('@')[0];
                var name = (src.name || 'Untitled') + ' (' + who + ')';
                var now = new Date().toISOString();
                HHpro.Cart.mergeImportedProjects([{
                    name: name,
                    items: src.items || [],
                    extra: src.extra || {},
                    engineer: src.engineer,
                    createdAt: now,
                    updatedAt: now
                }], { onConflict: 'rename' });
                status.textContent = 'Copied to your projects as “' + name + '”. Open it from Projects.';
            })
            .catch(function () {
                status.textContent = 'Could not copy that project. Try again.';
            })
            .then(function () { btn.disabled = false; });
    }
})();
