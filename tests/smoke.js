/* ============================================================
   HHpro - pre-push smoke test
   ------------------------------------------------------------
   Run from the project folder before pushing:

       node tests/smoke.js              full run (~3-5 min)
       node tests/smoke.js --no-build   skip build.sh (dist/ already current)
       node tests/smoke.js --only=vavs,fan_coils   just these products
       node tests/smoke.js --keep       leave the local server running after

   What it does:
     1. bash build.sh, then syntax-checks every site / Worker file and
        the index.html cache-bust versions and script / CSS paths.
     2. Starts the real Worker locally (npx wrangler dev, local D1 / R2,
        simulated email - nothing is sent and production data is never
        touched) signed in as the first admin in server/admins.js.
     3. Drives headless Edge (or Chrome) through:
        - home page tiles, header buttons, design search, calculators,
          projects, admin and design-request admin pages
        - every product page: data file sanity (ids, filters, dropdown
          columns, starting filters), first render, each value of the
          first filter (incl. the "dropdown locks itself" bug), the kW /
          heat-size dropdown, the airflow box, and every export (Excel,
          CAD, PDF file, PDF print page)
        - PDF layout: no text crossing a cell border (tests/pdf_layout_check.py,
          needs Python + PyMuPDF; skipped with a warning if missing)
        - a full Air Handler Design Request: form, configurator, attachment,
          submit, stored record, file download, simulated email
     4. Prints PASS / FAIL per check, writes .wrangler/smoke/report.txt
        (plus screenshots and PDFs of failures), exits 1 on any failure.

   Needs: Node 22+ (built-in fetch / WebSocket), Git Bash (build.sh),
   Microsoft Edge or Google Chrome. No npm packages.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.wrangler', 'smoke');
const STATE = path.join(ROOT, '.wrangler', 'smoke-state');
const SITE_PORT = 8788;
const CDP_PORT = 9335;
const SITE = `http://127.0.0.1:${SITE_PORT}`;

const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let currentGroup = '';

function record(ok, name, detail) {
    results.push({ ok, group: currentGroup, name, detail: detail || '' });
    const tag = ok === 'warn' ? 'WARN' : ok ? 'PASS' : 'FAIL';
    console.log(`  ${tag}  ${name}${detail ? ' - ' + detail : ''}`);
}
const pass = (n, d) => record(true, n, d);
const fail = (n, d) => record(false, n, d);
const warn = (n, d) => record('warn', n, d);
function group(name) { currentGroup = name; console.log(`\n== ${name}`); }

// ------------------------------------------------------------------ processes

const children = [];

function killTree(child) {
    if (!child || child.exitCode !== null) return;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
}

// Browsers and workerd outlive their launcher process, so on Windows also
// stop anything whose command line names this run's folders.
function killByCommandLine(fragment) {
    if (process.platform !== 'win32') return;
    const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${fragment.replace(/'/g, "''")}*' -and $_.ProcessId -ne ${process.pid} -and $_.ProcessId -ne $PID } | ` +
               `ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }`;
    spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' });
}

let cleaned = false;
function cleanup() {
    if (cleaned || flag('keep')) return;
    cleaned = true;
    children.forEach(killTree);
    killByCommandLine(path.join('.wrangler', 'smoke'));
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

function findBrowser() {
    const c = [
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge'
    ];
    return c.find((p) => fs.existsSync(p));
}

function firstAdmin() {
    const src = fs.readFileSync(path.join(ROOT, 'server', 'admins.js'), 'utf8');
    const m = /['"]([^'"\s]+@[^'"\s]+)['"]/.exec(src.replace(/\/\*[\s\S]*?\*\//g, ''));
    return m ? m[1] : 'smoke-test@example.com';
}

async function waitFor(fn, ms, every = 250) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        try { const v = await fn(); if (v) return v; } catch (e) { /* retry */ }
        await sleep(every);
    }
    return null;
}

