/* ============================================================
   HHpro - Schedule template registry
   ------------------------------------------------------------
   Engineer-specific schedule layouts. The site can render a
   project's schedules (on-screen + Excel/CAD/PDF) in different
   engineering firms' house formats. The firm is chosen with a
   project-level dropdown (see project_view.js) and stored on the
   cart/project state (Cart.getProjectEngineer).

   Model
   -----
   A "template" describes ONE firm's layout for ONE product. It is
   consumed by HHpro.Export.buildTemplateGrid (export.js), which
   turns it into the same generic `grid` object the native
   scheduleHeader path produces - so the existing xlsx / dxf / pdf
   emitters and the on-screen renderer all work unchanged.

   getTemplate(engineerKey, productKey) returns:
     - null  -> use the native (default) layout. The 'hoffman' key
                returns null for every product, so Hoffman & Hoffman
                is exactly today's behaviour with zero risk.
     - object -> a template:
         orientation : 'rows'    units are rows (one row per unit /
                                 indoor sub-row), fields are columns.
                     : 'columns' transposed - units are columns,
                                 fields (attributes) are rows.
         title       : schedule title string.
         columns     : (rows) ordered leaf columns, each
                       { scope:'item'|'row', derive(g)->string }
                       or { editable:true, fieldKey, scope }.
         header      : (rows) header band cells positioned over the
                       leaf columns: { r, c, rowspan?, colspan?, label }
                       with r = 0-based row under the title.
         attributes  : (columns) ordered attribute rows, each
                       { label, band:'top'|'main', derive(g) } or
                       { label, band, editable:true, fieldKey }.
         notesTitle  : optional bold notes-box header.
         notes       : array of verbatim note lines (already numbered
                       where the firm numbers them).
         manufacturers : optional verbatim "acceptable manufacturers"
                       block (its own bordered box).

   `derive(g)` data-access API (built by export.js per unit/sub-row):
       g.cell(letter)      formatted native value at the current row
       g.cellAt(letter,i)  formatted native value at sub-row i
       g.item              the cart item (tag, serves, indoorTags, ...)
       g.rowIndex          current sub-row index
       g.numRows           sub-row count for this unit
       g.tf(fieldKey)      per-unit editable override (string, '' if none)

   Editable fields have no native source yet (the user will wire the
   underlying data later). They render an in-place input on screen and
   a "-" placeholder in exports until filled. The typed value is stored
   on the item as item.templateFields[fieldKey].
   ============================================================ */

