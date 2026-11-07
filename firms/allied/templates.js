/* ============================================================
   HHpro - Allied schedule templates
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
    var s = h.s, voltPh = h.voltPh, isPositiveNum = h.isPositiveNum, div1000 = h.div1000, modelPart = h.modelPart;

    // =================================================================
    // Allied templates
    // Mapped from DATA/ENGINEER SCHEDULES/ALLIED.xlsx. Note refs are the
    // firm's own plain comma lists ("1,2,3..."), not circled digits.
    // Nominal tonnage has no scheduleData letter - it comes from the
    // SIZE filter value via g.filter('SIZE'). Fields with no data
    // source (LOCATION, OA CFM) are inline-editable; ESP is the firm's
    // constant 0.5 default, tweakable via Edit Schedule.
    // =================================================================

    function alliedMultiSplit() {
        return {
            orientation: 'rows',
            title: 'SPLIT SYSTEM SCHEDULE',
            header: [
                { r: 0, c: 0, label: 'TAG' },
                { r: 0, c: 1, label: 'TEMPMASTER AIR HANDLER MODEL NO.' },
                { r: 0, c: 2, label: 'NOMINAL TONS' },
                { r: 0, c: 3, label: 'LOCATION' },
                { r: 0, c: 4, label: 'TOTAL CFM' },
                { r: 0, c: 5, label: 'OA CFM' },
                { r: 0, c: 6, label: 'MAX FAN HP' },
                { r: 0, c: 7, label: 'ESP' },
                { r: 0, c: 8, label: 'MBH TOT. COOL' },
                { r: 0, c: 9, label: 'MBH SENS. COOL' },
                { r: 0, c: 10, label: 'EFFICIENCY' },
                { r: 0, c: 11, label: 'HEAT PUMP HEAT' },
                { r: 0, c: 12, label: 'HEAT KW' },
                { r: 0, c: 13, label: 'VOLTS/ PHASE' },
                { r: 0, c: 14, label: 'MCA' },
                { r: 0, c: 15, label: 'MOCP' },
                { r: 0, c: 16, label: 'TAG' },
                { r: 0, c: 17, label: 'TEMPMASTER CONDENSING UNIT MODEL NO.' },
                { r: 0, c: 18, label: 'VOLTS/ PHASE' },
                { r: 0, c: 19, label: 'MCA' },
                { r: 0, c: 20, label: 'MOCP' },
                { r: 0, c: 21, label: 'NOTES' }
            ],
            columns: [
                { scope: 'item', derive: function (g) { return s(g.item.indoorTags && g.item.indoorTags[0]); } },
                { scope: 'item', derive: function (g) { return g.cell('B'); } },
                { scope: 'item', derive: function (g) { return g.filter('SIZE'); } },
                { scope: 'item', editable: true, fieldKey: 'allied_ms_location' },
                { scope: 'item', capacityField: 'airflow', derive: function (g) { return g.cell('C'); } },
                { scope: 'item', editable: true, fieldKey: 'allied_ms_oa_cfm' },
                { scope: 'item', derive: function (g) { return g.cell('D'); } },
                { scope: 'item', derive: function () { return '0.5'; } },
                { scope: 'item', derive: function (g) { return div1000(g.cell('I')); } },
                { scope: 'item', derive: function (g) { return div1000(g.cell('J')); } },
                { scope: 'item', derive: function (g) { return g.cell('AB'); } },
                { scope: 'item', derive: function (g) { return isPositiveNum(g.cell('K')) ? div1000(g.cell('K')) : '-'; } },
                { scope: 'item', kwSelect: true, derive: function (g) { return g.cell('L'); } },
                { scope: 'item', derive: function (g) { return voltPh(g.cell('N')); } },
                { scope: 'item', derive: function (g) { return g.cell('O'); } },
                { scope: 'item', derive: function (g) { return g.cell('P'); } },
                { scope: 'item', derive: function (g) { return s(g.item.tag); } },
                { scope: 'item', derive: function (g) { return g.cell('S'); } },
                { scope: 'item', derive: function (g) { return voltPh(g.cell('W')); } },
                { scope: 'item', derive: function (g) { return g.cell('X'); } },
                { scope: 'item', derive: function (g) { return g.cell('Y'); } },
                { scope: 'item', derive: function () { return '1,2,3,4,5,6,7,8'; } }
            ],
            notesTitle: 'NOTE:',
            notes: [
                '1. COOLING CAPACITIES ARE RATED IN ACCORDANCE WITH ARI STANDARD 210/290 AT 95°F AMBIENT OUTDOOR AIR TEMP., 80°F',
                '    DRY BULB, 67°F WET BULB ENTERING AIR TEMP., AND NOMINAL AIR QUANTITY LISTED.',
                '2. REFRIG. R-32 PIPING TO BE SIZED PER TOTAL INSTALL. EQUIV. LENGTH.  LONG-LINE APP. TO BE PROVIDED WHENEVER MFG.',
                "    RECOMM. LENGTHS ARE EXCEEDED, INCL. LIQ. LINE SOLENOID VALVES, ACCUMULATOR, ETC. MAX T.E.L. IS 100'",
                '3. PROVIDE SINGLE POINT ELECTRICAL CONNECTION',
                '4. PROVIDE HONEYWELL "VISION-PRO 8000" THERMOSTAT/HUMIDISTAT',
                '5. PROVIDE NEW FILTERS IN UNIT WHEN BUILDING IS TURNED OVER TO OWNER/TENANT.',
                '6. SES HEAT PUMP DEHUMIDIFICATION CONTROL MODULE HPDM-MP AS WELL AS EQUIPMENT AND CONTROLS AS REQUIRED',
                '    FOR A COMPLETE WORKING SYSTEM',
                '7. HEAT PUMP TO BE INSTALLED LEVEL ON MANUFACTURERS PREFORMED PAD.',
                '8. PROVIDE LOW AMBIENT CONTROLS.',
                'APPROVED EQUALS: TRANE, CARRIER, & LENNOX'
            ],
            manufacturers: null
        };
    }

    T.register('allied', 'Allied', {
        multi_position_splits: alliedMultiSplit
    });
})();