async function startSite() {
    killByCommandLine(path.join('.wrangler', 'smoke-state'));   // a previous run left running
    fs.rmSync(STATE, { recursive: true, force: true });
    const log = fs.openSync(path.join(OUT, 'wrangler.log'), 'w');
    const cmd = `npx wrangler dev --port ${SITE_PORT} --ip 127.0.0.1 --persist-to "${STATE}" ` +
                `--var DEV_ACCESS_EMAIL:${firstAdmin()}`;
    const child = spawn(cmd, { cwd: ROOT, shell: true, stdio: ['ignore', log, log] });
    children.push(child);
    const ready = await waitFor(() => fs.readFileSync(path.join(OUT, 'wrangler.log'), 'utf8').includes('Ready on'), 120000, 500);
    if (!ready) throw new Error('wrangler dev did not start - see .wrangler/smoke/wrangler.log');
}

async function startBrowser() {
    const exe = findBrowser();
    if (!exe) throw new Error('No Edge or Chrome found');
    // Fresh profile per run (a leftover browser can still hold the old one)
    killByCommandLine(path.join('.wrangler', 'smoke', 'browser-profile'));
    fs.readdirSync(OUT).filter((d) => d.startsWith('browser-profile')).forEach((d) => {
        try { fs.rmSync(path.join(OUT, d), { recursive: true, force: true }); } catch (e) { /* still locked - skip */ }
    });
    const profile = path.join(OUT, 'browser-profile-' + Date.now());
    const child = spawn(exe, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
                              '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
    children.push(child);
    const targets = await waitFor(async () => {
        const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
        return list.find((t) => t.type === 'page');
    }, 30000);
    if (!targets) throw new Error('Browser did not open a debugging port');
    return targets;
}

// ------------------------------------------------------------------ CDP page

class Page {
    async open(target) {
        this.ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((r, j) => { this.ws.addEventListener('open', r); this.ws.addEventListener('error', j); });
        this.id = 0; this.pending = {}; this.errors = [];
        this.ws.addEventListener('message', (ev) => {
            const m = JSON.parse(ev.data);
            if (m.id && this.pending[m.id]) { this.pending[m.id](m); delete this.pending[m.id]; }
            if (m.method === 'Runtime.exceptionThrown') {
                const d = m.params.exceptionDetails;
                this.errors.push((d.exception && d.exception.description) || d.text);
            }
            if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
                this.errors.push('console.error: ' + m.params.args.map((a) => a.value || a.description).join(' '));
            }
        });
        for (const d of ['Runtime', 'Page', 'Network', 'DOM']) await this.send(d + '.enable');
        await this.send('Network.setCacheDisabled', { cacheDisabled: true });
        await this.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
    }
    send(method, params = {}) {
        return new Promise((r) => { const i = ++this.id; this.pending[i] = r; this.ws.send(JSON.stringify({ id: i, method, params })); });
    }
    async ev(expr) {
        const res = (await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result;
        if (res.exceptionDetails) {
            throw new Error((res.exceptionDetails.exception && res.exceptionDetails.exception.description) || res.exceptionDetails.text);
        }
        return res.result.value;
    }
    async goto(url) {
        await this.send('Page.navigate', { url });
        await waitFor(() => this.ev('document.readyState === "complete" && !!(window.HHpro && HHpro.App)'), 30000);
        await waitFor(() => this.ev('!!document.querySelector(".tile")'), 30000);
    }
    takeErrors() { const e = this.errors; this.errors = []; return e; }
    async shot(name) {
        try {
            const r = await this.send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(path.join(OUT, name.replace(/[^a-z0-9_-]+/gi, '_') + '.png'), Buffer.from(r.result.data, 'base64'));
        } catch (e) { /* best effort */ }
    }
}

// ------------------------------------------------------------------ 1. static checks

function staticChecks() {
    group('Build and static checks');
    if (!flag('no-build')) {
        const r = spawnSync('bash', ['build.sh'], { cwd: ROOT, encoding: 'utf8' });
        if (r.status === 0) pass('build.sh', (r.stdout.trim().split('\n').pop() || ''));
        else { fail('build.sh', (r.stderr || r.stdout || '').trim().slice(0, 300)); return false; }
    }

    const jsFiles = fs.readdirSync(path.join(ROOT, 'JS')).filter((f) => f.endsWith('.js'));
    const bad = [];
    jsFiles.forEach((f) => {
        try { new vm.Script(fs.readFileSync(path.join(ROOT, 'JS', f), 'utf8'), { filename: f }); }
        catch (e) { bad.push(`${f}: ${e.message}`); }
    });
    bad.length ? fail('site JS syntax', bad.join('; ')) : pass('site JS syntax', `${jsFiles.length} files`);

    const r = spawnSync(process.execPath, ['--input-type=module', '-e', "import('./worker/index.js')"], { cwd: ROOT, encoding: 'utf8' });
    r.status === 0 ? pass('Worker / server modules load') : fail('Worker / server modules load', (r.stderr || '').trim().slice(0, 300));

    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const versions = [...new Set([...html.matchAll(/\?v=([\w.-]+)/g)].map((m) => m[1]))];
    versions.length === 1 ? pass('index.html cache-bust versions match', versions[0])
                          : fail('index.html cache-bust versions match', versions.join(', '));
    const missing = [...html.matchAll(/(?:src|href)="((?:JS|CSS)\/[^"?]+)/g)].map((m) => m[1])
        .filter((p) => !fs.existsSync(path.join(ROOT, 'dist', p)));
    missing.length ? fail('index.html files exist in dist/', missing.join(', ')) : pass('index.html files exist in dist/');

    const big = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
        const p = path.join(dir, d.name);
        if (d.isDirectory()) walk(p); else if (fs.statSync(p).size > 25 * 1024 * 1024) big.push(path.relative(ROOT, p));
    });
    walk(path.join(ROOT, 'dist'));
    big.length ? fail('no dist/ file over the 25 MiB Cloudflare limit', big.join(', ')) : pass('no dist/ file over the 25 MiB Cloudflare limit');
    return true;
}

