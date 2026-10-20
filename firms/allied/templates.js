/* ============================================================
   HHpro - Allied schedule templates
   ------------------------------------------------------------
   Served ONLY to users allowed this firm: Cloudflare Access signs
   the user in, then functions/firms/_middleware.js checks their
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

    function alliedGasSplit() {
        return {
            orientation: 'rows',
            title: 'SPLIT SYSTEM GAS FURNACE SCHEDULE',
            header: [
                { r: 0, c: 0, rowspan: 2, label: 'UNIT TAG' },
                { r: 0, c: 1, rowspan: 2, label: 'TEMPMASTER FURNACE MODEL NO.' },
                { r: 0, c: 2, rowspan: 2, label: 'TEMPMASTER COOLING COIL MODEL NO.' },
                { r: 0, c: 3, rowspan: 2, label: 'TONNAGE' },
                { r: 0, c: 4, rowspan: 2, label: 'TOTAL CFM' },
                { r: 0, c: 5, rowspan: 2, label: 'TOTAL OA' },
                { r: 0, c: 6, rowspan: 2, label: 'SERVING' },
                { r: 0, c: 7, rowspan: 2, label: 'MAX FAN HP' },
                { r: 0, c: 8, rowspan: 2, label: 'ESP' },
                { r: 0, c: 9, rowspan: 2, label: 'MBH TOT. COOL' },
                { r: 0, c: 10, rowspan: 2, label: 'MBH INPUT' },
                { r: 0, c: 11, rowspan: 2, label: 'MBH OUTPUT' },
                { r: 0, c: 12, colspan: 3, label: 'ELECTRICAL DATA' },
                { r: 1, c: 12, label: 'VOLTS' },
                { r: 1, c: 13, label: 'MCA' },
                { r: 1, c: 14, label: 'MOCP' },
                { r: 0, c: 15, rowspan: 2, label: 'WEIGHT' },
                { r: 0, c: 16, rowspan: 2, label: 'UNIT TAG' },
                { r: 0, c: 17, rowspan: 2, label: 'TEMPMASTER COND UNIT MODEL NO. (CU)' },
                { r: 0, c: 18, rowspan: 2, label: 'TONNAGE' },
                { r: 0, c: 19, rowspan: 2, label: 'EFFICIENCY (SEER2 / EER2)' },
                { r: 0, c: 20, colspan: 3, label: 'ELECTRICAL DATA' },
                { r: 1, c: 20, label: 'VOLTS' },
                { r: 1, c: 21, label: 'MCA' },
                { r: 1, c: 22, label: 'MOCP' },
                { r: 0, c: 23, rowspan: 2, label: 'WEIGHT' },
                { r: 0, c: 24, rowspan: 2, label: 'ACCESSORIES' }
            ],
            columns: [
                { scope: 'item', derive: function (g) { return s(g.item.indoorTags && g.item.indoorTags[0]); } },
                { scope: 'item', derive: function (g) { return modelPart(g.cell('B'), 1); } },
                { scope: 'item', derive: function (g) { return modelPart(g.cell('B'), 0); } },
                { scope: 'item', derive: function (g) { return g.filter('SIZE'); } },
                { scope: 'item', derive: function (g) { return g.cell('C'); } },
                { scope: 'item', editable: true, fieldKey: 'allied_gs_oa_cfm' },
                { scope: 'item', derive: function (g) { return s(g.item.serves) || '-'; } },
                { scope: 'item', derive: function (g) { return g.cell('D'); } },
                { scope: 'item', derive: function () { return '0.5'; } },
                { scope: 'item', derive: function (g) { return div1000(g.cell('H')); } },
                { scope: 'item', derive: function (g) { return div1000(g.cell('I')); } },
                { scope: 'item', derive: function (g) { return div1000(g.cell('J')); } },
                { scope: 'item', derive: function (g) { return voltPh(g.cell('M')); } },
                { scope: 'item', derive: function (g) { return g.cell('N'); } },
                { scope: 'item', derive: function (g) { return g.cell('O'); } },
                { scope: 'item', derive: function (g) { return g.cell('P'); } },
                { scope: 'item', derive: function (g) { return s(g.item.tag); } },
                { scope: 'item', derive: function (g) { return g.cell('R'); } },
                { scope: 'item', derive: function (g) { return g.filter('SIZE'); } },
                { scope: 'item', derive: function (g) { return g.cell('X'); } },
                { scope: 'item', derive: function (g) { return voltPh(g.cell('S')); } },
                { scope: 'item', derive: function (g) { return g.cell('T'); } },
                { scope: 'item', derive: function (g) { return g.cell('U'); } },
                { scope: 'item', derive: function (g) { return g.cell('Y'); } },
                { scope: 'item', derive: function () { return '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18'; } }
            ],
            notesTitle: 'NOTES & ACCESSORIES:',
            notes: [
                '1. COOLING CAPACITIES ARE RATED IN ACCORDANCE WITH ARI STANDARD 210/290 AT 95°F AMBIENT OUTDOOR AIR TEMP., 80°F DRY BULB, 67°F WET BULB ENTERING AIR TEMP., AND NOMINAL AIR QUANTITY LISTED.',
                '2. AGA CERTIFIED UL LISTED AND LABELED.',
                '3. PROVIDE WITH LOW AMBIENT KIT.',
                '4. REFRIG. PIPING TO BE R-32, SIZED PER TOTAL INSTALLED EQUIVALENT LENGTH. LONG-LINE APPLICATION TO BE PROVIDED WHENEVER MFG. RECOMM. LENGTHS ARE EXCEEDED, INCL. LIQUID LINE SOLENOID VALVES, ACCUMULATOR, AND OTHER SPECIAL PRECAUTIONS PER MANUFACTURERS',
                "    RECOMMENDATIONS. MAX T.E.L. IS 100'",
                '5. PROVIDE SINGLE POINT ELECTRICAL CONNECTION WITH FACTORY DISCONNECT KIT FOR BOTH INDOOR AND OUTDOOR UNIT.',
                '6. PROVIDE MANUFACTURERS 7-DAY PROGRAMMABLE TOUCHSCREEN THERMOSTAT WITH AUTO-CHANGEOVER, CONTROL WIRING AND ASSOCIATED ACCESSORIES REQUIRED TO MEET SEQUENCE OF OPERATION. PROVIDE THERMOSTAT CLEAR LOCKING COVER.',
                '7. PROVIDE NEW FILTERS IN UNIT WHEN BUILDING IS TURNED OVER TO OWNER/TENANT.',
                '8. CONDENSING UNIT TO BE INSTALLED LEVEL ON EQUIPMENT ROOF RAILS WITH VIBRATION ISOLATION.',
                '9. CONDENSING UNIT TO BE INSTALLED LEVEL ON 4" UTILITY PAD',
                '10. PROVIDE CONDENSATE OVERFLOW SENSOR IN DRAIN PAN TO DE-ENERGIZE UNIT SHOULD A CLOGGED CONDENSATE DRAIN CONDITION OCCUR.',
                '11. PROVIDE A CONDENSATE OVERFLOW SENSOR IN DRAIN PAN. CONDENSATE PUMP SHALL BE WIRED TO DE-ENERGIZE UNIT SHOULD A CLOGGED CONDENSATE DRAIN CONDITION OCCUR.',
                '12. PROVIDE TRANSFORMER AS REQUIRED FOR SUPPLY FAN.',
                '13. PROVIDE DUCT SMOKE DETECTOR IN RETURN AIR DUCT.',
                '14. PROVIDE HIGH-STATIC DRIVE AND ALTERNATE MOTOR.',
                '15. PROVIDE VARIABLE SPEED SUPPLY FAN CONTROL FOR ENHANCED DEHUMIDIFICATION CAPABILITY',
                '16. PROVIDE FACTORY INSTALLED NON-BLEED TXV, EVAPORATOR DEFROST CONTROLS AND AIR TIGHT CABINET CONSTRUCTION FOR INDOOR UNIT.',
                '17. INDOOR UNIT SHALL BE PROVIDED WITH VIBRATION ISOLATION.',
                '18. WARRANTY - 10 YR HEAT EXCHANGER / 5 YR COMPRESSOR / 3 YR CONTROLLER.',
                '19. PROVIDE MIXING BOX.',
                '20. PROVIDE HAIL GUARDS - FACTORY SUPPLIED, FIELD INSTALLED FOR OUTDOOR UNIT.',
                '21. PROVIDE CORROSION PROTECTION.',
                '22. VARIABLE SPEED SCROLL COMPRESSOR.',
                '23. 2 STAGE SCROLL COMPRESSOR',
                'APPROVED EQUALS: TRANE, CARRIER, & LENNOX'
            ],
            manufacturers: null
        };
    }

    T.register('allied', 'Allied', {
        multi_position_splits: alliedMultiSplit,
        gas_splits: alliedGasSplit
    });
})();
