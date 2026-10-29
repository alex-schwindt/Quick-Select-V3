/* ============================================================
   HHpro - Gas Pack RTU capacity tables (HHpro.GasPackCapacity)
   ------------------------------------------------------------
   Backs the condition-aware Gas Pack RTU section of Design
   Search. The schedule rows are these same tables at one
   standard condition (80/67 EAT, 95 ambient, 400 CFM/ton); the
   search answers for any condition TempMaster publishes.

   Data: DATA/JSON/gas_pack_capacity.json (built by
   convert_to_json.py from "TempMaster RTU Capacity Tables.xlsx" -
   the Omni Pro KJ, Omni Choice LV and Omni Select RV technical
   guides). Keyed by CABINET - KJ037, LV15, RV30, ... - because
   TempMaster publishes one cooling table per cabinet that applies
   to every voltage and motor built on it. Voltage and motor only
   change the electrical block.

   TempMaster model numbers are 18 characters, most of them
   option codes (economizer, sensors, filters, ...) the tables
   say nothing about. So a result's model number is never built
   from scratch: it starts from the matching model on the
   schedule and only the characters the search decides - blower,
   voltage, heat size, hot gas reheat - are rewritten.

   The off-grid policy (worst-case, never interpolate) lives in
   capacity_core.js and is shared with Multi Position Splits.
   Airflow is handled here rather than there: a cabinet qualifies
   only if one of its three rated airflows falls inside the CFM
   tolerance the engineer entered, and capacity is then read at a
   RATED airflow - never at the typed value, which would pair a
   real capacity with an airflow it was not measured at.
   ============================================================ */