// ------------------------------------------------------------------ 2. pages

async function homeAndPages(page) {
    group('Home page and other pages');
    await page.goto(SITE + '/');
    const home = await page.ev(`({
        tiles: document.querySelectorAll('.tile').length,
        comingSoonClickable: [...document.querySelectorAll('.tile-coming-soon')].filter(t => !t.disabled).length,
        header: [...document.querySelectorAll('.header-actions .header-action')].map(b => b.textContent.trim())
    })`);
    home.tiles > 5 ? pass('home tiles render', `${home.tiles} tiles`) : fail('home tiles render', `${home.tiles} tiles`);
    home.comingSoonClickable ? fail('coming-soon tiles are disabled', `${home.comingSoonClickable} clickable`) : pass('coming-soon tiles are disabled');
    home.header.includes('Log out') ? pass('header buttons', home.header.join(', ')) : fail('header buttons', home.header.join(', '));
    let errs = page.takeErrors();
    errs.length ? fail('home page has no JS errors', errs[0]) : pass('home page has no JS errors');

    const views = [['design_search', '.design-search-form, .design-filter-grid, main'], ['calculators', '.calc-card'],
                   ['psychrometrics', 'main'], ['dewpoint', 'main'], ['projects', 'main'],
                   ['admin', '.admin-title, .admin-message'], ['ahu_admin', '.ahu-table, .ahu-hint']];
    for (const [view, sel] of views) {
        try {
            await page.ev(`HHpro.App.showView('${view}')`);
            const ok = await waitFor(() => page.ev(`!!document.querySelector(${JSON.stringify(sel)})`), 15000);
            await sleep(500);
            errs = page.takeErrors();
            if (!ok) { fail(`${view} page renders`, 'nothing rendered'); await page.shot('fail_' + view); }
            else if (errs.length) { fail(`${view} page renders`, errs[0]); await page.shot('fail_' + view); }
            else pass(`${view} page renders`);
        } catch (e) { fail(`${view} page renders`, e.message); }
    }
}

// ------------------------------------------------------------------ 3. products

