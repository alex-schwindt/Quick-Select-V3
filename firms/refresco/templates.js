/* ============================================================
   HHpro - Refresco schedule templates
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
    var s = h.s, combine = h.combine, voltPh = h.voltPh, slash = h.slash, firstNumber = h.firstNumber;

    // =================================================================
    // Refresco templates
    // =================================================================

    function refrescoMiniSplit() {
        return {
            orientation: 'rows',
            title: 'SPLIT SYSTEM UNIT',
            header: [
                // Tier A - super groups
                { r: 0, c: 0, colspan: 13, label: 'AIR HANDLING UNIT' },
                { r: 0, c: 13, colspan: 3, label: 'OUTDOOR CONDENSING UNIT' },
                { r: 0, c: 16, colspan: 2, label: 'SINGLE POINT POWER (TO OUTDOOR UNIT*)' },
                // Tier B / C
                { r: 1, c: 0, rowspan: 2, label: 'UNIT NO.' },
                { r: 1, c: 1, rowspan: 2, label: 'MANUFACTURER & MODEL #' },
                { r: 1, c: 2, rowspan: 2, label: 'SERVES' },
                { r: 1, c: 3, colspan: 2, label: 'SUPPLY - FAN DATA' },
                { r: 2, c: 3, label: 'TOTAL CFM' },
                { r: 2, c: 4, label: 'MIN O.A CFM' },
                { r: 1, c: 5, colspan: 3, label: 'COOLING CAPACITY' },
                { r: 2, c: 5, label: 'TOTAL (btuh)' },
                { r: 2, c: 6, label: 'E. DB (F)' },
                { r: 2, c: 7, label: 'E. WB (F)' },
                { r: 1, c: 8, colspan: 2, label: 'HEATING CAPACITY' },
                { r: 2, c: 8, label: 'TOTAL (btuh)' },
                { r: 2, c: 9, label: 'AMBIENT (F)' },
                { r: 1, c: 10, label: 'EFFICIENCY' },
                { r: 2, c: 10, label: 'SEER' },
                { r: 1, c: 11, colspan: 2, label: 'INDOOR UNIT ELECTRICAL DATA*' },
                { r: 2, c: 11, label: 'VOLT/PH' },
                { r: 2, c: 12, label: 'MCA/MOCP' },
                { r: 1, c: 13, colspan: 3, label: 'GENERAL DATA' },
                { r: 2, c: 13, label: 'UNIT NO.' },
                { r: 2, c: 14, label: 'MANUFACTURER & MODEL' },
                { r: 2, c: 15, label: 'WEIGHT (LBS)' },
                { r: 1, c: 16, colspan: 2, label: 'ELECTRICAL DATA' },
                { r: 2, c: 16, label: 'VOLT/PH' },
                { r: 2, c: 17, label: 'MCA/MOP' }
            ],
            columns: [
                { scope: 'row', derive: function (g) { return s(g.item.indoorTags && g.item.indoorTags[g.rowIndex]); } },
                { scope: 'row', derive: function (g) { return combine(g.cell('L'), g.cell('M')); } },
                { scope: 'item', editable: true, fieldKey: 'refresco_ms_serves' },
                { scope: 'row', derive: function (g) { return g.cell('A'); } },
                { scope: 'row', editable: true, fieldKey: 'refresco_ms_min_oa_cfm' },
                { scope: 'row', derive: function (g) { return g.cell('D'); } },
                { scope: 'row', derive: function (g) { return g.cell('B'); } },
                { scope: 'row', derive: function (g) { return g.cell('C'); } },
                { scope: 'row', derive: function (g) { return g.cell('F'); } },
                { scope: 'row', derive: function (g) { return g.cell('O'); } },
                { scope: 'item', derive: function (g) { return firstNumber(g.cell('Q')); } },
                // Indoor units fed from the outdoor single-point feed have
                // no independent service, so BOTH the indoor VOLT/PH and
                // MCA/MOCP read "-" (the real feed lives in the SINGLE POINT
                // POWER column, cols 16/17). Column J flags the indoor power
                // source; if a unit were ever independently powered it would
                // fall back to showing its own voltage.
                { scope: 'item', derive: function (g) {
                    return /powered from outdoor/i.test(g.cell('I'))
                        ? '-' : voltPh(g.cell('R'));
                } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function (g) { return s(g.item.tag); } },
                { scope: 'item', derive: function (g) { return combine(g.cell('U'), g.cell('V')); } },
                { scope: 'item', derive: function (g) { return g.cell('P'); } },
                { scope: 'item', derive: function (g) { return voltPh(g.cell('R')); } },
                { scope: 'item', derive: function (g) { return slash(g.cell('S'), g.cell('T')); } }
            ],
            notesTitle: '',
            // One bordered note box, text on multiple rows (matches the
            // wrapped merged note cell in the Refresco Excel template).
            notes: [
                '* POWER IS SINGLE POINT CONNECTION TO BE MADE TO OUTDOOR CONDENSING UNIT.',
                'POWER FROM CONDENSING UNIT SHALL BE PROVIDED TO INDOOR UNIT.',
                "FOLLOW MANUFACTURER'S INSTALLATION INSTRUCTIONS.",
                'PROVIDE DISCONNECT AT INDOOR AND OUTDOOR LOCATION.',
                'UNIT SHALL BE SUPPLIED WITH ALL PROVISIONS NECESSARY FOR LOW AMBIENT COOLING.',
                'PROVIDE INTEGRAL CONDENSATE PUMP.'
            ],
            manufacturers: null
        };
    }

    function refrescoRtu() {
        return {
            orientation: 'columns',
            title: 'ROOFTOP PACKAGED AIR HANDLING UNITS',
            attributes: [
                { band: 'top', label: 'TAG:', derive: function (g) { return s(g.item.tag); } },
                { band: 'top', label: 'MANUFACTURER:', derive: function (g) { return g.cell('A'); } },
                { band: 'top', label: 'UNIT MODEL NUMBER:', derive: function (g) { return g.cell('B'); } },
                { band: 'top', label: 'WEIGHT:', derive: function (g) { return g.cell('Y'); } },

                { band: 'main', label: 'NOTES', editable: true, fieldKey: 'refresco_rtu_notes' },
                { band: 'main', label: 'SUPPLY  CFM', derive: function (g) { return g.cell('D'); } },
                { band: 'main', label: 'SUPPLY FAN HP', derive: function (g) { return g.cell('V'); } },
                { band: 'main', label: 'EXTERNAL  STATIC  PRESSURE  (IN.  OF WATER)', derive: function (g) { return g.cell('E'); } },
                { band: 'main', label: 'NOMINAL  CAPACITY  (TONS)', derive: function (g) { return g.cell('C'); } },
                { band: 'main', label: 'GROSS  TOT COOLING  CAP.  (BTU/h)', derive: function (g) { return g.cell('G'); } },
                { band: 'main', label: 'EFFICIENCY', derive: function (g) { return g.cell('I'); } },
                { band: 'main', label: 'COOLING STAGES', derive: function (g) { return g.cell('T'); } },
                { band: 'main', label: 'INPUT HEATING  CAP.  (MBH)  -  NAT.  GAS', derive: function (g) { return g.cell('N'); } },
                { band: 'main', label: 'OUTPUT HEATING  CAP.  (MBH)', derive: function (g) { return g.cell('O'); } },
                { band: 'main', label: 'HEATING  STAGES', derive: function (g) { return g.cell('P'); } },
                { band: 'main', label: 'VOLTAGE/PHASE', derive: function (g) { return g.cell('U'); } },
                { band: 'main', label: 'SINGLE  POINT ELEC.  CONN.   MCA(A)/MOP(A)', derive: function (g) { return slash(g.cell('W'), g.cell('X')); } },
                { band: 'main', label: 'SEISMIC IMPORTANCE  FACTOR  (IP)', editable: true, fieldKey: 'refresco_rtu_seismic' }
            ],
            notesTitle: 'NOTES:',
            notes: [
                '1. PROVIDE FACTORY ROOF CURB.',
                '2. R-32 REFRIGERANT',
                '3. PROVIDE TWO POSITION OUTSIDE AIR DAMPER, POWERED CLOSED WHEN UNIT IS OFF',
                '4. PROVIDE 2" PLEATED FILTERS',
                '5. PROVIDE PROGRAMMABLE THERMOSTAT',
                '6. PROVIDE A WATER LEVEL DETECTION DEVICE CONFORMING TO UL508 TO SHUT OFF',
                '     THE EQUIPMENT IN THE EVENT THAT THE PRIMARY DRAIN IS BLOCKED',
                '7. PROVIDE DRY BULB ECONOMIZER, POWERED CLOSED WHEN UNIT IS OFF.',
                '8. PROVIDE HOT GAS REHEAT DEHUMIDIFICATION'
            ],
            manufacturers:
                'ACCEPTABLE MANUFACTURERS:\n' +
                '1.  TRANE          4.  DAIKIN\n' +
                '2.  CARRIER        5.  TEMPMASTER'
        };
    }

    T.register('refresco', 'Refresco', {
        mini_splits: refrescoMiniSplit,
        gas_packs: refrescoRtu
    });
})();
