/* ============================================================
   HHpro - MSWG schedule templates
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
    var s = h.s, slash = h.slash, firstNumber = h.firstNumber, voltOnly = h.voltOnly, phaseOnly = h.phaseOnly, effNum = h.effNum, tagPair = h.tagPair, isPositiveNum = h.isPositiveNum, div1000 = h.div1000;

    // =================================================================
    // MSWG templates
    // Mapped from DATA/ENGINEER SCHEDULES/MSWG.xlsx, using the user's
    // matching Hoffman Cart exports as a value-by-value Rosetta Stone.
    // Products: mini_splits, multi_position_splits, gas_packs (all
    // orientation 'rows'). Fields the firm schedules but HHpro has no
    // data source for yet (highlighted yellow in MSWG.xlsx: fan-motor
    // FLA, heating COP, outdoor-fan/compressor electrical breakdowns,
    // AFUE, hot-gas-reheat temps, refrigerant charge, temp rise) render
    // as "-" constants until the Hoffman data grows those columns.
    // Volts and Phase are separate columns here, split out of the native
    // "V/Hz/Ph" values via voltOnly()/phaseOnly().
    // =================================================================

    function mswgMiniSplit() {
        return {
            orientation: 'rows',
            title: 'MINI-SPLIT SCHEDULE',
            header: [
                // Tier A
                { r: 0, c: 0, rowspan: 3, label: 'Unit Tag' },
                { r: 0, c: 1, rowspan: 3, label: 'Area Served' },
                { r: 0, c: 2, rowspan: 3, label: 'CFM' },
                { r: 0, c: 3, colspan: 3, label: 'Fan Motor' },
                { r: 0, c: 6, colspan: 4, label: 'Cooling Performance' },
                { r: 0, c: 10, colspan: 3, label: 'Heating Performance' },
                { r: 0, c: 13, colspan: 8, label: 'Outdoor Unit' },
                { r: 0, c: 21, rowspan: 3, label: 'Indoor\nUnit' },
                { r: 0, c: 22, rowspan: 3, label: 'Outdoor\nUnit' },
                { r: 0, c: 23, rowspan: 3, label: 'Remarks' },
                // Tier B
                { r: 1, c: 3, rowspan: 2, label: 'FLA' },
                { r: 1, c: 4, rowspan: 2, label: 'Volts' },
                { r: 1, c: 5, rowspan: 2, label: 'Phase' },
                { r: 1, c: 6, rowspan: 2, label: 'EAT' },
                { r: 1, c: 7, rowspan: 2, label: 'BTU\nTotal' },
                { r: 1, c: 8, rowspan: 2, label: 'BTU\nSensible' },
                { r: 1, c: 9, rowspan: 2, label: 'Efficiency\nSEER' },
                { r: 1, c: 10, rowspan: 2, label: 'EAT' },
                { r: 1, c: 11, rowspan: 2, label: 'BTU\nTotal' },
                { r: 1, c: 12, rowspan: 2, label: 'Efficiency\nCOP' },
                { r: 1, c: 13, rowspan: 2, label: 'Unit Tag' },
                { r: 1, c: 14, rowspan: 2, label: 'Weight' },
                { r: 1, c: 15, colspan: 2, label: 'Fan' },
                { r: 1, c: 17, rowspan: 2, label: 'MCA' },
                { r: 1, c: 18, rowspan: 2, label: 'Fuse\nSize' },
                { r: 1, c: 19, rowspan: 2, label: 'Volts' },
                { r: 1, c: 20, rowspan: 2, label: 'Phase' },
                // Tier C
                { r: 2, c: 15, label: 'No.' },
                { r: 2, c: 16, label: 'FLA(ea)' }
            ],
            columns: [
                // --- Indoor unit: one row per indoor head. UNIT TAG + AREA
                // SERVED pre-fill from the item but stay editable text boxes.
                { scope: 'row', editable: true, fieldKey: 'mswg_min_idu_tag', derive: function (g) { return s(g.item.indoorTags && g.item.indoorTags[g.rowIndex]); } },
                { scope: 'row', editable: true, fieldKey: 'mswg_min_area', derive: function (g) { return s(g.item.serves); } },
                { scope: 'row', derive: function (g) { return g.cell('A'); } },
                // Fan-motor FLA: no data source yet
                { scope: 'row', derive: function () { return '-'; } },
                // Indoor units are powered from the outdoor single-point
                // feed, so fan-motor volts/phase mirror the outdoor service
                // (which multi-zone selections only store on sub-row 0).
                { scope: 'row', derive: function (g) { return voltOnly(g.cellAt('R', 0)); } },
                { scope: 'row', derive: function (g) { return phaseOnly(g.cellAt('R', 0)); } },
                { scope: 'row', derive: function (g) { return slash(g.cell('B'), g.cell('C')); } },
                { scope: 'row', derive: function (g) { return g.cell('D'); } },
                { scope: 'row', derive: function (g) { return '-'; } },
                { scope: 'item', derive: function (g) { return firstNumber(g.cell('Q')); } },
                { scope: 'row', derive: function (g) { return g.cell('E'); } },
                { scope: 'row', derive: function (g) { return g.cell('F'); } },
                // Heating COP: no data source yet
                { scope: 'item', derive: function () { return '-'; } },
                // --- Outdoor unit ---
                { scope: 'item', editable: true, fieldKey: 'mswg_min_odu_tag', derive: function (g) { return s(g.item.tag); } },
                { scope: 'item', derive: function (g) { return g.cell('P'); } },
                // Outdoor fan No. / FLA(ea): no data source yet
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function (g) { return g.cell('S'); } },
                { scope: 'item', derive: function (g) { return g.cell('T'); } },
                { scope: 'item', derive: function (g) { return voltOnly(g.cell('R')); } },
                { scope: 'item', derive: function (g) { return phaseOnly(g.cell('R')); } },
                // --- Model columns + remarks ---
                { scope: 'row', derive: function (g) { return g.cell('M'); } },
                { scope: 'item', derive: function (g) { return g.cell('V'); } },
                { scope: 'item', derive: function () { return '1-9'; } }
            ],
            notesTitle: '',
            notes: [
                '1.  REFER TO APPROVED MANUFACTURER LIST FOR ACCEPTABLE EQUAL MANUFACTURERS.  COORDINATE POWER REQUIREMENTS FOR ALL SUBSTITUTIONS.',
                "2.  MECHANICAL CONTRACTOR IS RESPONSIBLE FOR INSTALLING IN ACCORDANCE WITH MANUFACTURER'S INSTALLATION INSTRUCTIONS AND LOCAL CODES.",
                '3.  WIRED REMOTE CONTROLLER AND BAS INTERFACE ADAPTOR.',
                '4.  REFRIGERANT LINES AND ACCESSORIES PER SPECS AND AS RECOMMENDED BY UNIT MFG.',
                '5.  PROVIDE FACTORY CONDENSATE PUMP POWERED FROM AIR HANDLER.  ROUTE 3/4" PUMPED CONDENSATE TO DRAIN WITH MINIMUM 1" AIR GAP.',
                '6.  VARIABLE SPEED, INVERTER DRIVEN.',
                '7.  INDOOR UNIT IS POWERED BY OUTDOOR UNIT.  COORDINATE SUBSTITUTE  MANUFACTURER ELECTRICAL REQUIREMENTS WITH ELECTRICAL CONTRACTOR AT NO ADDITIONAL COST TO OWNER.',
                '8.  PROVIDE ACCESSORIES AS REQUIRED TO ALLOW FOR LOW AMBIENT COOLING DOWN TO 18°F.',
                "9.  PROVIDE WITH MANUFACTURER'S 5-YEAR WARRANTY."
            ],
            manufacturers: null
        };
    }

    function mswgMultiSplit() {
        return {
            orientation: 'rows',
            title: 'SPLIT SYSTEM SCHEDULE',
            header: [
                // Tier A
                { r: 0, c: 0, rowspan: 3, label: 'Unit Tag' },
                { r: 0, c: 1, rowspan: 3, label: 'SEER\n(EER/IEER)' },
                { r: 0, c: 2, rowspan: 3, label: 'COP\n@47\nDEG. F' },
                { r: 0, c: 3, rowspan: 3, label: 'CFM' },
                { r: 0, c: 4, rowspan: 3, label: 'OA' },
                { r: 0, c: 5, rowspan: 3, label: 'ESP' },
                { r: 0, c: 6, colspan: 12, label: 'Air Handling Unit' },
                { r: 0, c: 18, colspan: 3, label: 'DX Coil Performance' },
                { r: 0, c: 21, colspan: 3, label: 'Heating Performance' },
                { r: 0, c: 24, colspan: 10, label: 'Electrical Data (Outdoor Unit)' },
                { r: 0, c: 34, rowspan: 3, label: 'Remarks' },
                // Tier B
                { r: 1, c: 6, colspan: 3, label: 'Fan Motor' },
                { r: 1, c: 9, colspan: 6, label: 'Electric Heating Coil' },
                { r: 1, c: 15, rowspan: 2, label: 'MCA' },
                { r: 1, c: 16, rowspan: 2, label: 'MOCP' },
                { r: 1, c: 17, rowspan: 2, label: 'TempMaster\nModel' },
                { r: 1, c: 18, rowspan: 2, label: 'EAT' },
                { r: 1, c: 19, rowspan: 2, label: 'MBH\nTotal' },
                { r: 1, c: 20, rowspan: 2, label: 'MBH\nSens.' },
                { r: 1, c: 21, rowspan: 2, label: 'EAT' },
                { r: 1, c: 22, rowspan: 2, label: 'LAT' },
                { r: 1, c: 23, rowspan: 2, label: 'Capacity\nMBH@47 F' },
                { r: 1, c: 24, colspan: 2, label: 'Fan' },
                { r: 1, c: 26, colspan: 3, label: 'Compressor' },
                { r: 1, c: 29, rowspan: 2, label: 'Volts' },
                { r: 1, c: 30, rowspan: 2, label: 'Phase' },
                { r: 1, c: 31, rowspan: 2, label: 'MCA' },
                { r: 1, c: 32, rowspan: 2, label: 'MOCP' },
                { r: 1, c: 33, rowspan: 2, label: 'TempMaster\nModel' },
                // Tier C
                { r: 2, c: 6, label: 'HP' },
                { r: 2, c: 7, label: 'Volts' },
                { r: 2, c: 8, label: 'Phase' },
                { r: 2, c: 9, label: 'kW' },
                { r: 2, c: 10, label: 'Steps' },
                { r: 2, c: 11, label: 'Volts' },
                { r: 2, c: 12, label: 'Phase' },
                { r: 2, c: 13, label: 'EAT' },
                { r: 2, c: 14, label: 'LAT' },
                { r: 2, c: 24, label: 'No.' },
                { r: 2, c: 25, label: 'FLA' },
                { r: 2, c: 26, label: 'No.' },
                { r: 2, c: 27, label: 'LRA' },
                { r: 2, c: 28, label: 'RLA' }
            ],
            columns: [
                // Unit tag renders "AH-TAG/HP-TAG" style (the firm lists one
                // combined tag, e.g. "AH/HP-K1"); pre-fills from the item's
                // indoor + outdoor tags but stays an editable text box.
                { scope: 'item', editable: true, fieldKey: 'mswg_mps_tag', derive: function (g) { return tagPair(g.item.indoorTags && g.item.indoorTags[0], g.item.tag); } },
                { scope: 'item', derive: function (g) { return effNum(g.cell('AB'), 0); } },
                // COP @ 47F: no data source yet
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', capacityField: 'airflow', derive: function (g) { return g.cell('C'); } },
                { scope: 'item', editable: true, fieldKey: 'mswg_mps_oa_cfm' },
                { scope: 'item', editable: true, fieldKey: 'mswg_mps_esp' },
                // --- Air handling unit ---
                { scope: 'item', derive: function (g) { return g.cell('D'); } },
                { scope: 'item', derive: function (g) { return voltOnly(g.cell('N')); } },
                { scope: 'item', derive: function (g) { return phaseOnly(g.cell('N')); } },
                { scope: 'item', kwSelect: true, derive: function (g) { return g.cell('L'); } },
                // Electric heaters in these AHUs are single-step
                { scope: 'item', derive: function () { return '1'; } },
                { scope: 'item', derive: function (g) { return voltOnly(g.cell('N')); } },
                { scope: 'item', derive: function (g) { return phaseOnly(g.cell('N')); } },
                // Heating-coil EAT / LAT: no data source yet
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function (g) { return g.cell('O'); } },
                { scope: 'item', derive: function (g) { return g.cell('P'); } },
                { scope: 'item', derive: function (g) { return g.cell('B'); } },
                // --- DX coil performance ---
                { scope: 'item', derive: function (g) { return slash(g.cell('F'), g.cell('G')); } },
                { scope: 'item', derive: function (g) { return div1000(g.cell('I')); } },
                { scope: 'item', derive: function (g) { return div1000(g.cell('J')); } },
                // --- Heating performance (EAT / LAT: no data source yet) ---
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function (g) { return isPositiveNum(g.cell('K')) ? div1000(g.cell('K')) : '-'; } },
                // --- Outdoor electrical: fan/compressor breakdowns have no
                // data source yet ---
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function (g) { return voltOnly(g.cell('W')); } },
                { scope: 'item', derive: function (g) { return phaseOnly(g.cell('W')); } },
                { scope: 'item', derive: function (g) { return g.cell('X'); } },
                { scope: 'item', derive: function (g) { return g.cell('Y'); } },
                { scope: 'item', derive: function (g) { return g.cell('S'); } },
                { scope: 'item', derive: function () { return '1-9'; } }
            ],
            notesTitle: '',
            notes: [
                '1. REFER TO APPROVED MANUFACTURER LIST FOR ACCEPTABLE EQUAL MANUFACTURERS.  COORDINATE POWER REQUIREMENTS FOR ALL SUBSTITUTIONS.',
                "2.  MECHANICAL CONTRACTOR IS RESPONSIBLE FOR INSTALLING IN ACCORDANCE WITH MANUFACTURER'S INSTALLATION INSTRUCTIONS AND LOCAL CODES.",
                '3. CONTRACTOR SHALL VERIFY SERVICE CLEARANCES FOR ALL SUBSTITUTIONS.',
                '4. SINGLE POINT ELECTRICAL CONNECTION AT AIR HANDLING UNIT UNLESS TWO CIRCUITS SHOWN ON SCHEDULE.',
                '5.  FOR LINE SETS BETWEEN 50 AND 175 FEET, INCLUDE THE FOLLOWING:',
                '        CRANKCASE HEATER',
                '        COMPRESSOR START ASSIST CAPACITOR AND RELAY',
                '        LIQUID - LINE SOLENOID VALVE OR HARD SHUTOFF TXV',
                "6. PROVIDE MANUFACTURER'S REMOTE THERMOSTAT WITH TEMPERATURE/HUMIDITY SENSOR FOR COOLING/HEATING/DEHUMIDIFICATION.",
                '7. REFRIGERANT LINES AND ACCESSORIES PER UNIT MFG. RECOMMENDATIONS.',
                '8. AIR HANDLER CONVERTIBLE FOR VERTICAL / HORIZONTAL INSTALLATION.',
                '9. UNIT SHALL BE SUSPENDED FROM STRUCTURE.',
                '10. PROVIDE OVERFLOW DRAIN PAN BELOW UNIT WITH MICROSWITCH TO SHUT OFF UNIT PRIOR TO PAN OVERFLOW.'
            ],
            manufacturers: null
        };
    }

    function mswgRtu() {
        return {
            orientation: 'rows',
            title: 'PACKAGED CAV SINGLE ZONE RTU WITH GAS HEAT SCHEDULE',
            header: [
                // Tier A
                { r: 0, c: 0, rowspan: 3, label: 'Unit Tag' },
                { r: 0, c: 1, rowspan: 3, label: 'Area Served' },
                { r: 0, c: 2, rowspan: 3, label: 'Nominal\nTons' },
                { r: 0, c: 3, rowspan: 3, label: 'EER' },
                { r: 0, c: 4, rowspan: 3, label: 'IEER/SEER' },
                { r: 0, c: 5, rowspan: 3, label: 'AFUE\n%' },
                { r: 0, c: 6, rowspan: 3, label: 'O.A.\nMin.' },
                { r: 0, c: 7, rowspan: 3, label: 'O.A.\nMax.' },
                { r: 0, c: 8, colspan: 7, label: 'Indoor Fan Motor' },
                { r: 0, c: 15, colspan: 3, label: 'Cooling Performance' },
                { r: 0, c: 18, colspan: 4, label: 'Hot Gas Reheat' },
                { r: 0, c: 22, rowspan: 3, label: 'Refrigerant Charge (lbs)' },
                { r: 0, c: 23, colspan: 4, label: 'Heating Performance' },
                { r: 0, c: 27, colspan: 16, label: 'Electrical Data' },
                { r: 0, c: 43, rowspan: 3, label: 'TempMaster Model' },
                { r: 0, c: 44, rowspan: 3, label: 'Weight\n(lbs.)' },
                { r: 0, c: 45, rowspan: 3, label: 'Remarks' },
                // Tier B
                { r: 1, c: 8, rowspan: 2, label: 'CFM' },
                { r: 1, c: 9, rowspan: 2, label: 'ESP' },
                { r: 1, c: 10, rowspan: 2, label: 'Quantity' },
                { r: 1, c: 11, rowspan: 2, label: 'HP' },
                { r: 1, c: 12, rowspan: 2, label: 'FLA' },
                { r: 1, c: 13, rowspan: 2, label: 'Volts' },
                { r: 1, c: 14, rowspan: 2, label: 'Phase' },
                { r: 1, c: 15, rowspan: 2, label: 'EAT\nDB/WB' },
                { r: 1, c: 16, rowspan: 2, label: 'Total\nMBH' },
                { r: 1, c: 17, rowspan: 2, label: 'Sensible\nMBH' },
                { r: 1, c: 18, colspan: 2, label: 'EVAP' },
                { r: 1, c: 20, colspan: 2, label: 'REHEAT' },
                { r: 1, c: 23, rowspan: 2, label: 'Stages' },
                { r: 1, c: 24, rowspan: 2, label: 'INPUT\nMBH' },
                { r: 1, c: 25, rowspan: 2, label: 'OUTPUT\nMBH' },
                { r: 1, c: 26, rowspan: 2, label: 'Temp.\nRise' },
                { r: 1, c: 27, colspan: 4, label: 'Condenser Fan' },
                { r: 1, c: 31, colspan: 2, label: 'Pwr Exh. Fan' },
                { r: 1, c: 33, colspan: 6, label: 'Compressors' },
                { r: 1, c: 39, rowspan: 2, label: 'MCA' },
                { r: 1, c: 40, rowspan: 2, label: 'MOCP' },
                { r: 1, c: 41, rowspan: 2, label: 'Volts' },
                { r: 1, c: 42, rowspan: 2, label: 'Phase' },
                // Tier C
                { r: 2, c: 18, label: 'MIN' },
                { r: 2, c: 19, label: 'MAX' },
                { r: 2, c: 20, label: 'MIN' },
                { r: 2, c: 21, label: 'MAX' },
                { r: 2, c: 27, label: 'No.' },
                { r: 2, c: 28, label: 'HP' },
                { r: 2, c: 29, label: 'FLA' },
                { r: 2, c: 30, label: 'LRA' },
                { r: 2, c: 31, label: 'No.' },
                { r: 2, c: 32, label: 'FLA' },
                { r: 2, c: 33, label: 'No.' },
                { r: 2, c: 34, label: 'RLA' },
                { r: 2, c: 35, label: 'LRA' },
                { r: 2, c: 36, label: 'No.' },
                { r: 2, c: 37, label: 'LRA' },
                { r: 2, c: 38, label: 'RLA' }
            ],
            columns: [
                // UNIT TAG + AREA SERVED pre-fill from the item but stay
                // editable text boxes.
                { scope: 'item', editable: true, fieldKey: 'mswg_rtu_tag', derive: function (g) { return s(g.item.tag); } },
                { scope: 'item', editable: true, fieldKey: 'mswg_rtu_area', derive: function (g) { return s(g.item.serves); } },
                { scope: 'item', derive: function (g) { return g.cell('C'); } },
                // Native efficiency reads "16.7 IEER/11.8 EER" (or SEER2/
                // EER2): the number after the slash is the EER column, the
                // one before it is IEER/SEER.
                { scope: 'item', derive: function (g) { return effNum(g.cell('I'), 1); } },
                { scope: 'item', derive: function (g) { return effNum(g.cell('I'), 0); } },
                // AFUE: no data source yet
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', editable: true, fieldKey: 'mswg_rtu_oa_min' },
                { scope: 'item', editable: true, fieldKey: 'mswg_rtu_oa_max' },
                // --- Indoor fan motor ---
                { scope: 'item', derive: function (g) { return g.cell('D'); } },
                { scope: 'item', derive: function (g) { return g.cell('E'); } },
                // Fan quantity / HP / FLA: no data source yet (the firm
                // wants per-motor data, not the native unit-level HP)
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function (g) { return voltOnly(g.cell('U')); } },
                { scope: 'item', derive: function (g) { return phaseOnly(g.cell('U')); } },
                // --- Cooling performance ---
                { scope: 'item', derive: function (g) { return slash(g.cell('J'), g.cell('K')); } },
                { scope: 'item', derive: function (g) { return div1000(g.cell('G')); } },
                { scope: 'item', derive: function (g) { return div1000(g.cell('H')); } },
                // --- Hot gas reheat + refrigerant charge: no data source yet
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                // --- Heating performance ---
                { scope: 'item', derive: function (g) { return g.cell('P'); } },
                { scope: 'item', derive: function (g) { return g.cell('N'); } },
                { scope: 'item', derive: function (g) { return g.cell('O'); } },
                // Temp rise: no data source yet
                { scope: 'item', derive: function () { return '-'; } },
                // --- Electrical data: condenser-fan / power-exhaust /
                // compressor breakdowns have no data source yet ---
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function () { return '-'; } },
                { scope: 'item', derive: function (g) { return g.cell('W'); } },
                { scope: 'item', derive: function (g) { return g.cell('X'); } },
                { scope: 'item', derive: function (g) { return voltOnly(g.cell('U')); } },
                { scope: 'item', derive: function (g) { return phaseOnly(g.cell('U')); } },
                // --- Model / weight / remarks ---
                { scope: 'item', derive: function (g) { return g.cell('B'); } },
                { scope: 'item', derive: function (g) { return g.cell('Y'); } },
                { scope: 'item', editable: true, fieldKey: 'mswg_rtu_remarks' }
            ],
            notesTitle: '',
            notes: [
                '1.  REFER TO APPROVED MANUFACTURER LIST FOR ACCEPTABLE EQUAL MANUFACTURERS.  FOR ALL SUBSTITUTIONS MECHANICAL CONTRACTOR SHALL COORDINATE POWER REQUIREMENTS WITH ELECTRICAL CONTRACTOR AND PHYSICAL DIMENSIONS WITH GENERAL CONTRACTOR PRIOR TO ORDERING.',
                '2.  SINGLE POINT ELECTRICAL CONNECTION.  DISCONNECT BY ELECTRICAL CONTRACTOR.',
                '3.  REFRIGERANT HOT GAS REHEAT AND R-32 REFRIGERANT.  PROVIDE WITH REFRIGERANT MONITORING FOR SYSTEMS WITH GREATER THAN 3.91 LBS OF REFRIGERANT.',
                '4.  MANUFACTURER FAN DATA BASED ON WET COIL AND CLEAN FILTERS. TSP = ESP + ECON HOOD PD.',
                '5.  MANUFACTURER COOLING DATA BASED ON 80F/67F ENTERING AIR AND 95F AMBIENT OUTDOOR TEMPERATURE.',
                '6.  MANUFACTURER REHEAT DATA BASED ON 75FDB/59FWB ENTERING AIR AND 70F AMBIENT OUTDOOR TEMPERATURE.',
                '7.  CONSTANT AIR VOLUME.',
                '8.  PROVIDE UNIT WITH WATER LEVEL MONITORING DEVICE IN CONDENSATE DRAIN PAN TO SHUT UNIT DOWN IN ACCORDANCE WITH 2018 NCMC SECTION 307.2.3.1 WATER LEVEL MONITORING DEVICE.',
                '9. PROVIDE A DUCT MOUNTED IONIZATION TYPE SMOKE DETECTOR IN RETURN DUCT FOR UNITS WITH GREATER THAN 2,000 CFM SUPPLY AIR.  UPON DETECTION OF SMOKE, THERE SHALL BE FIRE ALARM NOTIFICATION AND THE UNIT SHALL SHUT DOWN.',
                '    ELECTRICAL CONTRACTOR SHALL FURNISH DUCT MOUNTED SMOKE DETECTOR AND ANY OTHER APPURTENANCES NECESSARY FOR A COMPLETE INSTALLATION.  MECHANICAL CONTRACTOR SHALL INSTALL THE DUCT DETECTOR IN THE RETURN DUCT.',
                '9. PROVIDE A DUCT MOUNTED IONIZATION TYPE SMOKE DETECTOR IN RETURN DUCT FOR UNITS WITH GREATER THAN 2,000 CFM SUPPLY AIR.  UPON DETECTION OF SMOKE, THERE SHALL BE ACTIVATION OF AN AUDIO/VISUAL DEVICE AND THE UNIT SHALL SHUT DOWN.',
                '    MECHANICAL CONTRACTOR SHALL FURNISH DUCT MOUNTED SMOKE DETECTOR AND ANY OTHER APPURTENANCES NECESSARY FOR A COMPLETE INSTALLATION.  MECHANICAL CONTRACTOR SHALL INSTALL THE DUCT DETECTOR IN THE RETURN DUCT.',
                '10. OUTSIDE AIR INTAKE HOOD WITH MANUAL VOLUME DAMPER.  PER 2018 NCECC, ECONOMIZER IS NOT REQUIRED FOR SYSTEMS LESS THAN 65,000 BTUH.',
                '11. FOR CLIMATE ZONE 3B OR 4B, PROVIDE DRY BULB OUTSIDE AIR ECONOMIZER WITH TRAQ OUTSIDE AIR MEASUREMENT, WITH BAROMETRIC RELIEF AND/OR POWER EXHAUST.',
                '12. FOR CLIMATE ZONE 3A OR 4A, PROVIDE ENTHALPY BASED OUTSIDE AIR ECONOMIZER WITH BAROMETRIC RELIEF AND/OR POWER EXHAUST.',
                '13. UNIT SHALL BE ROOF MOUNTED WITH VERTICAL DISCHARGE.  PROVIDE MANUFACTURER\'S MINIMUM 14" HIGH CURB.',
                '14. UNIT SHALL BE HORIZONTAL DISCHARGE, UTILIZING A HORIZONTAL DISCHARGE CURB',
                '15.   2" THICK MERV 13 DISPOSABLE FILTERS.',
                "16. MANUFACTURER'S 7-DAY PROGRAMMABLE THERMIDISTAT FOR CONTROL OF HEATING/COOLING/DEHUMIDIFICATION CYCLES.",
                "17. PROVIDE MANUFACTURER'S UNIT CONTROLLER AND INTEGRATE IN TO BUILDING AUTOMATION SYSTEM, INCLUDING MAPPING AND GRAPHICS.  PROVIDE BACNET CARD.",
                "      PROVIDE MANUFACTURER'S TEMPERATURE AND HUMIDITY SENSOR.  UNIT CONTROLLER SHALL BE CAPABLE OF CONTROLLING HEATING, COOLING, DEHUMIDIFICATION, AND ECONOMIZER.",
                '18. PROVIDE DEMAND CONTROLLED VENTILATION, CARBON DIOXIDE BASED WITH FULLY MODULATING OUTSIDE AIR DAMPERS AND INTEGRAL CONTROLS LOGIC.',
                '18. DEMAND CONTROL VENTILATION IS NOT REQUIRED PER EXCEPTION 3 OF C403.2.6.1, SYSTEMS LESS THAN 1,200 CFM OF OUTSIDE AIR.',
                '19.  PROVIDE UNIT WITH UV LIGHTS, FIELD INSTALLED DOWNSTREAM OF COOLING COIL.',
                '20.  PROVIDE UNIT WITH BIPOLAR IONIZATION, FIELD INSTALLED DOWNSTREAM OF AIR FILTRATION.  REFER TO APPROVED MANUFACTURER LIST FOR ACCEPTABLE EQUAL MANUFACTURERS.  COORDINATE POWER REQUIREMENTS WITH ELECTRICAL CONTRACTOR.',
                '21. PROVIDE GAS REGULATOR FOR 2-PSI GAS SERVICE AND DISTRIBUTION.',
                '22.  COORDINATE WITH ELECTRICAL CONTRACTOR TO PROVIDE DUCT MOUNTED CARBON MONOXIDE DETECTOR IN EACH ROOFTOP UNIT SUPPLY DUCT AS REQUIRED TO MEET THE EXCEPTION TO 2018 NCMC, SECTION 313.4.1.3.',
                '       CARBON MONOXIDE DETECTOR SHALL BE WIRED TO FIRE ALARM FOR NOTIFICATION AND TO BAS FOR RTU SHUT DOWN.',
                '23. 5 YEAR BASE LIMITED WARRANTY ON COMPRESSOR AND 3 YEAR BASE LIMITED WARRANTY ON PARTS.'
            ],
            manufacturers: null
        };
    }

    T.register('mswg', 'MSWG', {
        multi_position_splits: mswgMultiSplit,
        mini_splits: mswgMiniSplit,
        gas_packs: mswgRtu
    });
})();