const PRODUCT_DATA_CHECK = `async (key) => {
    const p = HHpro.Data.getProduct(key), data = await HHpro.Data.loadProduct(key);
    const out = { problems: [], n: data.selections.length };
    const ids = new Set(), letters = (data.scheduleHeader && data.scheduleHeader.columnLetters) || [];
    const filters = (data.filterColumns || []).map(f => f.name);
    let dup = 0;
    data.selections.forEach(s => { if (ids.has(s.id)) dup++; ids.add(s.id); });
    if (!out.n) out.problems.push('no selections');
    if (dup) out.problems.push(dup + ' duplicate selection ids');
    const kw = p.kwVariants;
    if (kw) [kw.variantColumn].concat(kw.dependentColumns || []).forEach(c => {
        if (letters.indexOf(c) < 0) out.problems.push('kwVariants column ' + c + ' not in the schedule');
    });
    if (kw && kw.filterName && filters.indexOf(kw.filterName) < 0) out.problems.push('kwVariants filterName ' + kw.filterName + ' is not a filter');
    Object.keys(p.initialFilters || {}).forEach(n => {
        if (filters.indexOf(n) < 0) out.problems.push('initialFilters ' + n + ' is not a filter');
        else if (!data.selections.some(s => String((s.rows[0].filterData || {})[n]) === String(p.initialFilters[n])))
            out.problems.push('initialFilters ' + n + '=' + p.initialFilters[n] + ' matches no rows');
    });
    if (p.nearestFilter) {
        if (letters.indexOf(p.nearestFilter.column) < 0) out.problems.push('nearestFilter column not in the schedule');
        (p.nearestFilter.groupFilters || []).forEach(n => { if (filters.indexOf(n) < 0) out.problems.push('nearestFilter group ' + n + ' is not a filter'); });
    }
    return out;
}`;