(function () {
    'use strict';

    window.HHpro = window.HHpro || {};

    // ---- value transforms ------------------------------------------
    function s(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }

    // "DAIKIN" + "FTKF09BVJU9" -> "DAIKIN FTKF09BVJU9"   (mini splits;
    //  the three TempMaster-branded lines read "TEMPMASTER" here)
    function combine(make, model) {
        return [s(make), s(model)].filter(Boolean).join(' ');
    }

    // Like combine() but stacks make over model on TWO lines (engineer
    // sheets show the manufacturer on the first row and the model number on
    // a second row within the same MANUF. MODEL cell). The "\n" is honoured
    // by every renderer (screen <br>, xlsx wrapText, DXF \P, PDF stacked).
    function combine2(make, model) {
        var a = s(make), b = s(model);
        if (a && b) return a + '\n' + b;
        return a || b;
    }

    // "208/60/1" -> "208/1" (drop the middle 60 Hz token). Leaves
    // already-2-part or non-slash values untouched.
    function voltPh(v) {
        var parts = s(v).split('/');
        if (parts.length >= 3) {
            return parts[0].trim() + '/' + parts[parts.length - 1].trim();
        }
        return s(v);
    }

    // MCA + MOP -> "11.6/15"
    function slash(a, b) {
        var aa = s(a), bb = s(b);
        if (!aa && !bb) return '';
        return aa + '/' + bb;
    }

    // "21.0 / 12.5 / -" -> "21" (first token, trailing .0 stripped)
    function firstNumber(v) {
        var first = s(v).split('/')[0].trim();
        return first.replace(/\.0+$/, '');
    }

    // "208/60/1" or "208/1" -> "208" (the volts token only)
    function voltOnly(v) {
        return s(v).split('/')[0].trim();
    }

    // "208/60/1" or "208/1" -> "1" (phase = last token). '' when the
    // value has no slash (nothing to split a phase out of).
    function phaseOnly(v) {
        var parts = s(v).split('/');
        return parts.length > 1 ? parts[parts.length - 1].trim() : '';
    }

    // Leading number of the idx-th "/"-separated part of an efficiency
    // string, trailing .0 stripped. effNum('16.7 IEER/11.8 EER', 1) ->
    // "11.8"; effNum('16.4 IEER', 0) -> "16.4"; "-" when missing.
    function effNum(v, idx) {
        var parts = s(v).split('/');
        var part = parts[idx] !== undefined ? parts[idx] : '';
        var m = part.match(/-?\d+(?:\.\d+)?/);
        return m ? m[0].replace(/\.0+$/, '') : '-';
    }

    // "AH" + "HP-K1" -> "AH/HP-K1" (either alone passes through)
    function tagPair(a, b) {
        var aa = s(a), bb = s(b);
        return (aa && bb) ? aa + '/' + bb : (aa || bb);
    }

    function isPositiveNum(v) {
        var n = Number(v);
        return isFinite(n) && n > 0;
    }

    // BTU/h -> MBH number string, e.g. 35418 -> "35.418"
    function div1000(v) {
        var n = Number(v);
        if (!isFinite(n)) return s(v);
        return String(n / 1000);
    }

    // BTU/h -> "X MBH" (used by Barrett Woodyard heating-capacity cells)
    function mbh(v) {
        var n = Number(v);
        if (!isFinite(n)) return s(v);
        return (n / 1000) + ' MBH';
    }

    // "CAPTA3026B3 / DR80TN0803BN" -> idx 0 = coil, idx 1 = furnace.
    // The gas-split native MODEL column stores both, slash-separated.
    function modelPart(v, idx) {
        var parts = s(v).split('/');
        return parts[idx] !== undefined ? parts[idx].trim() : s(v);
    }

    // =================================================================
    // Firm registry
    // -----------------------------------------------------------------
    // Each engineering firm's layouts live in firms/<key>/templates.js
    // and call register() when loaded. Those files are only served to
    // users allowed that firm (Cloudflare Access signs the user in,
    // functions/firms/_middleware.js checks their email against
    // server/firm-access.js), so this file names no firms at all and a
    // firm that never registered simply doesn't exist for this user.
    //
    // This is the security boundary: an unregistered firm's template is
    // never returned, so even a project saved/imported with
    // engineer:'refresco' renders the standard schedule for a user
    // without Refresco access.
    // =================================================================

    // engineerKey -> productKey -> factory (returns a fresh template).
    var REGISTRY = {
        hoffman: {}    // empty - native layout for every product
    };

    var ENGINEERS = [
        { key: 'hoffman', label: 'Hoffman & Hoffman' }
    ];

    // Same ?v= cache-buster as the rest of the site (index.html), so a
    // deploy never mixes a fresh core with a stale cached firm file.
    var VERSION = (function () {
        var cs = document.currentScript;
        var m = cs && /[?&]v=([^&]+)/.exec(cs.src || '');
        return m ? m[1] : '';
    })();

    function isAllowed(engineerKey) {
        return Object.prototype.hasOwnProperty.call(REGISTRY, engineerKey || 'hoffman');
    }

    function loadFirmScript(key) {
        if (!/^[a-z0-9_]+$/.test(key)) return Promise.resolve(null);
        return new Promise(function (resolve) {
            var el = document.createElement('script');
            el.src = 'firms/' + key + '/templates.js' + (VERSION ? '?v=' + VERSION : '');
            el.onload = function () { resolve(isAllowed(key) ? key : null); };
            el.onerror = function () { resolve(null); };
            document.head.appendChild(el);
        });
    }

    HHpro.Templates = {
        // Value transforms shared with the firm files.
        helpers: {
            s: s, combine: combine, combine2: combine2, voltPh: voltPh,
            slash: slash, firstNumber: firstNumber, voltOnly: voltOnly,
            phaseOnly: phaseOnly, effNum: effNum, tagPair: tagPair,
            isPositiveNum: isPositiveNum, div1000: div1000, mbh: mbh,
            modelPart: modelPart
        },

        /** Called by each firms/<key>/templates.js as it loads. */
        register: function (key, label, byProduct) {
            if (!key || isAllowed(key)) return;
            REGISTRY[key] = byProduct || {};
            ENGINEERS.push({ key: key, label: label || key });
        },

        /**
         * Ask the server which firms this user may use and load those
         * firms' template files. Resolves with the loaded firm keys
         * (never rejects - any failure just means standard layout only,
         * e.g. opening the site locally without the Pages Functions).
         */
        loadFirms: function () {
            if (!window.fetch || !window.Promise || location.protocol === 'file:') {
                return Promise.resolve([]);
            }
            return fetch('api/firms', {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Accept': 'application/json' }
            })
                .then(function (res) { return res.ok ? res.json() : null; })
                .then(function (body) {
                    var keys = (body && Array.isArray(body.firms)) ? body.firms : [];
                    return Promise.all(keys.map(loadFirmScript));
                })
                .then(function (loaded) { return loaded.filter(Boolean); })
                .catch(function () { return []; });
        },

        // Engineers this user can use: Hoffman & Hoffman first, then the
        // firms alphabetically (load order varies, so sort for a stable
        // dropdown).
        listEngineers: function () {
            var firms = ENGINEERS.slice(1).sort(function (a, b) {
                return a.label.localeCompare(b.label);
            });
            return [ENGINEERS[0]].concat(firms).map(function (e) {
                return { key: e.key, label: e.label };
            });
        },

        /**
         * Returns a template object for (engineerKey, productKey), or
         * null to fall back to the native scheduleHeader layout. Returns
         * null when this user doesn't have that firm.
         */
        getTemplate: function (engineerKey, productKey) {
            if (!isAllowed(engineerKey)) return null;
            var byProduct = REGISTRY[engineerKey || 'hoffman'];
            var factory = byProduct[productKey];
            return factory ? factory() : null;
        }
    };
})();
