/* ============================================================
   HHpro - Barrett Woodyard & Associates schedule templates
   ------------------------------------------------------------
   Served ONLY to users allowed this firm: Cloudflare Access signs
   the user in, then worker/index.js checks their
   email against server/firm-access.js before this file is sent.
   Loaded by HHpro.Templates.loadFirms() (JS/schedule_templates.js),
   which also documents the template model used below.
   ============================================================ */

(function () {
    'use strict';

    var T = window.HHpro && HHpro.Templates;
    if (!T || typeof T.register !== 'function') return;
    var h = T.helpers;
    var s = h.s, combine = h.combine, voltPh = h.voltPh, isPositiveNum = h.isPositiveNum, div1000 = h.div1000, mbh = h.mbh;

    // =================================================================
    // Barrett Woodyard & Associates templates
    // Circled note refs (① = (1) ... ) render as circles on screen /
    // Excel / print-PDF; the DXF + full-PDF emitters transliterate them
    // to "(1)" etc. (see export.js). Fields HHpro has no live source for
    // are constant defaults here - engineers tweak per-unit via the
    // "Edit Schedule" button rather than inline inputs.
    // =================================================================

    function barrettWoodyardMultiSplit() {
        return {
            orientation: 'rows',
            title: 'SPLIT SYSTEM SCHEDULE',
            header: [
                { r: 0, c: 3, colspan: 9, label: 'FAN COIL UNIT DATA' },
                { r: 0, c: 12, colspan: 4, label: 'HEATING SECTION' },
                { r: 0, c: 16, colspan: 4, label: 'CONDENSING UNIT DATA' },
                { r: 0, c: 0, rowspan: 3, label: 'I.D. TAG' },
                { r: 0, c: 1, rowspan: 3, label: 'MINIMUM TOTAL CAP. (BTUH)' },
                { r: 0, c: 2, rowspan: 3, label: 'MINIMUM SENSIBLE CAP. (BTUH)' },
                { r: 0, c: 20, rowspan: 3, label: 'BASIS OF DESIGN' },
                { r: 0, c: 21, rowspan: 3, label: 'REMARKS' },
                { r: 1, c: 3, rowspan: 2, label: 'AIRFLOW (CFM)' },
                { r: 1, c: 4, rowspan: 2, label: 'OUTSIDE AIR (CFM)' },
                { r: 1, c: 5, rowspan: 2, label: 'EXT. S.P. (IN. W.C.) ①' },
                { r: 1, c: 6, rowspan: 2, label: 'MAX H.P.' },
                { r: 1, c: 7, colspan: 2, label: 'COIL EAT' },
                { r: 2, c: 7, label: '°F db' },
                { r: 2, c: 8, label: '°F wb' },
                { r: 1, c: 9, rowspan: 2, label: 'VOLTS/ PHASE' },
                { r: 1, c: 10, rowspan: 2, label: 'DRIVE ②' },
                { r: 1, c: 11, rowspan: 2, label: 'TYPE OF UNIT' },
                { r: 1, c: 12, colspan: 2, label: 'PRIMARY HEATING' },
                { r: 2, c: 12, label: 'TYPE' },
                { r: 2, c: 13, label: 'CAPACITY③' },
                { r: 1, c: 14, colspan: 2, label: 'SECONDARY HEATING' },
                { r: 2, c: 14, label: 'TYPE' },
                { r: 2, c: 15, label: 'CAPACITY③' },
                { r: 1, c: 16, rowspan: 2, label: 'AMBIENT TEMP. (F)' },
                { r: 1, c: 17, rowspan: 2, label: 'VOLTS/ PHASE' },
                { r: 1, c: 18, rowspan: 2, label: 'STAGES' },
                { r: 1, c: 19, rowspan: 2, label: 'EFFICIENCY' }
            ],
            columns: [
                { scope: 'item', derive: function (g) { return s(g.item.indoorTags && g.item.indoorTags[0]) + '/' + s(g.item.tag); } },
                { scope: 'item', derive: function (g) { return g.cell('I'); } },
                { scope: 'item', derive: function (g) { return g.cell('J'); } },
                { scope: 'item', capacityField: 'airflow', derive: function (g) { return g.cell('C'); } },
                { scope: 'item', editable: true, fieldKey: 'bw_ms_oa_cfm' },
                { scope: 'item', derive: function () { return '0.5'; } },
                { scope: 'item', derive: function (g) { return g.cell('D'); } },
                { scope: 'item', capacityField: 'eatDb', derive: function (g) { return g.cell('F'); } },
                { scope: 'item', capacityField: 'eatWb', derive: function (g) { return g.cell('G'); } },
                { scope: 'item', derive: function (g) { return voltPh(g.cell('N')); } },
                { scope: 'item', derive: function () { return 'D'; } },
                { scope: 'item', derive: function () { return 'MULTI-POSITION AHU'; } },
                { scope: 'item', derive: function (g) { return isPositiveNum(g.cell('U')) ? 'HP' : '-'; } },
                { scope: 'item', derive: function (g) { return isPositiveNum(g.cell('U')) ? mbh(g.cell('U')) : '-'; } },
                { scope: 'item', derive: function (g) { return isPositiveNum(g.cell('L')) ? 'ELEC' : '-'; } },
                { scope: 'item', kwSelect: true, derive: function (g) { return isPositiveNum(g.cell('L')) ? g.cell('L') : '-'; } },
                { scope: 'item', derive: function () { return '95'; } },
                { scope: 'item', derive: function (g) { return voltPh(g.cell('W')); } },
                { scope: 'item', derive: function () { return '1'; } },
                { scope: 'item', derive: function (g) { return g.cell('AB'); } },
                { scope: 'item', derive: function (g) { return combine(g.cell('R'), g.cell('S')) + '/' + s(g.cell('B')); } },
                { scope: 'item', derive: function () { return '① ② ③ ④ ⑤ ⑥ ⑦'; } }
            ],
            notesTitle: '',
            notes: [
                '① THIS IS THE SP EXTERNAL TO THE ENTIRE FAN COIL UNIT ASSEMBLY (WET COIL, CASING, CLEAN FILTERS, AND FURNACE LOSSES ARE NOT INCLUDED IN THIS EXT. SP.)',
                '② B = BELT DRIVE, D = DIRECT',
                '③ HP STANDS FOR HEAT PUMP AND CAPACITY IS GIVEN IN MBH, ELEC STANDS FOR ELECTRIC HEAT AND VALUES ARE GIVEN IN kW.',
                '④ PROVIDE WITH REMOTE WALL MOUNTED THERMOSTAT LOCATED AS SHOWN ON PLANS.',
                '⑤ PROVIDE AIR HANDLER WITH VARIABLE SPEED ECM FAN.',
                '⑥ CONDENSATE IS TO BE CONNECTED INTO EXISTING CONDENSATE DRAIN FROM EXISTING UNITS BEING REPLACED.',
                '⑦ BLOWER COIL UNIT SHALL BE ENCOMPASSED BY A DRAIN PAN AND ALSO CONSIST OF A FLOAT SWITCH LOCATED IN DRAIN PAN TO DISABLE UNIT UNDER WATER DETECTION.'
            ],
            manufacturers: null
        };
    }

    function barrettWoodyardRtu() {
        return {
            orientation: 'rows',
            title: 'PACKAGED ROOF TOP UNITS',
            header: [
                { r: 0, c: 0, rowspan: 2, label: 'I.D. TAG' },
                { r: 0, c: 1, rowspan: 2, label: 'MINIMUM TOTAL CAP. (MBH)' },
                { r: 0, c: 2, rowspan: 2, label: 'MINIMUM SENSIBLE CAP. (MBH)' },
                { r: 0, c: 3, rowspan: 2, label: 'AMBIENT TEMP (°F)' },
                { r: 0, c: 4, colspan: 2, label: 'COIL EAT' },
                { r: 1, c: 4, label: '°F db' },
                { r: 1, c: 5, label: '°F wb' },
                { r: 0, c: 6, rowspan: 2, label: 'AIRFLOW (CFM)' },
                { r: 0, c: 7, rowspan: 2, label: 'EXT. S.P. (IN. W.C.)' },
                { r: 0, c: 8, rowspan: 2, label: 'MAX H.P.' },
                { r: 0, c: 9, rowspan: 2, label: 'OUTSIDE AIR (CFM)' },
                { r: 0, c: 10, colspan: 3, label: 'HEATING' },
                { r: 1, c: 10, label: 'TYPE' },
                { r: 1, c: 11, label: 'INPUT' },
                { r: 1, c: 12, label: 'OUTPUT' },
                { r: 0, c: 13, rowspan: 2, label: 'VOLTS/ PHASE' },
                { r: 0, c: 14, rowspan: 2, label: 'MCA' },
                { r: 0, c: 15, rowspan: 2, label: 'MOCP' },
                { r: 0, c: 16, rowspan: 2, label: 'BASIS OF DESIGN' },
                { r: 0, c: 17, rowspan: 2, label: 'EFFICIENCY (AT AHRI)' },
                { r: 0, c: 18, rowspan: 2, label: 'APPROX. UNIT WEIGHT (LBS)' },
                { r: 0, c: 19, rowspan: 2, label: 'REMARKS' }
            ],
            columns: [
                { scope: 'item', derive: function (g) { return s(g.item.tag); } },
                { scope: 'item', derive: function (g) { return div1000(g.cell('G')); } },
                { scope: 'item', derive: function (g) { return div1000(g.cell('H')); } },
                { scope: 'item', derive: function () { return '95'; } },
                { scope: 'item', derive: function (g) { return g.cell('J'); } },
                { scope: 'item', derive: function (g) { return g.cell('K'); } },
                { scope: 'item', derive: function (g) { return g.cell('D'); } },
                { scope: 'item', derive: function (g) { return g.cell('E'); } },
                { scope: 'item', derive: function (g) { return g.cell('V'); } },
                { scope: 'item', editable: true, fieldKey: 'bw_rtu_oa_cfm' },
                { scope: 'item', derive: function () { return 'GAS'; } },
                { scope: 'item', derive: function (g) { return g.cell('N'); } },
                { scope: 'item', derive: function (g) { return g.cell('O'); } },
                { scope: 'item', derive: function (g) { return g.cell('U'); } },
                { scope: 'item', derive: function (g) { return g.cell('W'); } },
                { scope: 'item', derive: function (g) { return g.cell('X'); } },
                { scope: 'item', derive: function (g) { return combine(g.cell('A'), g.cell('B')); } },
                { scope: 'item', derive: function (g) { return g.cell('I'); } },
                { scope: 'item', derive: function (g) { return g.cell('Y'); } },
                { scope: 'item', derive: function () { return '① ② ③ ④ ⑤ ⑥ ⑦ ⑧ ⑨'; } }
            ],
            notesTitle: '',
            notes: [
                '① THIS IS THE STATIC PRESSURE EXTERNAL TO THE UNIT. IT DOES NOT INCLUDE COIL, CASING, FILTER, OR HEATER LOSSES',
                '② PROVIDE UNIT COMPLETE FACTORY DISCONNECT W/ LOCKOUT PROTECTION CAPABILITY.',
                '③ CAPACITY IN MBH.',
                '④ SUPPLY FAN SHALL BE CAPABLE OF SUPPLYING AIRFLOW AT CFM & E.S.P. (IN. W.C.) AS INDICATED ON SCHEDULED ABOVE',
                '⑤ PROVIDE SMOKE DETECTOR IN UNIT SUPPLY AND RETURN. INSTALLATION SHALL BE IN ACCORDANCE WITH NFPA 72E. COORD. W/ DIVISION 16.',
                '⑥ POWERED WEATHERPROOF GFI DEDICATED CONVENIENCE OUTLET TO BE PROVIDED, COORDINATE WITH ELECTRICAL.',
                '⑦ PROVIDE UNIT WITH COMPARATIVE ENTHALPY ECONOMIZER',
                '⑧ PROVIDE WITH HAIL GUARD',
                '⑨ PROVIDE WITH 2 MULTI-STAGE COMPRESSORS.'
            ],
            manufacturers: null
        };
    }

    T.register('barrett_woodyard', 'Barrett Woodyard & Associates', {
        multi_position_splits: barrettWoodyardMultiSplit,
        gas_packs: barrettWoodyardRtu
    });
})();