async function productChecks(page) {
    const products = await page.ev(`HHpro.Data.getProducts()
        .filter(p => p.jsonFile && !p.comingSoon && !p.view)
        .map(p => ({ key: p.productKey, name: p.displayName }))`);
    const todo = products.filter((p) => !only.length || only.includes(p.key));
    const pdfSections = [];

    for (const p of todo) {
        group(`Product: ${p.name} (${p.key})`);
        page.takeErrors();
        // data file
        let info;
        try {
            info = await page.ev(`(${PRODUCT_DATA_CHECK})('${p.key}')`);
            info.problems.length ? fail('data file', info.problems.join('; ')) : pass('data file', `${info.n} selections`);
        } catch (e) { fail('data file loads', e.message); continue; }

        // first render
        await page.ev(`HHpro.App.showView('product', { productKey: '${p.key}' })`);
        const rows = await waitFor(() => page.ev(`document.querySelectorAll('.schedule-wrap tbody tr, tbody tr').length`), 45000);
        let errs = page.takeErrors();
        if (!rows) { fail('page renders rows', 'no rows'); await page.shot('fail_' + p.key); continue; }
        errs.length ? fail('page renders without JS errors', errs[0]) : pass('page renders', `${rows} rows`);

        // first filter: each value renders rows and the dropdown keeps its options
        const f = await page.ev(`(() => { const g = document.querySelector('.filter-bar .filter-group select'); if (!g) return null;
            const lab = g.closest('.filter-group').querySelector('.filter-label').textContent.trim();
            return { label: lab, opts: [...g.options].map(o => o.value).filter(v => v !== '__all__') }; })()`);
        if (f && f.opts.length > 1) {
            const picks = f.opts.slice(0, 4);
            const problems = [];
            for (const v of picks) {
                await page.ev(`(() => { const s = document.querySelector('.filter-bar .filter-group select'); s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
                const n = await waitFor(() => page.ev(`document.querySelectorAll('tbody tr').length`), 30000);
                const after = await page.ev(`[...document.querySelector('.filter-bar .filter-group select').options].map(o => o.value).filter(v => v !== '__all__')`);
                if (!n) problems.push(`"${v}" shows no rows`);
                const lost = f.opts.filter((o) => after.indexOf(o) < 0);
                if (lost.length) problems.push(`after picking "${v}" the ${f.label} dropdown lost ${lost.length} option(s), e.g. "${lost[0]}"`);
            }
            await page.ev(`(document.querySelector('.filter-clear') || { click() {} }).click()`);
            await sleep(300);
            errs = page.takeErrors();
            if (errs.length) problems.push(errs[0]);
            problems.length ? fail(`${f.label} filter`, problems.join('; '))
                            : pass(`${f.label} filter`, `${picks.length} of ${f.opts.length} values tried`);
        }

        // kW / heat-size dropdown
        const kw = await page.ev(`(() => { const s = [...document.querySelectorAll('.kw-variant-select')].find(x => x.options.length > 1);
            if (!s) return null; const tr = s.closest('tr'); const before = tr.textContent;
            s.value = String(s.options.length - 1); s.dispatchEvent(new Event('change')); return { changed: tr.textContent !== before, n: s.options.length }; })()`);
        if (kw) {
            errs = page.takeErrors();
            kw.changed && !errs.length ? pass('variant dropdown updates its row', `${kw.n} options`)
                                       : fail('variant dropdown updates its row', errs[0] || 'row did not change');
        }

        // nearest-value (airflow) box
        if (await page.ev(`!!document.querySelector('.filter-number')`)) {
            await page.ev(`(() => { const i = document.querySelector('.filter-number'); i.value = '600'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
            await sleep(1200);
            const n = await page.ev(`document.querySelectorAll('tbody tr').length`);
            errs = page.takeErrors();
            n && !errs.length ? pass('airflow box narrows the list', `${n} rows at 600`) : fail('airflow box narrows the list', errs[0] || 'no rows');
            await page.ev(`(document.querySelector('.filter-clear') || { click() {} }).click()`);
        }

        // exports
        try {
            const ex = await page.ev(`(async () => {
                const data = await HHpro.Data.loadProduct('${p.key}'), s = data.selections, n = s.length;
                const items = [0, 1, 2, 3].map(i => ({ selectionId: s[Math.floor((i + 0.5) * n / 4)].id, tag: 'T-' + (i + 1), qty: 1 }));
                const grid = HHpro.Export.buildScheduleGrid('${p.key}', items, data);
                const sections = [{ title: HHpro.Export.productTabLabel('${p.key}'), grid }];
                const size = async b => (await (await b).arrayBuffer()).byteLength;
                let html = '';
                const realOpen = window.open;
                window.open = () => ({ document: { open() {}, write(h) { html += h; }, close() {}, images: [], querySelector() { return null; }, body: { style: {} } }, focus() {}, print() {} });
                try { HHpro.Export.toPDF('${p.key}', items, data, 'Smoke Test'); await new Promise(r => setTimeout(r, 500)); }
                finally { window.open = realOpen; }
                return { rows: grid.rows.length, xlsx: await size(HHpro.Export.xlsxBlobFromSections(sections)),
                         dxf: await size(HHpro.Export.dxfBlobFromSections(sections)), pdf: await size(HHpro.Export.pdfBlobFromSections(sections)),
                         print: html.indexOf('<table') >= 0 };
            })()`);
            errs = page.takeErrors();
            const bad = ['xlsx', 'dxf', 'pdf'].filter((k) => !(ex[k] > 500));
            if (!ex.rows) fail('exports', 'schedule grid is empty');
            else if (bad.length || !ex.print || errs.length) fail('exports', errs[0] || ('empty: ' + bad.concat(ex.print ? [] : ['print page']).join(', ')));
            else pass('exports (Excel, CAD, PDF, print page)', `${ex.rows} grid rows`);
            pdfSections.push(p.key);
        } catch (e) { fail('exports', e.message); }
    }
    return pdfSections;
}

async function pdfLayout(page, keys) {
    group('PDF layout (Full Schedule PDF)');
    if (!keys.length) return;
    const py = ['python', 'python3', 'py'].find((c) => spawnSync(c, ['-c', 'import pymupdf'], { stdio: 'ignore' }).status === 0 ||
                                                    spawnSync(c, ['-c', 'import fitz'], { stdio: 'ignore' }).status === 0);
    const b64 = await page.ev(`(async () => {
        const keys = ${JSON.stringify(keys)}, sections = [];
        for (const k of keys) {
            const data = await HHpro.Data.loadProduct(k), s = data.selections, n = s.length;
            const items = [0, 1, 2, 3, 4, 5].map(i => ({ selectionId: s[Math.floor((i + 0.5) * n / 6)].id, tag: 'T-' + (i + 1), qty: 1 }));
            sections.push({ title: HHpro.Export.productTabLabel(k), grid: HHpro.Export.buildScheduleGrid(k, items, data) });
        }
        const u = new Uint8Array(await (await HHpro.Export.pdfBlobFromSections(sections)).arrayBuffer());
        let t = ''; for (let i = 0; i < u.length; i++) t += String.fromCharCode(u[i]); return btoa(t);
    })()`);
    const file = path.join(OUT, 'full-schedule.pdf');
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    if (!py) { warn('PDF layout', 'Python with PyMuPDF not found - skipped (pip install pymupdf)'); return; }
    const r = spawnSync(py, [path.join(__dirname, 'pdf_layout_check.py'), file], { encoding: 'utf8' });
    let res;
    try { res = JSON.parse(r.stdout); } catch (e) { fail('PDF layout', (r.stderr || r.stdout).slice(0, 300)); return; }
    res.problems.length
        ? fail('no text crosses a cell border', `${res.problems.length} problem(s), e.g. page ${res.problems[0].page} "${res.problems[0].text}" ${res.problems[0].issue} - see .wrangler/smoke/full-schedule.pdf`)
        : pass('no text crosses a cell border', `${res.pages} pages, ${res.spans} text spans`);
}

// ------------------------------------------------------------------ 4. design request

async function designRequest(page, target) {
    group('Air Handler Design Request');
    await page.goto(SITE + '/');
    await page.ev(`localStorage.clear()`);
    await page.ev(`document.querySelector('.tile-air-handler-design-request').click()`);
    if (!(await waitFor(() => page.ev(`!!document.querySelector('.ahu-step')`), 10000))) { fail('form opens'); return; }
    pass('form opens from the tile');

    const setF = (label, value) => page.ev(`(() => { const f = [...document.querySelectorAll('.ahu-field')].find(f => f.querySelector('.ahu-label').textContent.replace(' *', '') === ${JSON.stringify(label)});
        if (!f) return false; const i = f.querySelector('input,select,textarea');
        if (i.type === 'checkbox') { i.checked = ${JSON.stringify(value)}; i.dispatchEvent(new Event('change', { bubbles: true })); }
        else { i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); } return true; })()`);
    const next = async () => { await page.ev(`document.querySelector('.ahu-next').click()`); await sleep(300); };
    const missing = [];
    for (const [k, v] of [['Project name', 'Smoke Test - AHU-1'], ['Job location', 'Nashville, TN']]) if (!(await setF(k, v))) missing.push(k);
    await next();
    if (!(await setF('Supply airflow', '8000'))) missing.push('Supply airflow');
    await next();
    for (const l of ['Prefilter', 'Cooling coil', 'Supply fan']) {
        await page.ev(`[...document.querySelectorAll('.ahu-chip')].find(c => c.textContent.trim() === ${JSON.stringify(l)}).click()`);
        await sleep(150);
    }
    await page.ev(`[...document.querySelectorAll('.ahu-block')][1].click()`);
    await sleep(150);
    for (const [k, v] of [['Coil type', 'Chilled water'], ['Coil dehumidifies', true]]) if (!(await setF(k, v))) missing.push(k);
    missing.length ? fail('form fields', 'not found: ' + missing.join(', ')) : pass('form fields and configurator');

    await page.ev(`[...document.querySelectorAll('.ahu-step')][7].click()`);
    await sleep(300);
    const upload = path.join(OUT, 'smoke attachment.txt');
    fs.writeFileSync(upload, 'HHpro smoke test attachment\n');
    const doc = await page.send('DOM.getDocument', {});
    const q = await page.send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '.ahu-file-input' });
    await page.send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [upload] });
    await sleep(300);
    await page.ev(`[...document.querySelectorAll('.ahu-step')][8].click()`);
    await sleep(300);
    const warnings = await page.ev(`(document.querySelector('.ahu-alert.is-warn') || { innerText: '' }).innerText`);
    /MERV 8/.test(warnings) && /reheat/.test(warnings) ? pass('review checks fire (MERV 8, reheat)') : fail('review checks fire', warnings.slice(0, 200) || 'no warnings shown');

    await page.ev(`document.querySelector('.ahu-submit').click()`);
    const done = await waitFor(() => page.ev(`!!document.querySelector('.ahu-done') || /Could not/.test((document.querySelector('.ahu-status') || {}).textContent || '')`), 30000);
    const doneOk = done && (await page.ev(`!!document.querySelector('.ahu-done')`));
    if (!doneOk) { fail('submit', await page.ev(`(document.querySelector('.ahu-status') || {}).textContent || 'timed out'`)); await page.shot('fail_ahu_submit'); return; }
    pass('submit');

    const res = await page.ev(`(async () => {
        const list = await (await fetch('api/ahu-requests')).json(); const r = list.requests[0];
        const one = await (await fetch('api/ahu-requests/' + r.id)).json();
        const dl = await fetch('api/ahu-requests/' + r.id + '/files/' + encodeURIComponent('smoke attachment.txt'));
        const admin = await fetch('api/admin/ahu-requests');
        return { project: r.projectName, email: one.emailStatus, emailError: one.emailError, files: one.files.length,
                 dl: dl.status, dlText: await dl.text(), admin: admin.status };
    })()`);
    res.project === 'Smoke Test - AHU-1' && res.files === 1 ? pass('request stored with its attachment') : fail('request stored', JSON.stringify(res));
    res.dl === 200 && /smoke test attachment/.test(res.dlText) ? pass('attachment downloads') : fail('attachment downloads', 'HTTP ' + res.dl);
    res.admin === 200 ? pass('admin request list') : fail('admin request list', 'HTTP ' + res.admin);
    res.email === 'sent' ? pass('email (simulated locally, nothing sent)')
        : res.email === 'not configured' ? warn('email', 'no EMAIL binding / EMAIL_FROM in wrangler.jsonc')
        : fail('email', `${res.email}: ${res.emailError || ''}`);
    const errs = page.takeErrors();
    errs.length ? fail('design request has no JS errors', errs[0]) : pass('design request has no JS errors');
}