(function () {
    'use strict';
    window.HHpro = window.HHpro || {};

    var CAPACITY_URL = 'DATA/JSON/gas_pack_capacity.json';
    var PRODUCT = 'gas_packs';

    var core = HHpro.CapacityCore;
    var cache = null;
    var loadPromise = null;

    // Motor keys are the static level as TempMaster's blower letter spells
    // it on the LV/RV: B standard, C medium, D high. Only standard and high
    // are offered - medium exists on the LV and RV (its electrical data is in
    // the JSON) but is not something Eric quotes, and the schedule carries
    // none.
    var OFFERED_MOTORS = ['B', 'D'];
    var MOTOR_LABELS = { B: 'Standard Static', C: 'Medium Static', D: 'High Static' };
    var HEAT_TO_LETTER = { Low: 'L', Medium: 'M', High: 'H' };
    var EFFICIENCY_LABELS = { LOW: 'Low', STANDARD: 'Standard', HIGH: 'High' };

    // ---- TempMaster model-number layouts ----------------------------
    // Character positions (0-based) from the nomenclature pages of the
    // KJ, LV and RV technical guides. RV shares the LV positions but has
    // its own refrigeration codes.
    //
    // KJ blower letters come in standard/high pairs per drive type
    // (belt B/D, VFD-VAV E/G, ... IntelliSpeed P/R ...), so a static
    // change keeps the drive type the schedule row was built with.
    var KJ_BLOWER_PAIRS = [['B', 'D'], ['E', 'G'], ['H', 'K'], ['L', 'N'],
                           ['P', 'R'], ['S', 'U'], ['V', 'X']];
    var LAYOUTS = {
        KJ: {
            re: /^KJ\d{3}[CENS]\d{2}[A-Z][245]/,
            cabinet: [0, 5], heatType: 5, heat: [6, 8], blower: 8, voltage: 9,
            refrigeration: 14,
            // Refrigeration option without reheat -> the same option with it.
            reheat: { A: 'E', B: 'L', C: 'P', F: 'H' }
        },
        LV: {
            re: /^LV\d{2}[CENST]\d[BCD][A-Z][245BDE]/,
            cabinet: [0, 4], heatType: 4, heat: [5, 6], blower: 6, voltage: 8,
            refrigeration: 14,
            reheat: { 1: '4', 3: '6', 8: 'L' }
        },
        RV: {
            re: /^RV\d{2}[CENST]\d[BCD][A-Z][245BDE]/,
            cabinet: [0, 4], heatType: 4, heat: [5, 6], blower: 6, voltage: 8,
            refrigeration: 14,
            // 1 standard -> 4 modulating HGR; A service valves -> D HGR + SV
            reheat: { 1: '4', A: 'D' }
        }
    };
    var VOLTAGE_DIGITS = { 2: '208/3', B: '208/3', 4: '460/3', D: '460/3', 5: '575/3', E: '575/3' };
    var DIGIT_FOR_VOLTAGE = { '208/3': '2', '460/3': '4', '575/3': '5' };

    // Sensible heat rate for standard air: BTU/h = 1.08 x CFM x deltaT.
    var AIR_CONST = 1.08;

    // -----------------------------------------------------------------
    // Loading
    // -----------------------------------------------------------------
    function load() {
        if (cache) return Promise.resolve(cache);
        if (loadPromise) return loadPromise;
        loadPromise = fetch(CAPACITY_URL)
            .then(function (r) {
                if (!r.ok) throw new Error('gas pack capacity tables ' + r.status);
                return r.json();
            })
            .then(function (json) { cache = json || { cabinets: {} }; return cache; })
            .catch(function () {
                // Missing/unreadable: degrade to "no tables" so Design Search
                // falls back to its schema targets instead of erroring.
                cache = { cabinets: {} };
                return cache;
            });
        return loadPromise;
    }

    function ensureFor(productKey) {
        return (productKey === PRODUCT) ? load() : Promise.resolve(cache);
    }

    function cabinets() { return (cache && cache.cabinets) || {}; }

    // -----------------------------------------------------------------
    // Model numbers
    // -----------------------------------------------------------------
    function layoutFor(s) {
        var layout = LAYOUTS[s.slice(0, 2)];
        return (layout && layout.re.test(s)) ? layout : null;
    }

    // Blower letter -> static level key (B/C/D) used by the electrical data.
    function staticLevel(layout, letter) {
        if (layout !== LAYOUTS.KJ) return letter;          // LV/RV: B/C/D already
        for (var i = 0; i < KJ_BLOWER_PAIRS.length; i++) {
            if (KJ_BLOWER_PAIRS[i][0] === letter) return 'B';
            if (KJ_BLOWER_PAIRS[i][1] === letter) return 'D';
        }
        return null;
    }

    // Static level -> blower letter, keeping the template's drive type.
    function blowerLetter(layout, templateLetter, level) {
        if (layout !== LAYOUTS.KJ) return level;
        for (var i = 0; i < KJ_BLOWER_PAIRS.length; i++) {
            if (KJ_BLOWER_PAIRS[i].indexOf(templateLetter) !== -1) {
                return level === 'B' ? KJ_BLOWER_PAIRS[i][0] : KJ_BLOWER_PAIRS[i][1];
            }
        }
        return level === 'B' ? 'B' : 'D';
    }

    function hasReheat(layout, letter) {
        return Object.keys(layout.reheat).some(function (k) { return layout.reheat[k] === letter; });
    }

    /** The heat size (Low/Medium/High) a cabinet's heat code means. */
    function heatSizeFor(cabinet, code) {
        var cab = cabinets()[cabinet];
        var match = cab && (cab.heat || []).filter(function (h) { return h.code === code; })[0];
        return match ? match.size : null;
    }

    /**
     * Split a schedule model number into the parts the capacity tables
     * care about.
     * 'KJ049N08D2BEAAA5A1' -> { cabinet:'KJ049', voltage:'208/3', motor:'D',
     *                           heatCode:'08', heat:'Medium', hgrh:false }
     * Returns null for anything that isn't a TempMaster gas pack model.
     */
    function parseModel(model) {
        var s = String(model || '').trim().toUpperCase();
        var layout = layoutFor(s);
        if (!layout) return null;
        var cabinet = s.slice(layout.cabinet[0], layout.cabinet[1]);
        var heatCode = s.slice(layout.heat[0], layout.heat[1]);
        return {
            cabinet: cabinet,
            voltage: VOLTAGE_DIGITS[s.charAt(layout.voltage)] || null,
            motor: staticLevel(layout, s.charAt(layout.blower)),
            heatCode: heatCode,
            heat: heatSizeFor(cabinet, heatCode),
            hgrh: hasReheat(layout, s.charAt(layout.refrigeration))
        };
    }

    function setChar(s, pos, ch) {
        return (ch && pos < s.length) ? s.slice(0, pos) + ch + s.slice(pos + 1) : s;
    }

    /**
     * Model number for a result: the closest schedule model for the same
     * cabinet, with blower, voltage, heat size and reheat rewritten to the
     * result's. Every other option code is kept as the schedule has it.
     * parts = { cabinet, voltage, motor, heat, hgrh:'YES'|'NO' }
     * templates = schedule model numbers (any order). A cabinet with no row
     * on the schedule (RV27 today) borrows a sibling cabinet's model from
     * the same family, with the capacity digits rewritten. With no template
     * in the family at all, returns the cabinet name - a model number can't
     * be invented without the option codes.
     */
    function buildModel(parts, templates) {
        var heatCode = null;
        var cab = cabinets()[parts.cabinet];
        (cab && cab.heat || []).forEach(function (h) { if (h.size === parts.heat) heatCode = h.code; });
        var wantHgrh = String(parts.hgrh || 'NO').toUpperCase() === 'YES';
        var family = parts.cabinet.slice(0, 2);

        var best = null;
        (templates || []).forEach(function (m) {
            var p = parseModel(m);
            if (!p || p.cabinet.slice(0, 2) !== family) return;
            var score = (p.cabinet === parts.cabinet ? 0 : 8) +
                        (p.voltage === parts.voltage ? 0 : 4) + (p.heatCode === heatCode ? 0 : 2) +
                        (p.hgrh === wantHgrh ? 0 : 1) + (p.motor === parts.motor ? 0 : 0.5);
            if (!best || score < best.score) best = { model: String(m).trim().toUpperCase(), score: score };
        });
        if (!best) return parts.cabinet;

        var s = best.model;
        var layout = layoutFor(s);
        s = parts.cabinet + s.slice(layout.cabinet[1]);
        s = setChar(s, layout.voltage, DIGIT_FOR_VOLTAGE[parts.voltage]);
        s = setChar(s, layout.blower, blowerLetter(layout, s.charAt(layout.blower), parts.motor));
        if (heatCode && heatCode.length === layout.heat[1] - layout.heat[0]) {
            s = s.slice(0, layout.heat[0]) + heatCode + s.slice(layout.heat[1]);
        }
        var refrig = s.charAt(layout.refrigeration);
        if (wantHgrh && !hasReheat(layout, refrig) && layout.reheat[refrig]) {
            s = setChar(s, layout.refrigeration, layout.reheat[refrig]);
        } else if (!wantHgrh && hasReheat(layout, refrig)) {
            Object.keys(layout.reheat).forEach(function (k) {
                if (layout.reheat[k] === refrig) s = setChar(s, layout.refrigeration, k);
            });
        }
        return s;
    }

    // -----------------------------------------------------------------
    // Form options
    // -----------------------------------------------------------------
    function formOptions() {
        var cabs = cabinets();
        var tons = {}, volts = {}, ambients = {}, effs = {};
        Object.keys(cabs).forEach(function (name) {
            var c = cabs[name];
            if (c.tons != null) tons[c.tons] = true;
            Object.keys(c.electrical || {}).forEach(function (v) { volts[v] = true; });
            (((c.axes || {}).oaCooling) || []).forEach(function (a) { ambients[a] = true; });
            if (c.efficiency) effs[c.efficiency] = true;
        });
        function nums(o) {
            return Object.keys(o).map(Number).sort(function (a, b) { return a - b; });
        }
        return {
            tons: nums(tons),
            electrical: Object.keys(volts).sort(),
            motors: OFFERED_MOTORS.map(function (m) {
                return { value: m, label: MOTOR_LABELS[m] };
            }),
            ambients: nums(ambients),
            // Ascending efficiency, not alphabetical.
            efficiencies: ['LOW', 'STANDARD', 'HIGH'].filter(function (e) { return effs[e]; })
                .map(function (e) { return { value: e, label: EFFICIENCY_LABELS[e] }; })
        };
    }

    // -----------------------------------------------------------------
    // Gas heat
    // -----------------------------------------------------------------
    /** High-stage temperature rise (degF) a heat size produces at an airflow. */
    function riseFor(outputMbh, cfm) {
        var o = Number(outputMbh), c = Number(cfm);
        if (!isFinite(o) || !isFinite(c) || c <= 0) return null;
        return o * 1000 / (AIR_CONST * c);
    }

    function inRange(value, range) {
        if (!range || value == null) return true;   // no published range -> can't reject
        return value >= range[0] && value <= range[1];
    }

    /**
     * Gas heat performance for one heat size at an airflow.
     * Returns null when the resulting rise falls outside the range TempMaster
     * publishes for that furnace - an out-of-range rise is not a selection
     * you can make, so the size is dropped rather than shown as a near miss.
     */
    function heatAt(heat, cfm) {
        var riseHigh = riseFor(heat.outputHigh, cfm);
        if (riseHigh == null || !inRange(riseHigh, heat.riseHigh)) return null;
        var riseLow = riseFor(heat.outputLow, cfm);
        return {
            size: heat.size,
            letter: HEAT_TO_LETTER[heat.size] || null,
            inputHigh: heat.inputHigh, outputHigh: heat.outputHigh,
            inputLow: heat.inputLow, outputLow: heat.outputLow,
            riseHigh: riseHigh,
            riseLow: riseLow,
            // Low fire is reported, not gated: the unit is selected on high
            // stage, and a low stage that drifts under its published range
            // is a modulation detail rather than a reason to reject.
            riseLowInRange: inRange(riseLow, heat.riseLow),
            riseHighRange: heat.riseHigh, riseLowRange: heat.riseLow,
            thermalEff: heat.thermalEff
        };
    }

    // -----------------------------------------------------------------
    // Electrical
    // -----------------------------------------------------------------
    /**
     * MCA / MOP / HP for a cabinet at a voltage and motor, for the
     * electrical options ticked on the form.
     * opts = { convOutlet: bool, powerExhaust: bool }
     */
    function electricalFor(cabinet, voltage, motor, opts) {
        var cab = cabinets()[cabinet];
        var e = cab && cab.electrical && cab.electrical[voltage] &&
                cab.electrical[voltage][motor];
        if (!e) return null;
        var conv = !!(opts && opts.convOutlet);
        var pe = !!(opts && opts.powerExhaust);
        var mca = e.mca, mop = e.mop;
        if (conv && pe) { mca = e.mcaBoth; mop = e.mopBoth; }
        else if (conv) { mca = e.mcaConv; mop = e.mopConv; }
        else if (pe) { mca = e.mcaPe; mop = e.mopPe; }
        return {
            model: e.model, voltage: voltage, motor: motor,
            mca: mca, mop: mop, hp: e.hp,
            convOutlet: conv, powerExhaust: pe,
            convFla: e.convFla, peFla: e.peFla
        };
    }

    // -----------------------------------------------------------------
    // Search
    // -----------------------------------------------------------------
    function within(value, target, tolPct) {
        if (target == null || !isFinite(target) || target <= 0) return true;
        var tol = (tolPct == null ? 10 : tolPct) / 100;
        return Math.abs(value - target) <= Math.abs(target) * tol;
    }

    function deviation(value, target) {
        if (target == null || !isFinite(target) || target <= 0) return 0;
        return Math.abs(value - target) / target;
    }

    /** Rated airflows inside the CFM tolerance window. */
    function airflowsInWindow(axes, cfm, tolPct) {
        var all = ((axes || {}).airflow || []).map(Number).filter(isFinite);
        if (cfm == null || !isFinite(cfm)) return all;
        return all.filter(function (a) { return within(a, cfm, tolPct); });
    }

    /**
     * Run a design search.
     *
     * criteria = {
     *   tons, electrical, motor, efficiency, hgrh,   // hard filters, null = any
     *   ambient,                                     // degF, required
     *   eatDb, eatWb,                                // degF, required
     *   cfm:{value,tol}, coolTotal:{value,tol}, coolSensible:{value,tol},
     *   heatRise:{value,tol},
     *   convOutlet, powerExhaust,                    // booleans
     *   templates,                                   // schedule model numbers,
     *                                                //   for result model numbers
     *   voltages                                     // optional: only these voltages
     * }
     *
     * Returns { results:[...], skipped:[{cabinet, reason}] } with results
     * sorted best-match first. One result per cabinet + voltage + motor +
     * heat size, because those are four genuinely different units.
     */
    function search(criteria) {
        var c = criteria || {};
        var cabs = cabinets();
        var results = [];
        var skipped = [];

        Object.keys(cabs).forEach(function (name) {
            var cab = cabs[name];

            if (cab.coolingUnavailable) {
                skipped.push({ cabinet: name, tons: cab.tons,
                               reason: 'no published cooling data' });
                return;
            }
            if (c.tons != null && Number(cab.tons) !== Number(c.tons)) return;
            if (c.efficiency && cab.efficiency !== c.efficiency) return;

            // Hot gas reheat is not in the cooling tables - it is a factory
            // option that exists as its own row in the schedule, and it does
            // not change cooling-mode capacity. So it is expanded here
            // rather than filtered: a cabinet that can be built either way
            // yields BOTH variants when the filter is left on All, because
            // both are genuinely orderable units. Which cabinets offer it
            // comes from the converter (GAS_PACK_FAMILIES).
            var hgrhCapable = !!cab.hgrh;
            if (c.hgrh === 'YES' && !hgrhCapable) return;
            var hgrhOptions = c.hgrh ? [c.hgrh] : (hgrhCapable ? ['NO', 'YES'] : ['NO']);

            var cfmTarget = (c.cfm && c.cfm.value) || null;
            var cfmTol = (c.cfm && c.cfm.tol);
            var airflows = airflowsInWindow(cab.axes, cfmTarget, cfmTol);
            if (!airflows.length) return;

            var cool = core.coolingAt(
                cab,
                { oa: c.ambient, eatDb: c.eatDb, eatWb: c.eatWb },
                {
                    total: (c.coolTotal && c.coolTotal.value) || null,
                    sensible: (c.coolSensible && c.coolSensible.value) || null
                },
                { airflows: airflows }
            );
            if (!cool.applicable || cool.outOfRange || cool.noData || !cool.result) {
                if (cool.outOfRange) {
                    skipped.push({ cabinet: name, tons: cab.tons,
                                   reason: 'design condition outside the rated table',
                                   ranges: cool.ranges });
                }
                return;
            }
            var r = cool.result;
            if (!within(r.total, c.coolTotal && c.coolTotal.value,
                        c.coolTotal && c.coolTotal.tol)) return;
            if (!within(r.sensible, c.coolSensible && c.coolSensible.value,
                        c.coolSensible && c.coolSensible.tol)) return;

            // Voltage x motor x heat size -> one result each.
            Object.keys(cab.electrical || {}).forEach(function (voltage) {
                if (c.electrical && voltage !== c.electrical) return;
                if (c.voltages && c.voltages.indexOf(voltage) === -1) return;
                OFFERED_MOTORS.forEach(function (motor) {
                    if (c.motor && motor !== c.motor) return;
                    var elec = electricalFor(name, voltage, motor, c);
                    if (!elec) return;

                    (cab.heat || []).forEach(function (h) {
                        var heat = heatAt(h, r.airflow);
                        if (!heat) return;   // rise outside the published range
                        if (!within(heat.riseHigh, c.heatRise && c.heatRise.value,
                                    c.heatRise && c.heatRise.tol)) return;

                        var score =
                            deviation(r.total, c.coolTotal && c.coolTotal.value) +
                            deviation(r.sensible, c.coolSensible && c.coolSensible.value) +
                            deviation(r.airflow, cfmTarget) +
                            deviation(heat.riseHigh, c.heatRise && c.heatRise.value);

                        hgrhOptions.forEach(function (hgrh) {
                            results.push({
                                cabinet: name,
                                family: cab.family,
                                efficiency: cab.efficiency,
                                tons: cab.tons,
                                model: buildModel({ cabinet: name, voltage: voltage,
                                                    motor: motor, heat: heat.size,
                                                    hgrh: hgrh }, c.templates),
                                voltage: voltage,
                                motor: motor,
                                motorLabel: MOTOR_LABELS[motor],
                                hgrh: hgrh,
                                cooling: {
                                    airflow: r.airflow,
                                    eatDb: r.eatDb, eatWb: r.eatWb,
                                    ambient: r.oaCooling,
                                    total: r.total, sensible: r.sensible,
                                    lat: r.lat
                                },
                                // Which axes were snapped to a harsher rated
                                // point (null when the design point was rated
                                // exactly).
                                offGrid: Object.keys(cool.offGrid || {}).length
                                    ? cool.offGrid : null,
                                heat: heat,
                                electrical: elec,
                                score: score
                            });
                        });
                    });
                });
            });
        });

        results.sort(function (a, b) {
            if (a.score !== b.score) return a.score - b.score;
            if (a.model !== b.model) return a.model < b.model ? -1 : 1;
            // Same cabinet built both ways: plain unit before the reheat one,
            // so the pair is ordered rather than arbitrary.
            return (a.hgrh === b.hgrh) ? 0 : (a.hgrh === 'NO' ? -1 : 1);
        });
        return { results: results, skipped: skipped };
    }

    // -----------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------
    HHpro.GasPackCapacity = {
        PRODUCT: PRODUCT,
        load: load,
        ensureFor: ensureFor,
        isProduct: function (productKey) { return productKey === PRODUCT; },
        hasTables: function () {
            return !!(cache && cache.cabinets && Object.keys(cache.cabinets).length);
        },
        cabinets: cabinets,
        formOptions: formOptions,
        parseModel: parseModel,
        buildModel: buildModel,
        riseFor: riseFor,
        heatAt: heatAt,
        electricalFor: electricalFor,
        search: search,
        MOTOR_LABELS: MOTOR_LABELS,
        EFFICIENCY_LABELS: EFFICIENCY_LABELS
    };

    core.register(PRODUCT, HHpro.GasPackCapacity);
})();
