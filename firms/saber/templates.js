/* ============================================================
   HHpro - Saber schedule templates
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
    var s = h.s, combine2 = h.combine2, voltPh = h.voltPh, isPositiveNum = h.isPositiveNum, div1000 = h.div1000;

    // =================================================================
    // Saber templates
    // Mapped from DATA/ENGINEER SCHEDULES/SABER.xlsx, using the user's
    // matching Hoffman Cart exports as a value-by-value Rosetta Stone.
    // Products: multi_position_splits, mini_splits, gas_packs (all
    // orientation 'rows'). Note refs are the firm's own plain comma lists
    // ("1, 2, 3 ..."), not circled digits, so there are no DXF/PDF
    // transliteration concerns. Fields with no native data source (ESP,
    // OUTSIDE AIR, FAN RPM, ...) are inline-editable; AREA SERVED + UNIT TAG
    // pre-fill from the item but are editable.
    //
    // Mini splits + multi position splits use ONE identical layout (title
    // "SPLIT SYSTEM HEAT PUMP UNIT SCHEDULE"). saberSplitHeader() and
    // saberSplitNotes() are shared by both product templates so they stay
    // byte-identical - and so the combined "Split Systems" view (built in
    // export.js by merging both products' rows under this header) lines up.
    // Only the per-product column derives differ, because the two products'
    // scheduleData layouts differ (mini-split values live in different
    // letters; mini-split indoor is powered from the outdoor single-point
    // feed, so its MCA/MOCP read "NA").
    // =================================================================

    // Shared header for the Saber split-system layout (23 leaf columns,
    // 0-22). Labels carry the SABER.xlsx line breaks ("\n").
    function saberSplitHeader() {
        return [
            // Tier A - super groups over the two unit halves
            { r: 0, c: 0, colspan: 14, label: 'AIR HANDLING UNIT DATA' },
            { r: 0, c: 14, colspan: 7, label: 'CONDENSING UNIT' },
            { r: 0, c: 21, rowspan: 3, label: 'WEIGHT (LBS)\nAH/HP' },
            { r: 0, c: 22, rowspan: 3, label: 'NOTES' },
            // Tier B - sub groups
            { r: 1, c: 0, rowspan: 2, label: 'UNIT\nTAG' },
            { r: 1, c: 1, rowspan: 2, label: 'AREA\nSERVED' },
            { r: 1, c: 2, rowspan: 2, label: 'MANUF.\nMODEL' },
            { r: 1, c: 3, colspan: 4, label: 'FAN DATA' },
            { r: 1, c: 7, colspan: 2, label: 'COOLING' },
            { r: 1, c: 9, label: 'HEAT' },
            { r: 1, c: 10, label: 'AUX.' },
            { r: 1, c: 11, colspan: 3, label: 'ELECTRICAL DATA' },
            { r: 1, c: 14, colspan: 4, label: 'GENERAL DATA' },
            { r: 1, c: 18, colspan: 3, label: 'ELECTRICAL DATA' },
            // Tier C - leaf labels
            { r: 2, c: 3, label: 'FAN\nCFM' },
            { r: 2, c: 4, label: 'ESP\n(WG)' },
            { r: 2, c: 5, label: 'MOTOR\nHP' },
            { r: 2, c: 6, label: 'OA\n(CFM)' },
            { r: 2, c: 7, label: 'TOTAL\n(MBH)' },
            { r: 2, c: 8, label: 'SENS.\n(MBH)' },
            { r: 2, c: 9, label: 'TOTAL\n(MBH)' },
            { r: 2, c: 10, label: 'HEAT\n(KW)' },
            { r: 2, c: 11, label: 'VOLTAGE\n(V/PH)' },
            { r: 2, c: 12, label: 'MCA\n(A)' },
            { r: 2, c: 13, label: 'MOCP\n(A)' },
            { r: 2, c: 14, label: 'UNIT\nTAG' },
            { r: 2, c: 15, label: 'MANUF.\nMODEL' },
            { r: 2, c: 16, label: 'TONNAGE' },
            { r: 2, c: 17, label: 'EFFICIENCY' },
            { r: 2, c: 18, label: 'VOLTAGE\n(V/PH)' },
            { r: 2, c: 19, label: 'MCA\n(A)' },
            { r: 2, c: 20, label: 'MOCP\n(A)' }
        ];
    }

    // Shared notes for the Saber split-system layout. One row per note;
    // note 14 is the only one the Excel splits across two rows (2 entries).
    function saberSplitNotes() {
        return [
            '1. COOLING CAPACITIES ARE RATED IN ACCORDANCE WITH ARI STANDARD 210/290 AT 95 DEGREE FARENHEIT AMBIENT OUTDOOR AIR TEMPERATURE, 80 DEGREE FARENHEIT DRY BULB, AND 67 DEGREE FAHRENHEIT WET BULB ENTERING AIR TEMPERATURE, AND NORMAL AIR QUANTITY LISTED.',
            "2. REFRIGERANT PIPING TO BE SIZED PER TOTAL INSTALLATION EQUIVALENT LENGTH. LONG-LINE APPLICATION TO BE PROVIDED WHENEVER MANUFACTURER RECOMMENDED LENGTHS ARE EXCEEDED, INCLUDING LIQUID LINE SOLENOID VALVES, ACCUMULATOR, ETC. MAXIMUM T.E.L. IS 100'",
            '3. PROVIDE SINGLE POINT ELECTRICAL CONNECTION FOR AIR HANDLING UNIT.',
            '4. PROVIDE NEW FILTER IN EACH UNIT AT TURNOVER TO OWNER.',
            '5. OUTDOOR UNITS SHALL HAVE MINIMUM 14.0 SEER2 RATING',
            '6. PROVIDE ON/AUTO FAN SWITCH AND HEAT-OF-COOL THERMOSTAT WITH SUBBASE FOR EACH UNIT. PROVIDE WITH OUTSIDE AIR TEMPERATURE SENSOR TO LOCKOUT ELECTRIC HEAT WHEN OUTSIDE AIR TEMPERATURE IS ABOVE 40 DEGREES.',
            '7. PROVIDE HEAT PUMP KIT WITH AIR HANDLER (IF REQUIRED).',
            '8. PROVIDE A 24V MOTORIZED DAMPER ON FRESH AIR RUN-OUT TO UNIT. DAMPER IS TO OPEN WHEN FAN IS ENERGIZED.',
            '9. ALL ACCESSORIES AND OPTIONS ARE TO BE FACTORY INSTALLED.',
            '10. SUPPORT AHU ON REINFORCED SHEET METAL R.A. PLENUM.',
            '11. AHU TO USE UPFLOW APPLICATION.',
            '12. AHU TO USE HORIZONTAL APPLICATION.',
            '13. DRAIN CONDENSATE TO HUB DRAIN.',
            '14. CATALOG NUMBERS AND MANUFACTURERS ARE TO INDICATE TYPE AND QUALITY OF UNIT DESIRED. SUBMIT CUTSHEETS OF THESE AND ALTERNATE MANUFACTURERS FOR ARCHITECT AND OWNER APPROVAL PRIOR TO PURCHASE OF ANY UNITS. INFORMATION ON ALTERNATE UNITS PROPOSED BY THE',
            'CONTRACTOR SHALL INCLUDE THE ADD/DEDUCT ASSOCIATED WITH ACCEPTANCE OF THAT UNIT (OR THE ALTERNATE PACKAGE AS A WHOLE).'
        ];
    }

    function saberMultiSplit() {
        return {
            orientation: 'rows',
            title: 'SPLIT SYSTEM HEAT PUMP UNIT SCHEDULE',
            // The mini-split + MPS templates share ONE identical layout, so
            // the combined "Split Systems" view may merge their rows under a
            // single header. Only set this on templates built around a shared
            // header (see showSplitSystemsTab / buildCombinedSplitSystemsGrid).
            combinedSplitSystems: true,
            // Keep each note on a single line (the firm's sheets are wide):
            // widen the columns so the full-width notes box never word-wraps.
            notesSingleLine: true,
            header: saberSplitHeader(),
            columns: [
                // --- Air handling unit --- (UNIT TAG + AREA SERVED render as
                // editable text boxes; they pre-fill from the item's tag /
                // serves but the engineer can type over them per their plans.)
                { scope: 'item', editable: true, fieldKey: 'saber_ms_ahu_tag', derive: function (g) { return s(g.item.indoorTags && g.item.indoorTags[0]); } },
                { scope: 'item', editable: true, fieldKey: 'saber_ms_area', derive: function (g) { return s(g.item.serves); } },
                { scope: 'item', derive: function (g) { return combine2(g.cell('A'), g.cell('B')); } },
                { scope: 'item', capacityField: 'airflow', derive: function (g) { return g.cell('C'); } },
                { scope: 'item', editable: true, fieldKey: 'saber_ms_esp' },
                { scope: 'item', derive: function (g) { return g.cell('D'); } },
                { scope: 'item', editable: true, fieldKey: 'saber_ms_oa_cfm' },
                { scope: 'item', derive: function (g) { return div1000(g.cell('I')); } },
                { scope: 'item', derive: function (g) { return div1000(g.cell('J')); } },
                { scope: 'item', derive: function (g) { return isPositiveNum(g.cell('K')) ? div1000(g.cell('K')) : '-'; } },
                { scope: 'item', kwSelect: true, derive: function (g) { return g.cell('L'); } },
                { scope: 'item', derive: function (g) { return voltPh(g.cell('N')); } },
                { scope: 'item', derive: function (g) { return g.cell('O'); } },
                { scope: 'item', derive: function (g) { return g.cell('P'); } },
                // --- Condensing unit ---
                { scope: 'item', editable: true, fieldKey: 'saber_ms_cu_tag', derive: function (g) { return s(g.item.tag); } },
                { scope: 'item', derive: function (g) { return combine2(g.cell('R'), g.cell('S')); } },
                { scope: 'item', derive: function (g) { return g.filter('SIZE'); } },
                { scope: 'item', derive: function (g) { return g.cell('AB'); } },
                { scope: 'item', derive: function (g) { return voltPh(g.cell('W')); } },
                { scope: 'item', derive: function (g) { return g.cell('X'); } },
                { scope: 'item', derive: function (g) { return g.cell('Y'); } },
                // --- Weight (AH/HP) + notes ---
                { scope: 'item', derive: function (g) { return s(g.cell('Q')) + '/' + s(g.cell('AC')); } },
                { scope: 'item', derive: function () { return '1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14'; } }
            ],
            notesTitle: 'NOTES:',
            notes: saberSplitNotes(),
            manufacturers: null
        };
    }

    // Mini splits - SAME layout as the multi position split (saberSplitHeader
    // / saberSplitNotes), but mapped to the mini_splits scheduleData. Indoor
    // fields are per-row (scope 'row') so a multi-zone system lists each head
    // on its own row with the outdoor data row-spanned; the outdoor fields are
    // scope 'item'. Mini-split indoor units are powered from the outdoor
    // single-point feed, so indoor MCA/MOCP read "NA" and indoor VOLTAGE shows
    // the outdoor feed voltage. EFFICIENCY appends "(SEER2/EER2/HSPF2)" on a
    // 2nd line because the mini value (col R) carries no inline label (unlike
    // the MPS "15.2/12.5 (SEER2/EER2)"). TONNAGE = the "SIZE (OUTDOOR UNIT)"
    // filter. Mini splits have no motor HP / aux electric heat, so those are
    // editable "-" placeholders.
    function saberMiniSplit() {
        return {
            orientation: 'rows',
            title: 'SPLIT SYSTEM HEAT PUMP UNIT SCHEDULE',
            combinedSplitSystems: true,
            notesSingleLine: true,
            header: saberSplitHeader(),
            columns: [
                // --- Indoor (air handling) unit: per indoor sub-row ---
                { scope: 'row', editable: true, fieldKey: 'saber_min_idu_tag', derive: function (g) { return s(g.item.indoorTags && g.item.indoorTags[g.rowIndex]); } },
                { scope: 'row', editable: true, fieldKey: 'saber_min_area', derive: function (g) { return s(g.item.serves); } },
                { scope: 'row', derive: function (g) { return combine2(g.cell('M'), g.cell('N')); } },
                { scope: 'row', derive: function (g) { return g.cell('A'); } },
                { scope: 'row', editable: true, fieldKey: 'saber_min_esp' },
                { scope: 'row', editable: true, fieldKey: 'saber_min_motor_hp' },
                { scope: 'row', editable: true, fieldKey: 'saber_min_oa_cfm' },
                { scope: 'row', derive: function (g) { return div1000(g.cell('D')); } },
                { scope: 'row', derive: function (g) { return div1000(g.cell('E')); } },
                { scope: 'row', derive: function (g) { return div1000(g.cell('G')); } },
                { scope: 'row', editable: true, fieldKey: 'saber_min_aux_kw' },
                { scope: 'row', derive: function (g) { return voltPh(g.cell('S')); } },
                { scope: 'row', derive: function () { return 'NA'; } },
                { scope: 'row', derive: function () { return 'NA'; } },
                // --- Condensing unit: shared across the indoor rows ---
                { scope: 'item', editable: true, fieldKey: 'saber_min_odu_tag', derive: function (g) { return s(g.item.tag); } },
                { scope: 'item', derive: function (g) { return combine2(g.cell('V'), g.cell('W')); } },
                { scope: 'item', derive: function (g) { return g.filter('SIZE (OUTDOOR UNIT)'); } },
                { scope: 'item', derive: function (g) { var r = g.cell('R'); return r ? r + '\n(SEER2/EER2/HSPF2)' : r; } },
                { scope: 'item', derive: function (g) { return voltPh(g.cell('S')); } },
                { scope: 'item', derive: function (g) { return g.cell('T'); } },
                { scope: 'item', derive: function (g) { return g.cell('U'); } },
                // --- Weight (indoor / outdoor, per row) + notes ---
                { scope: 'row', derive: function (g) { return s(g.cell('H')) + '/' + s(g.cellAt('Q', 0)); } },
                { scope: 'item', derive: function () { return '1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14'; } }
            ],
            notesTitle: 'NOTES:',
            notes: saberSplitNotes(),
            manufacturers: null
        };
    }

    function saberRtu() {
        return {
            orientation: 'rows',
            title: 'PACKAGED DX COOLING/GAS HEATING ROOF TOP UNIT SCHEDULE',
            // Keep each note on a single line (the firm's sheets are wide):
            // widen the columns so the full-width notes box never word-wraps.
            notesSingleLine: true,
            // Header labels carry the SABER.xlsx's exact line breaks ("\n").
            header: [
                { r: 0, c: 0, rowspan: 2, label: 'UNIT\nTAG' },
                { r: 0, c: 1, rowspan: 2, label: 'AREA\nSERVED' },
                { r: 0, c: 2, colspan: 5, label: 'SUPPLY - FAN DATA' },
                { r: 0, c: 7, colspan: 2, label: 'COOLING CAPACITY' },
                { r: 0, c: 9, colspan: 2, label: 'HEATING CAPACITY' },
                { r: 0, c: 11, colspan: 3, label: 'ELECTRICAL DATA' },
                { r: 0, c: 14, rowspan: 2, label: 'MANUF.\nMODEL' },
                { r: 0, c: 15, rowspan: 2, label: 'TONNAGE' },
                { r: 0, c: 16, rowspan: 2, label: 'EFFICIENCY' },
                { r: 0, c: 17, rowspan: 2, label: 'UNIT\nWEIGHT\n(LBS)' },
                { r: 0, c: 18, rowspan: 2, label: 'NOTES' },
                { r: 1, c: 2, label: 'TOTAL\nCFM' },
                { r: 1, c: 3, label: 'OA\n(CFM)' },
                { r: 1, c: 4, label: 'MIN. EXT.\nS.P. (IN. WG)' },
                { r: 1, c: 5, label: 'MOTOR\nHP' },
                { r: 1, c: 6, label: 'FAN\nRPM' },
                { r: 1, c: 7, label: 'TOTAL\n(MBH)' },
                { r: 1, c: 8, label: 'SENS.\n(MBH)' },
                { r: 1, c: 9, label: 'INPUT\n(MBH)' },
                { r: 1, c: 10, label: 'OUTPUT\n(MBH)' },
                { r: 1, c: 11, label: 'VOLTAGE/PH' },
                { r: 1, c: 12, label: 'MCA\n(A)' },
                { r: 1, c: 13, label: 'MOCP\n(A)' }
            ],
            columns: [
                // UNIT TAG + AREA SERVED render as editable text boxes,
                // pre-filled from the item's tag / serves but overridable.
                { scope: 'item', editable: true, fieldKey: 'saber_rtu_tag', derive: function (g) { return s(g.item.tag); } },
                { scope: 'item', editable: true, fieldKey: 'saber_rtu_area', derive: function (g) { return s(g.item.serves); } },
                { scope: 'item', derive: function (g) { return g.cell('D'); } },
                { scope: 'item', editable: true, fieldKey: 'saber_rtu_oa_cfm' },
                { scope: 'item', derive: function (g) { return g.cell('E'); } },
                { scope: 'item', derive: function (g) { return g.cell('V'); } },
                { scope: 'item', editable: true, fieldKey: 'saber_rtu_fan_rpm' },
                { scope: 'item', derive: function (g) { return div1000(g.cell('G')); } },
                { scope: 'item', derive: function (g) { return div1000(g.cell('H')); } },
                { scope: 'item', derive: function (g) { return g.cell('N'); } },
                { scope: 'item', derive: function (g) { return g.cell('O'); } },
                { scope: 'item', derive: function (g) { return g.cell('U'); } },
                { scope: 'item', derive: function (g) { return g.cell('W'); } },
                { scope: 'item', derive: function (g) { return g.cell('X'); } },
                { scope: 'item', derive: function (g) { return combine2(g.cell('A'), g.cell('B')); } },
                { scope: 'item', derive: function (g) { return g.cell('C'); } },
                { scope: 'item', derive: function (g) { return g.cell('I'); } },
                { scope: 'item', derive: function (g) { return g.cell('Y'); } },
                { scope: 'item', derive: function () { return '1, 2, 3, 4, 5, 6, 7, 8'; } }
            ],
            notesTitle: 'NOTES:',
            // One row per note (renderers word-wrap within the row). Note 8 is
            // the only one the Excel splits across two rows -> two entries.
            notes: [
                '1. COOLING CAPACITIES ARE RATED IN ACCORDANCE WITH ARI STANDARD 210/290 AT 95 DEGREE FARENHEIT AMBIENT OUTDOOR AIR TEMPERATURE, 80 DEGREE FARENHEIT DRY BULB, AND 67 DEGREE FAHRENHEIT WET BULB ENTERING AIR TEMPERATURE, AND NORMAL AIR QUANTITY LISTED.',
                '2. PROVIDE NEW FILTER IN EACH UNIT AT TURNOVER TO OWNER.',
                '3. PROVIDE MANUFACTURER\'S 7-DAY PROGRAMMABLE AUTOMATIC CHANGEOVER HEAT/COOL THERMOSTAT. PROGRAM FAN SETTING TO BE IN "ON" POSITION DURING PERIODS OF OCCUPATION.',
                '4. PROVIDE FACTORY ROOF CURB AND AIR SIDE ECONOMIZER SECTION WITH BAROMETRIC RELIEF DAMPER FOR EACH UNIT.',
                '5. ALL ACCESSORIES AND OPTIONS ARE TO BE FACTORY INSTALLED.',
                '6. PROVIDE SINGLE POINT ELECTRICAL CONNECTION.',
                '7. DUCT SMOKE DETECTOR TO BE PROVIDED BY E.C. AND INSTALLED BY M.C.',
                '8. UNLESS NOTED OTHERWISE, PRODUCTS SPECIFIED ON THESE PLANS ARE "BASIS OF DESIGN". SPECIFIC MANUFACTURER\'S PRODUCT IS NAMED, INCLUDING MAKE OR MODEL NUMBER OR OTHER DESIGNATION, IS TO ESTABLISH THE SIGNIFICANT QUALITIES RELATED TO TYPE, FUNCTION,',
                'DIMENSION, IN-SERVICE PERFORMANCE, PHYSICAL PROPERTIES, APPEARANCE, AND OTHER CHARACTERISTICS FOR PURPOSES OF EVALUATING COMPARABLE PRODUCTS OF OTHER MANUFACTURERS.'
            ],
            manufacturers: null
        };
    }

    T.register('saber', 'Saber', {
        multi_position_splits: saberMultiSplit,
        mini_splits: saberMiniSplit,
        gas_packs: saberRtu
    });
})();