// ------------------------------------------------------------------ main

(async () => {
    const t0 = Date.now();
    fs.mkdirSync(OUT, { recursive: true });
    fs.readdirSync(OUT).filter((f) => /\.(png|pdf)$/.test(f)).forEach((f) => fs.rmSync(path.join(OUT, f)));
    let page;
    try {
        if (!staticChecks()) throw new Error('build failed');
        group('Local server');
        await startSite();
        pass('wrangler dev', `${SITE} signed in as ${firstAdmin()}`);
        const target = await startBrowser();
        pass('headless browser');
        page = new Page();
        await page.open(target);

        await homeAndPages(page);
        const keys = await productChecks(page);
        await pdfLayout(page, keys);
        await designRequest(page, target);
    } catch (e) {
        fail('smoke test aborted', e.message);
        if (page) await page.shot('fail_aborted');
    }

    const fails = results.filter((r) => r.ok === false), warns = results.filter((r) => r.ok === 'warn');
    const summary = `\n${results.length - fails.length - warns.length} passed, ${fails.length} failed, ${warns.length} warning(s) ` +
                    `in ${Math.round((Date.now() - t0) / 1000)} s`;
    console.log(summary);
    if (fails.length) {
        console.log('\nFailures:');
        fails.forEach((f) => console.log(`  [${f.group}] ${f.name}${f.detail ? ' - ' + f.detail : ''}`));
    }
    const report = results.map((r) => `${r.ok === 'warn' ? 'WARN' : r.ok ? 'PASS' : 'FAIL'}  [${r.group}] ${r.name}${r.detail ? ' - ' + r.detail : ''}`).join(os.EOL);
    fs.writeFileSync(path.join(OUT, 'report.txt'), report + os.EOL + summary + os.EOL);
    console.log(`Report: ${path.relative(ROOT, path.join(OUT, 'report.txt'))}` + (flag('keep') ? `\nServer left running at ${SITE}` : ''));
    if (page && page.ws) page.ws.close();
    cleanup();
    process.exit(fails.length ? 1 : 0);
})();
