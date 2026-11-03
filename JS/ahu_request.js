/* ============================================================
   HHpro - Air Handler Design Request
   ------------------------------------------------------------
   A step-by-step form for the information H&H needs to select a
   custom / semi-custom air handler: project and commercial basics,
   airflow and fans, a section configurator (sections in airflow
   order, each with its own options - coils, filters, energy
   recovery, humidifier ...), casing, site, electrical / controls,
   accessories and sound, plus file attachments.

   The draft autosaves in this browser (attachments excepted). On
   submit the request is stored on the server (server/ahu-requests.js:
   D1 record, files in R2) and emailed to H&H. The review step lists
   the checks an engineer should confirm (MERV 8 ahead of a
   dehumidifying coil, reheat placement, coated-coil derate ...).

     HHpro.Views.ahu_request  - the form (data.js tile `view`)
     HHpro.Views.ahu_admin    - all submitted requests (admins)
   ============================================================ */

(function () {
    'use strict';
    window.HHpro = window.HHpro || {};
    HHpro.Views = HHpro.Views || {};

    var DRAFT_KEY = 'hhpro.ahuDraft.v1';
    var MAX_FILE_BYTES = 25 * 1024 * 1024;
    var MAX_TOTAL_BYTES = 75 * 1024 * 1024;
    var MAX_FILES = 12;

    // ------------------------------------------------------------
    // Field definitions
    // { k, label, type: text|number|select|textarea|check|date|heading,
    //   unit, options, placeholder, wide, required, hint, when(values) }
    // ------------------------------------------------------------

    var YES_NO = ['', 'Yes', 'No'];
    var REDUNDANCY = ['', 'None', 'N+1', 'N-1 (one fan out)'];
    var VFD = ['', 'One VFD per fan', 'One VFD per fan array', 'No VFD / by others'];
    var OPENING = ['', 'Top', 'Bottom', 'End', 'Left side', 'Right side', 'N/A'];

    var STEPS = [
        { key: 'project', title: 'Project', fields: [
            { k: 'projectName', label: 'Project name', type: 'text', required: true, wide: true },
            { k: 'location', label: 'Job location', type: 'text', placeholder: 'City, State', required: true },
            { k: 'linkedProject', label: 'HHpro project', type: 'project',
              hint: 'Optional - one of your saved projects this unit belongs to.' },
            { k: 'tags', label: 'Unit tag(s)', type: 'text', placeholder: 'AHU-1, AHU-2' },
            { k: 'quantity', label: 'Quantity', type: 'number' },
            { k: 'application', label: 'Space / service', type: 'text', placeholder: 'e.g. OR suite, lab, gym', wide: true },
            { k: 'engineerFirm', label: 'Engineering firm', type: 'text' },
            { k: 'engineerContact', label: 'Engineer contact', type: 'text' },
            { k: 'specSection', label: 'Spec section', type: 'text', placeholder: 'e.g. 23 73 13' },
            { k: 'basisOfDesign', label: 'Basis of design', type: 'text' },
            { k: 'approvedEquals', label: 'Approved equals', type: 'text', wide: true },
            { k: 'ownerCriteria', label: 'Owner criteria', type: 'select',
              options: ['', 'None', 'VA', 'DoD', 'Other - see notes'],
              hint: 'VA and DoD have their own casing, coating and rooftop restrictions.' },
            { k: 'ownerNotes', label: 'Owner criteria notes', type: 'textarea', wide: true,
              when: function (v) { return v.ownerCriteria && v.ownerCriteria !== 'None'; } },
            { k: 'bidDate', label: 'Bid date', type: 'date' },
            { k: 'onsiteDate', label: 'Required on-site date', type: 'date' }
        ] },
        { key: 'airflow', title: 'Airflow & Fans', fields: [
            { k: 'supplyCfm', label: 'Supply airflow', type: 'number', unit: 'CFM', required: true },
            { k: 'supplyEsp', label: 'Supply external static', type: 'number', unit: 'in. w.g.' },
            { k: 'returnCfm', label: 'Return / relief airflow', type: 'number', unit: 'CFM' },
            { k: 'returnEsp', label: 'Return external static', type: 'number', unit: 'in. w.g.' },
            { k: 'minOaCfm', label: 'Minimum outdoor air', type: 'number', unit: 'CFM' },
            { k: 'noReturnFan', label: 'No return fan', type: 'check' },
            { type: 'heading', label: 'Supply fan' },
            { k: 'sfQty', label: 'Fan quantity', type: 'number' },
            { k: 'sfRedundancy', label: 'Fan-array redundancy', type: 'select', options: REDUNDANCY },
            { k: 'sfVfd', label: 'VFD arrangement', type: 'select', options: VFD },
            { k: 'sfMaxHp', label: 'Max motor HP', type: 'number', unit: 'HP' },
            { type: 'heading', label: 'Return / relief fan', when: function (v) { return !v.noReturnFan; } },
            { k: 'rfQty', label: 'Fan quantity', type: 'number', when: function (v) { return !v.noReturnFan; } },
            { k: 'rfRedundancy', label: 'Fan-array redundancy', type: 'select', options: REDUNDANCY,
              when: function (v) { return !v.noReturnFan; } },
            { k: 'rfVfd', label: 'VFD arrangement', type: 'select', options: VFD, when: function (v) { return !v.noReturnFan; } },
            { k: 'rfMaxHp', label: 'Max motor HP', type: 'number', unit: 'HP', when: function (v) { return !v.noReturnFan; } }
        ] },
        { key: 'config', title: 'Configuration', custom: 'configurator', fields: [
            { k: 'arrangement', label: 'Arrangement', type: 'select', options: ['', 'Draw-through', 'Blow-through'] },
            { k: 'handing', label: 'Handing', type: 'select', options: ['', 'Left hand', 'Right hand'],
              hint: 'Looking in the direction of airflow.' },
            { k: 'accessSide', label: 'Access side', type: 'select', options: ['', 'Left', 'Right', 'Both'] },
            { k: 'pipeSide', label: 'Pipe connections', type: 'select', options: ['', 'Left', 'Right', 'Both'] },
            { k: 'openOa', label: 'Outdoor air opening', type: 'select', options: OPENING },
            { k: 'openRa', label: 'Return air opening', type: 'select', options: OPENING },
            { k: 'openEa', label: 'Exhaust / relief opening', type: 'select', options: OPENING },
            { k: 'openSa', label: 'Supply air opening', type: 'select', options: OPENING },
            { k: 'configNotes', label: 'Layout notes', type: 'textarea', wide: true,
              placeholder: 'Anything the drawing needs to show - attach sketches on the Commercial & Files step.' }
        ] },
        { key: 'casing', title: 'Casing', fields: [
            { k: 'wallThickness', label: 'Wall thickness', type: 'select', options: ['', '2 in.', '3 in.', '4 in.', 'Other - see notes'] },
            { k: 'insulation', label: 'Insulation', type: 'select', options: ['', 'Injected foam', 'Mineral fiber / fiberglass', 'Other - see notes'] },
            { k: 'rValue', label: 'Panel R-value', type: 'number' },
            { k: 'innerLiner', label: 'Inner liner', type: 'select', options: ['', 'Solid', 'Perforated (fan / attenuator sections)', 'Perforated throughout'] },
            { k: 'innerMaterial', label: 'Inner liner material', type: 'select', options: ['', 'Galvanized', 'Aluminum', 'Stainless steel'] },
            { k: 'outerMaterial', label: 'Outer skin material', type: 'select', options: ['', 'Galvanized', 'Painted galvanized', 'Aluminum', 'Stainless steel'] },
            { k: 'leakageClass', label: 'Casing leakage class', type: 'text', placeholder: 'e.g. CL 6' },
            { k: 'leakagePressure', label: 'Leakage test pressure', type: 'number', unit: 'in. w.g.' },
            { k: 'deflection', label: 'Deflection criterion', type: 'text', placeholder: 'e.g. L/240 at 8 in. w.g.' },
            { k: 'thermalBreak', label: 'Thermal break', type: 'select', options: YES_NO },
            { k: 'drainPan', label: 'Drain pan material', type: 'select', options: ['', 'Stainless steel', 'Galvanized', 'Aluminum', 'Composite'] },
            { k: 'drainSlope', label: 'Drain pan slope', type: 'select', options: ['', 'Double-sloped', 'Single slope'] },
            { k: 'ahriCert', label: 'AHRI certification', type: 'select', options: ['', 'Not required', 'AHRI 430', 'AHRI 410', 'AHRI 430 and 410'] },
            { k: 'casingNotes', label: 'Casing notes', type: 'textarea', wide: true }
        ] },
        { key: 'site', title: 'Site', fields: [
            { k: 'indoorOutdoor', label: 'Location', type: 'select', options: ['', 'Indoor', 'Outdoor'] },
            { k: 'maxLength', label: 'Max length', type: 'number', unit: 'in.' },
            { k: 'maxWidth', label: 'Max width', type: 'number', unit: 'in.' },
            { k: 'maxHeight', label: 'Max height', type: 'number', unit: 'in.' },
            { k: 'maxWeight', label: 'Max weight', type: 'number', unit: 'lb' },
            { k: 'splits', label: 'Shipping splits', type: 'select', options: ['', 'None needed', 'Shipping splits', 'Knockdown / field assembly', 'Unknown'] },
            { k: 'rigging', label: 'Rigging path, door and shaft sizes', type: 'textarea', wide: true },
            { k: 'curbHeight', label: 'Curb / pad height', type: 'number', unit: 'in.',
              hint: 'Sets the room available for the condensate trap.' },
            { k: 'seismicWind', label: 'Seismic / wind certification', type: 'select', options: ['', 'None', 'Seismic', 'Wind', 'Seismic and wind'] },
            { k: 'siteNotes', label: 'Site notes', type: 'textarea', wide: true }
        ] },
        { key: 'electrical', title: 'Electrical & Controls', fields: [
            { k: 'voltage', label: 'Voltage', type: 'select', options: ['', '208/3/60', '230/3/60', '460/3/60', '575/3/60'] },
            { k: 'singlePoint', label: 'Single-point power', type: 'select', options: YES_NO },
            { k: 'disconnect', label: 'Disconnect', type: 'select', options: ['', 'Factory non-fused', 'Factory fused', 'By others'] },
            { k: 'vfdVestibule', label: 'VFD vestibule', type: 'select', options: YES_NO },
            { k: 'controls', label: 'Controls', type: 'select', options: ['', 'Factory DDC controls', 'BAS-furnished, factory-mounted', 'BAS-furnished, field-mounted', 'None / by others'] },
            { k: 'protocol', label: 'Protocol', type: 'select', options: ['', 'BACnet MS/TP', 'BACnet IP', 'Modbus', 'LonWorks', 'N/A'] },
            { k: 'airflowMonitoring', label: 'Airflow monitoring', type: 'text', placeholder: 'e.g. supply, return and OA' },
            { k: 'sequence', label: 'Sequence of operation', type: 'textarea', wide: true,
              placeholder: 'Paste or summarize the sequence, or attach it.' }
        ] },
        { key: 'accessories', title: 'Accessories & Sound', fields: [
            { k: 'uv', label: 'UV lights', type: 'select', options: YES_NO },
            { k: 'motorRail', label: 'Motor removal rail', type: 'select', options: YES_NO },
            { k: 'testPorts', label: 'Test ports and gauges', type: 'select', options: YES_NO },
            { k: 'smokeDampers', label: 'Smoke dampers', type: 'select', options: YES_NO },
            { k: 'lights', label: 'Section lights / GFCI', type: 'select', options: YES_NO },
            { k: 'otherAccessories', label: 'Other accessories', type: 'textarea', wide: true },
            { type: 'heading', label: 'Sound' },
            { k: 'ncTarget', label: 'NC target', type: 'number' },
            { k: 'dbLimits', label: 'Discharge / radiated dB limits', type: 'textarea', wide: true }
        ] },
        { key: 'commercial', title: 'Commercial & Files', custom: 'files', fields: [
            { k: 'witnessTest', label: 'Factory witness testing', type: 'select', options: ['', 'Not required', 'Witness test required', 'Factory test report only'] },
            { k: 'warranty', label: 'Warranty', type: 'text', placeholder: 'e.g. 5 years parts, 1 year labor' },
            { k: 'notes', label: 'Anything else', type: 'textarea', wide: true }
        ] },
        { key: 'review', title: 'Review & Submit', custom: 'review', fields: [] }
    ];

    // Coil options shared by every coil section
    var FLUID = ['', 'Water', 'Propylene glycol', 'Ethylene glycol'];
    var COATING = ['', 'None', 'E-coat', 'Phenolic (Heresite)', 'Other - see notes'];
    function isWater(v) { return /water|glycol|steam/i.test(v.coilType || '') || !v.coilType; }
    function isFluid(v) { return /water|glycol/i.test(v.coilType || '') || !v.coilType; }
    function coilFields(types, extra) {
        return [{ k: 'coilType', label: 'Coil type', type: 'select', options: [''].concat(types) }]
            .concat(extra || [])
            .concat([
                { k: 'eatDb', label: 'Entering air DB', type: 'number', unit: '°F' },
                { k: 'eatWb', label: 'Entering air WB', type: 'number', unit: '°F' },
                { k: 'latDb', label: 'Leaving air DB', type: 'number', unit: '°F' },
                { k: 'latWb', label: 'Leaving air WB', type: 'number', unit: '°F' },
                { k: 'ewt', label: 'Entering water', type: 'number', unit: '°F', when: isFluid },
                { k: 'lwt', label: 'Leaving water', type: 'number', unit: '°F', when: isFluid },
                { k: 'gpm', label: 'Flow', type: 'number', unit: 'GPM', when: isFluid },
                { k: 'fluid', label: 'Fluid', type: 'select', options: FLUID, when: isFluid },
                { k: 'glycolPct', label: 'Glycol', type: 'number', unit: '%',
                  when: function (v) { return isFluid(v) && /glycol/i.test(v.fluid || ''); } },
                { k: 'maxFaceVel', label: 'Max face velocity', type: 'number', unit: 'FPM' },
                { k: 'maxApd', label: 'Max air pressure drop', type: 'number', unit: 'in. w.g.' },
                { k: 'maxWpd', label: 'Max water pressure drop', type: 'number', unit: 'ft', when: isWater },
                { k: 'rows', label: 'Rows', type: 'number', when: isWater },
                { k: 'fpi', label: 'Fins per inch', type: 'number', when: isWater },
                { k: 'coating', label: 'Coil coating', type: 'select', options: COATING },
                { k: 'derate', label: 'Coating derate included in capacity', type: 'check',
                  when: function (v) { return v.coating && v.coating !== 'None'; } }
            ]);
    }
    var FILTER_FIELDS = [
        { k: 'merv', label: 'MERV', type: 'number' },
        { k: 'depth', label: 'Depth', type: 'number', unit: 'in.' },
        { k: 'filterType', label: 'Filter type', type: 'select', options: ['', 'Pleated', 'Bag', 'Rigid box / cartridge', 'HEPA', 'Other'] },
        { k: 'dpBasis', label: 'Fan static based on', type: 'select', options: ['', 'Clean filter', 'Mid-life', 'Dirty filter'],
          hint: 'Ask which filter pressure drop the fan static uses.' }
    ];
    var HEAT_TYPES = ['Hot water', 'Steam', 'Electric', 'Gas-fired', 'Glycol runaround'];
    var NOTES = { k: 'notes', label: 'Notes', type: 'textarea', wide: true };

    // Configurator section types: group drives the block colour.
    var SECTION_TYPES = [
        { type: 'oa_intake', label: 'OA intake / hood', group: 'air', fields: [NOTES] },
        { type: 'return_fan', label: 'Return fan', group: 'fan', fields: [NOTES] },
        { type: 'exhaust_fan', label: 'Relief / exhaust fan', group: 'fan', fields: [NOTES] },
        { type: 'economizer', label: 'Economizer / mixing box', group: 'air', fields: [
            { k: 'damperClass', label: 'Damper leakage class', type: 'text', placeholder: 'e.g. Class 1A' },
            { k: 'actuators', label: 'Actuators', type: 'select', options: ['', 'Factory-mounted', 'By others'] }, NOTES] },
        { type: 'energy_recovery', label: 'Energy recovery', group: 'erv', fields: [
            { k: 'ervType', label: 'Type', type: 'select', options: ['', 'Enthalpy wheel', 'Sensible wheel', 'Fixed plate', 'Heat pipe', 'Runaround coil loop'] },
            { k: 'ervArrangement', label: 'Arrangement', type: 'select', options: ['', 'Stacked', 'Side-by-side'] },
            { k: 'exhaustClass', label: 'Exhaust air class', type: 'select', options: ['', 'EAC 1', 'EAC 2', 'EAC 3', 'EAC 4'] },
            { k: 'effectiveness', label: 'Effectiveness', type: 'number', unit: '%' }, NOTES] },
        { type: 'prefilter', label: 'Prefilter', group: 'filter', fields: FILTER_FIELDS.concat([NOTES]) },
        { type: 'blender', label: 'Air blender', group: 'air', fields: [NOTES] },
        { type: 'preheat', label: 'Preheat coil', group: 'heat', fields: coilFields(HEAT_TYPES).concat([NOTES]) },
        { type: 'cooling', label: 'Cooling coil', group: 'cool', fields: coilFields(['Chilled water', 'DX'], [
            { k: 'dehumidifies', label: 'Coil dehumidifies', type: 'check' },
            { k: 'refrigerant', label: 'Refrigerant', type: 'text', placeholder: 'e.g. R-454B',
              when: function (v) { return v.coilType === 'DX'; } },
            { k: 'condensingUnit', label: 'Matched condensing unit', type: 'text',
              when: function (v) { return v.coilType === 'DX'; } }
        ]).concat([NOTES]) },
        { type: 'reheat', label: 'Reheat coil', group: 'heat', fields: coilFields(['Hot water', 'Hot gas reheat', 'Electric', 'Steam', 'Gas-fired'], [
            { k: 'heatSource', label: 'What heats it', type: 'text', placeholder: 'e.g. condenser water, boiler loop' }
        ]).concat([NOTES]) },
        { type: 'heating', label: 'Heating coil', group: 'heat', fields: coilFields(HEAT_TYPES).concat([NOTES]) },
        { type: 'humidifier', label: 'Humidifier', group: 'air', fields: [
            { k: 'humType', label: 'Type', type: 'select', options: ['', 'Steam dispersion (boiler steam)', 'Steam-to-steam', 'Electric steam generator', 'Gas-fired steam generator', 'Adiabatic'] },
            { k: 'steamPressure', label: 'Steam pressure', type: 'number', unit: 'psig' },
            { k: 'capacity', label: 'Capacity', type: 'number', unit: 'lb/hr' }, NOTES] },
        { type: 'supply_fan', label: 'Supply fan', group: 'fan', fields: [NOTES] },
        { type: 'final_filter', label: 'Final filter', group: 'filter', fields: FILTER_FIELDS.concat([NOTES]) },
        { type: 'attenuator', label: 'Sound attenuator', group: 'air', fields: [
            { k: 'length', label: 'Length', type: 'number', unit: 'in.' },
            { k: 'maxApd', label: 'Max pressure drop', type: 'number', unit: 'in. w.g.' }, NOTES] },
        { type: 'uv', label: 'UV lights', group: 'air', fields: [NOTES] },
        { type: 'access', label: 'Access / blank section', group: 'air', fields: [
            { k: 'length', label: 'Length', type: 'number', unit: 'in.' }, NOTES] },
        { type: 'smoke_damper', label: 'Smoke damper', group: 'air', fields: [NOTES] },
        { type: 'discharge', label: 'Discharge plenum', group: 'air', fields: [NOTES] }
    ];
    var TYPE_BY_KEY = {};
    SECTION_TYPES.forEach(function (t) { TYPE_BY_KEY[t.type] = t; });

    // ------------------------------------------------------------
    // Draft state
    // ------------------------------------------------------------

    var state = null;           // { values: {}, sections: [{ uid, type, values }], step }
    var files = [];             // File objects picked this session (not persisted)
    var selectedUid = null;     // configurator section being edited

    function blankState() {
        return { values: {}, sections: [], step: 0 };
    }

    function draftKey() {
        var me = HHpro.ProjectSync && HHpro.ProjectSync.me && HHpro.ProjectSync.me();
        return DRAFT_KEY + (me && me.email ? '.' + me.email : '');
    }

    function loadDraft() {
        try {
            var raw = localStorage.getItem(draftKey());
            var s = raw ? JSON.parse(raw) : null;
            if (s && s.values && Array.isArray(s.sections)) return s;
        } catch (e) { /* fall through */ }
        return blankState();
    }

    var saveTimer = null;
    function saveDraft() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            try { localStorage.setItem(draftKey(), JSON.stringify(state)); } catch (e) { /* storage full / blocked */ }
        }, 250);
    }

    function clearDraft() {
        try { localStorage.removeItem(draftKey()); } catch (e) { /* ignore */ }
    }

    function uid() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    // ------------------------------------------------------------
    // Small DOM helpers
    // ------------------------------------------------------------

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    function button(label, cls, onClick, icon) {
        var b = el('button', cls);
        b.type = 'button';
        if (icon) b.appendChild(HHpro.UI.icon(icon));
        if (label) b.appendChild(el('span', null, label));
        b.addEventListener('click', onClick);
        return b;
    }

    function shown(f, values) { return !f.when || f.when(values); }

    /**
     * Render a list of field defs bound to `values`. onChange(key) runs
     * after every edit; fields with `when` rules re-render via rerender().
     */
    function renderFields(container, defs, values, onChange, rerender) {
        var grid = el('div', 'ahu-fields');
        defs.forEach(function (f) {
            if (!shown(f, values)) return;
            if (f.type === 'heading') { grid.appendChild(el('h3', 'ahu-subhead', f.label)); return; }
            var wrap = el('label', 'ahu-field' + (f.wide ? ' is-wide' : '') + (f.type === 'check' ? ' is-check' : ''));
            var lab = el('span', 'ahu-label', f.label + (f.required ? ' *' : ''));
            var input;
            var v = values[f.k];
            if (f.type === 'select' || f.type === 'project') {
                input = el('select', 'ahu-input');
                var opts = f.type === 'project' ? projectOptions() : f.options;
                opts.forEach(function (o) {
                    var opt = el('option', null, o === '' ? '—' : (o.label || o));
                    opt.value = o.value != null ? o.value : o;
                    input.appendChild(opt);
                });
                input.value = v || '';
            } else if (f.type === 'textarea') {
                input = el('textarea', 'ahu-input ahu-textarea');
                input.rows = 3;
                input.value = v || '';
            } else if (f.type === 'check') {
                input = el('input', 'ahu-check');
                input.type = 'checkbox';
                input.checked = !!v;
            } else {
                input = el('input', 'ahu-input');
                input.type = f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text');
                if (f.type === 'number') input.step = 'any';
                input.value = v == null ? '' : v;
            }
            if (f.placeholder) input.placeholder = f.placeholder;
            var hasWhenDeps = defs.some(function (d) { return d.when; });
            var evt = (f.type === 'select' || f.type === 'check' || f.type === 'project' || f.type === 'date') ? 'change' : 'input';
            input.addEventListener(evt, function () {
                values[f.k] = f.type === 'check' ? input.checked : input.value;
                onChange(f.k);
                if (hasWhenDeps && (evt === 'change')) rerender();
            });
            if (f.type === 'check') {
                wrap.appendChild(input);
                wrap.appendChild(lab);
            } else {
                wrap.appendChild(lab);
                var row = el('span', 'ahu-input-row');
                row.appendChild(input);
                if (f.unit) row.appendChild(el('span', 'ahu-unit', f.unit));
                wrap.appendChild(row);
            }
            if (f.hint) wrap.appendChild(el('span', 'ahu-hint', f.hint));
            grid.appendChild(wrap);
        });
        container.appendChild(grid);
    }

    function projectOptions() {
        var out = [{ value: '', label: '—' }];
        var list = (HHpro.Cart && HHpro.Cart.listProjects) ? (HHpro.Cart.listProjects() || []) : [];
        list.forEach(function (p) { if (p && p.id) out.push({ value: p.id, label: p.name || p.id }); });
        return out;
    }

    // ------------------------------------------------------------
    // Form view
    // ------------------------------------------------------------

    var rootEl = null, bodyEl = null, navEl = null;

    HHpro.Views.ahu_request = {
        render: function (root) {
            rootEl = root;
            state = loadDraft();
            files = [];
            selectedUid = null;
            root.innerHTML = '';
            if (HHpro.Cart && typeof HHpro.Cart.init === 'function') HHpro.Cart.init();
            root.appendChild(HHpro.UI.buildHeader('Air Handler Design Request'));

            var main = el('main', 'app-main ahu-page');
            var top = el('div', 'ahu-topbar');
            var titles = el('div');
            titles.appendChild(el('h1', 'ahu-title', 'Air Handler Design Request'));
            titles.appendChild(el('p', 'ahu-sub',
                'Fill in what the engineer has given you, lay out the unit, attach the plans or spec, and submit. ' +
                'Only the fields marked * are required - your draft saves in this browser as you go.'));
            top.appendChild(titles);
            var actions = el('div', 'ahu-top-actions');
            actions.appendChild(button('My requests', 'ahu-btn', showMyRequests, 'folder'));
            actions.appendChild(button('Start over', 'ahu-btn', function () {
                if (!confirm('Clear this draft and start a new request?')) return;
                clearDraft();
                HHpro.Views.ahu_request.render(rootEl);
            }, 'undo'));
            top.appendChild(actions);
            main.appendChild(top);

            var layout = el('div', 'ahu-layout');
            navEl = el('nav', 'ahu-steps');
            bodyEl = el('section', 'ahu-body');
            layout.appendChild(navEl);
            layout.appendChild(bodyEl);
            main.appendChild(layout);
            root.appendChild(main);
            renderStep();
        }
    };

    function goTo(i) {
        state.step = Math.max(0, Math.min(STEPS.length - 1, i));
        saveDraft();
        renderStep();
        window.scrollTo(0, 0);
    }

    function renderNav() {
        navEl.innerHTML = '';
        STEPS.forEach(function (s, i) {
            var b = button((i + 1) + '. ' + s.title, 'ahu-step' + (i === state.step ? ' is-active' : ''), function () { goTo(i); });
            navEl.appendChild(b);
        });
    }

    function renderStep() {
        renderNav();
        bodyEl.innerHTML = '';
        var step = STEPS[state.step];
        bodyEl.appendChild(el('h2', 'ahu-step-title', step.title));
        var content = el('div', 'ahu-step-content');
        bodyEl.appendChild(content);

        function rerender() { renderStep(); }
        if (step.fields.length) {
            renderFields(content, step.fields, state.values, saveDraft, rerender);
        }
        if (step.custom === 'configurator') renderConfigurator(content);
        if (step.custom === 'files') renderFiles(content);
        if (step.custom === 'review') renderReview(content);

        var nav = el('div', 'ahu-stepnav');
        if (state.step > 0) nav.appendChild(button('Back', 'ahu-btn', function () { goTo(state.step - 1); }, 'arrow-left'));
        if (state.step < STEPS.length - 1) {
            var next = button('Next: ' + STEPS[state.step + 1].title, 'btn btn-primary ahu-next', function () { goTo(state.step + 1); });
            nav.appendChild(next);
        }
        bodyEl.appendChild(nav);
    }

    // ------------------------------------------------------------
    // Configurator
    // ------------------------------------------------------------

    function renderConfigurator(container) {
        var wrap = el('div', 'ahu-config');
        wrap.appendChild(el('h3', 'ahu-subhead', 'Sections in airflow order'));
        wrap.appendChild(el('p', 'ahu-hint',
            'Add sections from the palette, drag the blocks (or use the arrows) to put them in airflow order, ' +
            'and click a block to fill in its details. Example: return fan → economizer → prefilter → blender → ' +
            'preheat → cooling → reheat → humidifier → supply fan → final filters.'));

        // Diagram
        var diagram = el('div', 'ahu-diagram');
        var dragFrom = null;
        if (!state.sections.length) {
            diagram.appendChild(el('div', 'ahu-diagram-empty', 'No sections yet - add them from the palette below.'));
        }
        state.sections.forEach(function (sec, i) {
            var t = TYPE_BY_KEY[sec.type] || { label: sec.type, group: 'air' };
            var block = el('div', 'ahu-block ahu-g-' + t.group + (sec.uid === selectedUid ? ' is-selected' : ''));
            block.draggable = true;
            block.title = 'Click to edit, drag to move';
            block.appendChild(el('span', 'ahu-block-num', String(i + 1)));
            block.appendChild(el('span', 'ahu-block-label', t.label));
            block.addEventListener('click', function () { selectedUid = sec.uid === selectedUid ? null : sec.uid; renderStep(); });
            block.addEventListener('dragstart', function (e) {
                dragFrom = i;
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', String(i)); } catch (err) { /* IE */ }
            });
            block.addEventListener('dragover', function (e) { e.preventDefault(); block.classList.add('is-drop'); });
            block.addEventListener('dragleave', function () { block.classList.remove('is-drop'); });
            block.addEventListener('drop', function (e) {
                e.preventDefault();
                if (dragFrom === null || dragFrom === i) return;
                var moved = state.sections.splice(dragFrom, 1)[0];
                state.sections.splice(i, 0, moved);
                dragFrom = null;
                saveDraft();
                renderStep();
            });
            diagram.appendChild(block);
            if (i < state.sections.length - 1) diagram.appendChild(el('span', 'ahu-arrow', '→'));
        });
        var flow = el('div', 'ahu-flow-label', 'Airflow →');
        wrap.appendChild(flow);
        wrap.appendChild(diagram);

        // Palette
        var palette = el('div', 'ahu-palette');
        SECTION_TYPES.forEach(function (t) {
            palette.appendChild(button(t.label, 'ahu-chip ahu-g-' + t.group, function () {
                var sec = { uid: uid(), type: t.type, values: {} };
                // Insert after the selected block, else at the end.
                var at = state.sections.findIndex(function (s) { return s.uid === selectedUid; });
                if (at >= 0) state.sections.splice(at + 1, 0, sec); else state.sections.push(sec);
                selectedUid = sec.uid;
                saveDraft();
                renderStep();
            }, 'plus'));
        });
        wrap.appendChild(el('h3', 'ahu-subhead', 'Add a section'));
        wrap.appendChild(palette);

        // Editor for the selected section
        var idx = state.sections.findIndex(function (s) { return s.uid === selectedUid; });
        if (idx >= 0) {
            var sec = state.sections[idx];
            var t = TYPE_BY_KEY[sec.type];
            var ed = el('div', 'ahu-editor');
            var head = el('div', 'ahu-editor-head');
            head.appendChild(el('h3', 'ahu-subhead', (idx + 1) + '. ' + t.label));
            var tools = el('div', 'ahu-editor-tools');
            tools.appendChild(button('', 'ahu-icon-btn', function () { move(idx, -1); }, 'arrow-left'));
            tools.lastChild.title = 'Move upstream';
            var right = button('', 'ahu-icon-btn ahu-flip', function () { move(idx, 1); }, 'arrow-left');
            right.title = 'Move downstream';
            tools.appendChild(right);
            tools.appendChild(button('Remove', 'ahu-btn ahu-danger', function () {
                state.sections.splice(idx, 1);
                selectedUid = null;
                saveDraft();
                renderStep();
            }, 'x'));
            head.appendChild(tools);
            ed.appendChild(head);
            renderFields(ed, t.fields, sec.values, saveDraft, function () { renderStep(); });
            wrap.appendChild(ed);
        }
        container.insertBefore(wrap, container.firstChild);

        function move(i, d) {
            var j = i + d;
            if (j < 0 || j >= state.sections.length) return;
            var s = state.sections.splice(i, 1)[0];
            state.sections.splice(j, 0, s);
            saveDraft();
            renderStep();
        }
    }

    // ------------------------------------------------------------
    // Attachments
    // ------------------------------------------------------------

    function fmtSize(n) {
        return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
    }

    function renderFiles(container) {
        var box = el('div', 'ahu-files');
        box.appendChild(el('h3', 'ahu-subhead', 'Attachments'));
        box.appendChild(el('p', 'ahu-hint',
            'Plans, spec sections, schedules, sketches or the sequence of operation - up to ' + MAX_FILES +
            ' files, 25 MB each. Attachments aren\'t kept in the saved draft, so add them just before you submit.'));
        var input = el('input', 'ahu-file-input');
        input.type = 'file';
        input.multiple = true;
        var pick = button('Add files', 'ahu-btn', function () { input.click(); }, 'upload');
        var err = el('p', 'ahu-error');
        input.addEventListener('change', function () {
            err.textContent = '';
            Array.prototype.forEach.call(input.files, function (f) {
                var total = files.reduce(function (s, x) { return s + x.size; }, 0);
                if (files.length >= MAX_FILES) { err.textContent = 'At most ' + MAX_FILES + ' files.'; return; }
                if (f.size > MAX_FILE_BYTES) { err.textContent = f.name + ' is larger than 25 MB.'; return; }
                if (total + f.size > MAX_TOTAL_BYTES) { err.textContent = 'Attachments can total at most 75 MB.'; return; }
                files = files.filter(function (x) { return x.name !== f.name; });
                files.push(f);
            });
            input.value = '';
            renderStep();
        });
        box.appendChild(input);
        box.appendChild(pick);
        box.appendChild(err);
        var list = el('ul', 'ahu-file-list');
        files.forEach(function (f, i) {
            var li = el('li');
            li.appendChild(el('span', null, f.name + ' (' + fmtSize(f.size) + ')'));
            li.appendChild(button('', 'ahu-icon-btn', function () { files.splice(i, 1); renderStep(); }, 'x'));
            list.appendChild(li);
        });
        box.appendChild(list);
        container.appendChild(box);
    }

    // ------------------------------------------------------------
    // Summary + checks
    // ------------------------------------------------------------

    function display(f, v) {
        if (v == null || v === '' || v === false) return '';
        if (f.type === 'check') return 'Yes';
        if (f.type === 'project') {
            var p = projectOptions().filter(function (o) { return o.value === v; })[0];
            return p ? p.label : '';
        }
        return f.unit ? v + ' ' + f.unit : String(v);
    }

    function rowsFor(defs, values) {
        // Fields under a heading (Supply fan / Return fan ...) carry it in
        // their label so "Fan quantity" says which fan.
        var rows = [], heading = '';
        defs.forEach(function (f) {
            if (f.type === 'heading') { heading = f.label; return; }
            if (!shown(f, values)) return;
            var d = display(f, values[f.k]);
            if (d) rows.push([(heading ? heading + ' - ' : '') + f.label, d]);
        });
        return rows;
    }

    function sectionLabel(sec) {
        var t = TYPE_BY_KEY[sec.type];
        var label = t ? t.label : sec.type;
        var v = sec.values || {};
        if (v.coilType) label += ' (' + v.coilType + ')';
        if (v.merv) label += ' (MERV ' + v.merv + ')';
        if (v.ervType) label += ' (' + v.ervType + ')';
        return label;
    }

    function checks() {
        var warnings = [], errors = [];
        var v = state.values, secs = state.sections;
        if (!String(v.projectName || '').trim()) errors.push('Project name is required (Project step).');
        if (!String(v.location || '').trim()) errors.push('Job location is required (Project step).');
        if (!v.supplyCfm) errors.push('Supply airflow is required (Airflow & Fans step).');
        if (!secs.length) errors.push('Add the unit\'s sections on the Configuration step.');

        var types = secs.map(function (s) { return s.type; });
        var coolIdx = types.indexOf('cooling');
        if (secs.length && types.indexOf('supply_fan') < 0) warnings.push('No supply fan section in the configuration.');
        if (coolIdx >= 0) {
            var filtered = secs.slice(0, coolIdx).some(function (s) {
                return (s.type === 'prefilter' || s.type === 'final_filter') && Number(s.values.merv) >= 8;
            });
            if (!filtered) {
                warnings.push('ASHRAE 62.1-2022 requires a MERV 8 (or better) filter upstream of a dehumidifying coil - ' +
                              'none is placed ahead of the cooling coil.');
            }
        }
        secs.forEach(function (s, i) {
            if (s.type === 'cooling' && s.values.dehumidifies) {
                var reheatAfter = secs.slice(i + 1).some(function (x) { return x.type === 'reheat'; });
                if (!reheatAfter) {
                    warnings.push('The cooling coil dehumidifies but there is no reheat coil downstream of it - ' +
                                  'a preheat coil can\'t do reheat. Confirm where reheat sits and what heats it.');
                }
            }
            if (s.values.coating && s.values.coating !== 'None' && !s.values.derate) {
                warnings.push((i + 1) + '. ' + TYPE_BY_KEY[s.type].label + ': coated coil - confirm the capacity derate was included.');
            }
            if ((s.type === 'prefilter' || s.type === 'final_filter') && !s.values.dpBasis) {
                warnings.push((i + 1) + '. ' + TYPE_BY_KEY[s.type].label + ': ask which pressure drop (clean, mid-life or dirty) the fan static is based on.');
            }
            if (s.type === 'cooling' && s.values.coilType === 'DX' && !s.values.condensingUnit) {
                warnings.push((i + 1) + '. Cooling coil (DX): name the refrigerant and the condensing unit it is matched to.');
            }
        });
        if (v.noReturnFan && types.indexOf('return_fan') >= 0) {
            warnings.push('"No return fan" is checked but the configuration has a return fan section.');
        }
        if (!v.noReturnFan && v.returnCfm && types.indexOf('return_fan') < 0 && types.indexOf('exhaust_fan') < 0) {
            warnings.push('Return airflow is given but there is no return or relief fan - confirm, or check "No return fan".');
        }
        return { warnings: warnings, errors: errors };
    }

    function buildSummary() {
        var sections = [];
        STEPS.forEach(function (s) {
            if (!s.fields.length) return;
            var rows = rowsFor(s.fields, state.values);
            if (s.key === 'commercial' && files.length) {
                rows.push(['Attachments', files.map(function (f) { return f.name; }).join(', ')]);
            }
            if (rows.length) sections.push({ title: s.title, rows: rows });
        });
        state.sections.forEach(function (sec, i) {
            var t = TYPE_BY_KEY[sec.type];
            var rows = rowsFor(t.fields, sec.values || {});
            sections.push({ title: 'Section ' + (i + 1) + ': ' + t.label, rows: rows.length ? rows : [['Details', 'none given']] });
        });
        var c = checks();
        return {
            projectName: String(state.values.projectName || '').trim(),
            configuration: state.sections.map(sectionLabel).join(' → '),
            warnings: c.warnings,
            sections: sections
        };
    }

    // ------------------------------------------------------------
    // Review + submit
    // ------------------------------------------------------------

    function renderReview(container) {
        var c = checks();
        var summary = buildSummary();
        if (c.errors.length) {
            var eb = el('div', 'ahu-alert is-error');
            eb.appendChild(el('strong', null, 'Needed before you can submit'));
            var ul = el('ul');
            c.errors.forEach(function (e) { ul.appendChild(el('li', null, e)); });
            eb.appendChild(ul);
            container.appendChild(eb);
        }
        if (c.warnings.length) {
            var wb = el('div', 'ahu-alert is-warn');
            wb.appendChild(el('strong', null, 'Check with the engineer (included in the request)'));
            var wl = el('ul');
            c.warnings.forEach(function (w) { wl.appendChild(el('li', null, w)); });
            wb.appendChild(wl);
            container.appendChild(wb);
        }
        if (summary.configuration) {
            var cfg = el('p', 'ahu-config-string');
            cfg.appendChild(el('strong', null, 'Configuration: '));
            cfg.appendChild(document.createTextNode(summary.configuration));
            container.appendChild(cfg);
        }
        summary.sections.forEach(function (sec) {
            var box = el('div', 'ahu-review-sec');
            box.appendChild(el('h3', 'ahu-subhead', sec.title));
            var dl = el('dl', 'ahu-review-list');
            sec.rows.forEach(function (r) {
                dl.appendChild(el('dt', null, r[0]));
                dl.appendChild(el('dd', null, r[1]));
            });
            box.appendChild(dl);
            container.appendChild(box);
        });

        var status = el('p', 'ahu-status');
        status.setAttribute('role', 'status');
        var submitBtn = button('Submit request', 'btn btn-primary ahu-submit', function () {
            submit(submitBtn, status);
        }, 'check');
        submitBtn.disabled = c.errors.length > 0;
        var bar = el('div', 'ahu-submit-bar');
        bar.appendChild(submitBtn);
        bar.appendChild(status);
        container.appendChild(bar);
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

    function submit(btn, status) {
        btn.disabled = true;
        status.className = 'ahu-status';
        status.textContent = 'Saving the request…';
        var summary = buildSummary();
        var payload = { form: { values: state.values, sections: state.sections }, summary: summary };
        var id;
        api('api/ahu-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(function (res) {
                id = res.id;
                // Upload attachments one at a time so a large set doesn't
                // hit the request size limit.
                return files.reduce(function (p, f, i) {
                    return p.then(function () {
                        status.textContent = 'Uploading ' + f.name + ' (' + (i + 1) + ' of ' + files.length + ')…';
                        return api('api/ahu-requests/' + id + '/files/' + encodeURIComponent(f.name), {
                            method: 'PUT', headers: { 'Content-Type': f.type || 'application/octet-stream' }, body: f
                        });
                    });
                }, Promise.resolve());
            })
            .then(function () {
                status.textContent = 'Submitting…';
                return api('api/ahu-requests/' + id + '/submit', { method: 'POST' });
            })
            .then(function (res) {
                clearDraft();
                showSubmitted(res);
            })
            .catch(function (err) {
                btn.disabled = false;
                status.className = 'ahu-status is-error';
                status.textContent = 'Could not submit: ' + err.message + '. Your draft is still saved - try again.';
            });
    }

    function showSubmitted(res) {
        bodyEl.innerHTML = '';
        navEl.innerHTML = '';
        var box = el('div', 'ahu-done');
        box.appendChild(el('h2', 'ahu-step-title', 'Request submitted'));
        box.appendChild(el('p', null, res.email === 'sent'
            ? 'Thanks - your request has been sent to Hoffman & Hoffman. We\'ll follow up with you.'
            : 'Thanks - your request is saved and Hoffman & Hoffman will see it on their request list.'));
        box.appendChild(el('p', 'ahu-hint', 'Request ID: ' + res.id));
        var acts = el('div', 'ahu-stepnav');
        acts.appendChild(button('Start another request', 'btn btn-primary', function () { HHpro.Views.ahu_request.render(rootEl); }));
        acts.appendChild(button('My requests', 'ahu-btn', showMyRequests, 'folder'));
        box.appendChild(acts);
        bodyEl.appendChild(box);
        state = blankState();
        files = [];
    }

    // ------------------------------------------------------------
    // My requests (signed-in user) and the admin list
    // ------------------------------------------------------------

    function fmtDate(iso) {
        var d = new Date(iso);
        return isNaN(d) ? '—' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    }

    function showMyRequests() {
        navEl.innerHTML = '';
        bodyEl.innerHTML = '';
        bodyEl.appendChild(el('h2', 'ahu-step-title', 'My requests'));
        var holder = el('div');
        holder.appendChild(el('p', 'ahu-hint', 'Loading…'));
        bodyEl.appendChild(holder);
        var back = el('div', 'ahu-stepnav');
        back.appendChild(button('Back to the form', 'ahu-btn', function () { renderStep(); }, 'arrow-left'));
        bodyEl.appendChild(back);
        api('api/ahu-requests').then(function (res) {
            holder.innerHTML = '';
            holder.appendChild(requestTable(res.requests || [], false));
        }, function () {
            holder.innerHTML = '';
            holder.appendChild(el('p', 'ahu-error', 'Could not load your requests.'));
        });
    }

    function requestTable(list, admin) {
        if (!list.length) return el('p', 'ahu-hint', 'No requests submitted yet.');
        var table = el('table', 'ahu-table');
        var head = el('tr');
        (admin ? ['Submitted', 'From', 'Project', 'Files', 'Email', 'Status', ''] : ['Submitted', 'Project', 'Files', 'Status', ''])
            .forEach(function (h) { head.appendChild(el('th', null, h)); });
        var thead = el('thead'); thead.appendChild(head); table.appendChild(thead);
        var tbody = el('tbody');
        list.forEach(function (r) {
            var tr = el('tr');
            tr.appendChild(el('td', null, fmtDate(r.submittedAt)));
            if (admin) tr.appendChild(el('td', null, r.owner));
            tr.appendChild(el('td', null, r.projectName || '—'));
            tr.appendChild(el('td', null, String((r.files || []).length)));
            if (admin) {
                var em = el('td', null, r.emailStatus || '—');
                if (r.emailError) em.title = r.emailError;
                tr.appendChild(em);
                var st = el('td');
                var sel = el('select', 'ahu-input ahu-status-select');
                ['submitted', 'in review', 'quoted', 'closed'].forEach(function (s) {
                    var o = el('option', null, s); o.value = s; sel.appendChild(o);
                });
                sel.value = r.status;
                sel.addEventListener('change', function () {
                    api('api/admin/ahu-requests/' + r.id + '/status', {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: sel.value })
                    }).catch(function (e) { alert('Could not update the status: ' + e.message); sel.value = r.status; });
                });
                st.appendChild(sel);
                tr.appendChild(st);
            } else {
                tr.appendChild(el('td', null, r.status));
            }
            var td = el('td');
            var detailRow = el('tr', 'ahu-detail-row');
            var detailCell = el('td');
            detailCell.colSpan = admin ? 7 : 5;
            detailRow.appendChild(detailCell);
            detailRow.hidden = true;
            td.appendChild(button('Details', 'ahu-btn', function () {
                detailRow.hidden = !detailRow.hidden;
                if (!detailRow.hidden && !detailCell.childNodes.length) loadDetail(r, detailCell);
            }));
            tr.appendChild(td);
            tbody.appendChild(tr);
            tbody.appendChild(detailRow);
        });
        table.appendChild(tbody);
        return table;
    }

    function loadDetail(r, cell) {
        cell.appendChild(el('p', 'ahu-hint', 'Loading…'));
        api('api/ahu-requests/' + r.id).then(function (res) {
            cell.innerHTML = '';
            var s = (res.data && res.data.summary) || {};
            if (s.configuration) {
                var cfg = el('p', 'ahu-config-string');
                cfg.appendChild(el('strong', null, 'Configuration: '));
                cfg.appendChild(document.createTextNode(s.configuration));
                cell.appendChild(cfg);
            }
            if ((s.warnings || []).length) {
                var wb = el('div', 'ahu-alert is-warn');
                var wl = el('ul');
                s.warnings.forEach(function (w) { wl.appendChild(el('li', null, w)); });
                wb.appendChild(wl);
                cell.appendChild(wb);
            }
            (s.sections || []).forEach(function (sec) {
                var box = el('div', 'ahu-review-sec');
                box.appendChild(el('h3', 'ahu-subhead', sec.title));
                var dl = el('dl', 'ahu-review-list');
                (sec.rows || []).forEach(function (row) {
                    dl.appendChild(el('dt', null, row[0]));
                    dl.appendChild(el('dd', null, row[1]));
                });
                box.appendChild(dl);
                cell.appendChild(box);
            });
            if ((res.files || []).length) {
                var box2 = el('div', 'ahu-review-sec');
                box2.appendChild(el('h3', 'ahu-subhead', 'Attachments'));
                var ul = el('ul', 'ahu-file-list');
                res.files.forEach(function (f) {
                    var li = el('li');
                    var a = el('a', null, f.name + ' (' + fmtSize(f.size) + ')');
                    a.href = 'api/ahu-requests/' + r.id + '/files/' + encodeURIComponent(f.name);
                    a.setAttribute('download', f.name);
                    li.appendChild(a);
                    ul.appendChild(li);
                });
                box2.appendChild(ul);
                cell.appendChild(box2);
            }
        }, function () {
            cell.innerHTML = '';
            cell.appendChild(el('p', 'ahu-error', 'Could not load this request.'));
        });
    }

    HHpro.Views.ahu_admin = {
        render: function (root) {
            root.innerHTML = '';
            if (HHpro.Cart && typeof HHpro.Cart.init === 'function') HHpro.Cart.init();
            root.appendChild(HHpro.UI.buildHeader('Design Requests'));
            var main = el('main', 'app-main ahu-page');
            var top = el('div', 'ahu-topbar');
            top.appendChild(el('h1', 'ahu-title', 'Air Handler Design Requests'));
            top.appendChild(button('All saved projects', 'ahu-btn', function () { HHpro.App.showView('admin'); }, 'folder'));
            main.appendChild(top);
            var holder = el('div');
            main.appendChild(holder);
            root.appendChild(main);
            if (!(HHpro.ProjectSync && HHpro.ProjectSync.isAdmin())) {
                holder.appendChild(el('p', 'ahu-hint', 'This page is only available to administrators.'));
                return;
            }
            holder.appendChild(el('p', 'ahu-hint', 'Loading…'));
            api('api/admin/ahu-requests').then(function (res) {
                holder.innerHTML = '';
                holder.appendChild(requestTable(res.requests || [], true));
            }, function () {
                holder.innerHTML = '';
                holder.appendChild(el('p', 'ahu-error', 'Could not load requests.'));
            });
        }
    };

    // Exposed for testing / other views
    HHpro.AhuRequest = { buildSummary: function () { return buildSummary(); }, checks: function () { return checks(); } };
})();
