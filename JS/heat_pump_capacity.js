/* ============================================================
   HHpro - Packaged heat pump capacity tables (HHpro.HeatPumpCapacity)
   ------------------------------------------------------------
   Drives the condition-aware Packaged Heat Pumps section of Design
   Search. A schedule row is matched to its table by the first five
   characters of its model number (WQE04, WXEA7, MV13C ...) - the
   size TempMaster publishes a capacity table for.

   Data: DATA/JSON/packaged_heat_pump_capacity.json, built by
   convert_to_json.py from "TempMaster Heat Pump Capacity
   Tables.xlsx" (tools/heat_pump_capacity extracts that workbook from
   the technical guides; its Notes sheet lists every catalog misprint
   handled).

   COOLING follows the site-wide off-grid policy in capacity_core.js
   (worst-case bracketing rated point, never interpolated).

   HEAT-PUMP HEATING is the one exception. The guides print heating
   capacity every 10 °F of outdoor temperature (-10 or -5 ... 60 °F),
   so the usual design points (47 °F, 17 °F) always fall between
   columns, and reading the colder column would understate capacity
   by 10-15 %. A value between two columns is interpolated linearly.
   For Omni Core and Omni Pro the printed rows are straight lines, so
   this reproduces the catalog exactly. Omni Choice (MV) rows curve
   upward, so the line reads slightly above the curve - checked: the
   result is still 2-4 % below each MV size's scheduled 47 °F rating
   and 5-11 % below its 17 °F rating (see the workbook's Notes sheet).
   Across AIRFLOW nothing is interpolated: the weaker of the two
   bracketing rated airflows is reported, like cooling. Heating is
   read at 70 °F indoor DB, the site's heat-pump heating condition.
   ============================================================ */

(function () {
    'use strict';
    window.HHpro = window.HHpro || {};

    var PRODUCT = 'packaged_heat_pumps';
    var CAPACITY_URL = 'DATA/JSON/packaged_heat_pump_capacity.json';
    var core = HHpro.CapacityCore;

    var cache = null;
    var loadPromise = null;

    function load() {
        if (cache) return Promise.resolve(cache);
        if (loadPromise) return loadPromise;
        loadPromise = fetch(CAPACITY_URL)
            .then(function (r) {
                if (!r.ok) throw new Error('heat pump capacity tables ' + r.status);
                return r.json();
            })
            .then(function (json) { cache = json || { units: {} }; return cache; })
            .catch(function () {
                // Missing/unreadable: no tables, so Design Search falls back
                // to the nominal schedule comparison instead of erroring.
                cache = { units: {} };
                return cache;
            });
        return loadPromise;
    }

    function ensureFor(productKey) {
        return (productKey === PRODUCT) ? load() : Promise.resolve(cache);
    }

    // -----------------------------------------------------------------
    // Schedule columns, resolved by header LABEL (not letter) so the
    // feature survives column edits - the approach capacity.js uses.
    // -----------------------------------------------------------------
    function norm(s) {
        // Degree signs arrive mojibake'd in some builds; compare without them.
        return String(s == null ? '' : s).replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ')
            .trim().toUpperCase();
    }

    function resolveColumns(data) {
        if (data.__hpCapacityCols) return data.__hpCapacityCols;
        var header = (data && data.scheduleHeader) || {};
        var leaf = {};      // col letter -> label of its lowest header cell
        (header.rows || []).forEach(function (row) {
            row.forEach(function (cell) {
                if ((cell.colspan || 1) === 1) leaf[cell.col] = norm(cell.value);
            });
        });
        function find(test) {
            var letters = header.columnLetters || [];
            for (var i = 0; i < letters.length; i++) {
                if (leaf[letters[i]] != null && test(leaf[letters[i]])) return letters[i];
            }
            return null;
        }
        var hp47 = find(function (l) { return l.indexOf('CAPACITY @ 47') === 0; });
        var cols = {
            model:        find(function (l) { return l === 'MODEL NUMBER'; }),
            airflow:      find(function (l) { return l === 'CFM'; }),
            coolTotal:    find(function (l) { return l.indexOf('TOTAL CAPACITY') === 0; }),
            coolSensible: find(function (l) { return l.indexOf('SENSIBLE CAPACITY') === 0; }),
            hpTotalCols:  hp47 ? [hp47] : [],
            // Descriptive columns for Design Search's evaluated results.
            tons:         find(function (l) { return l === 'NOM TONS'; }),
            blower:       find(function (l) { return l === 'BLOWER'; }),
            voltage:      find(function (l) { return l === 'VOLT/PH'; }),
            elecKw:       find(function (l) { return l === 'KW'; }),
            hgrh:         find(function (l) { return l.indexOf('MODULATING HOT GAS REHEAT') === 0; })
        };
        data.__hpCapacityCols = cols;
        return cols;
    }

    function unitFor(scheduleData, data) {
        if (!cache || !cache.units) return null;
        var col = resolveColumns(data).model;
        var model = col ? scheduleData[col] : null;
        if (!model) return null;
        return cache.units[String(model).trim().slice(0, 5).toUpperCase()] || null;
    }

    // -----------------------------------------------------------------
    // Heat-pump heating
    // -----------------------------------------------------------------

    // Capacity at one rated airflow and any outdoor temperature inside the
    // printed range: the printed value, or the straight line between the
    // two printed neighbours. null when a needed column is missing.
    function heatingAtAirflow(heat, cfm, oaBr) {
        var row = heat.capacity[core.numStr(cfm)];
        if (!row) return null;
        if (oaBr.exact != null) {
            var v = Number(row[core.numStr(oaBr.exact)]);
            return isFinite(v) ? v : null;
        }
        var lo = Number(row[core.numStr(oaBr.lo)]);
        var hi = Number(row[core.numStr(oaBr.hi)]);
        if (!isFinite(lo) || !isFinite(hi)) return null;
        return lo + (hi - lo) * (oaBr.value - oaBr.lo) / (oaBr.hi - oaBr.lo);
    }

    /**
     * Heat-pump heating capacity (BTU/h, 70 °F indoor DB) at an outdoor
     * ambient and airflow. `cfm` is the airflow the unit will run at
     * (Design Search passes the cooling airflow it evaluated, or the
     * entered / scheduled CFM). Between two rated airflows the weaker is
     * reported; outside the rated airflow range the nearest rated airflow
     * is used and flagged.
     *
     * Returns { applicable:false } with no heating table, or
     * { applicable, outOfRange, min, max } / { applicable, noData } /
     * { applicable, capacity, ambientUsed, airflowUsed, interpolated,
     *   airflowBracket, airflowNearest }.
     */
    function hpAt(unit, ambient, cfm) {
        var heat = unit && unit.heating;
        if (!heat || !heat.airflow || !heat.airflow.length) return { applicable: false };
        var oaBr = core.bracketOn(heat.oa, ambient);
        if (!oaBr) return { applicable: false };
        if (oaBr.outOfRange) {
            return { applicable: true, outOfRange: true, min: oaBr.min, max: oaBr.max };
        }
        oaBr.value = Number(ambient);

        var airflows = heat.airflow.map(Number);
        var candidates, nearest = false, bracket = null;
        var want = Number(cfm);
        if (cfm == null || !isFinite(want)) {
            candidates = airflows;          // unknown airflow: weakest of all
        } else {
            var afBr = core.bracketOn(airflows, want);
            if (afBr && !afBr.outOfRange) {
                candidates = (afBr.exact != null) ? [afBr.exact] : [afBr.lo, afBr.hi];
                if (afBr.exact == null) bracket = { lo: afBr.lo, hi: afBr.hi };
            } else {
                var near = airflows.reduce(function (a, b) {
                    return Math.abs(b - want) < Math.abs(a - want) ? b : a;
                });
                candidates = [near];
                nearest = true;
            }
        }

        var best = null;
        candidates.forEach(function (a) {
            var cap = heatingAtAirflow(heat, a, oaBr);
            if (cap == null) return;
            if (!best || cap < best.capacity) best = { capacity: cap, airflow: a };
        });
        if (!best) return { applicable: true, noData: true };
        return {
            applicable: true,
            capacity: Math.round(best.capacity),
            ambientUsed: Number(ambient),
            airflowUsed: best.airflow,
            interpolated: oaBr.exact == null,
            oaBracket: oaBr.exact == null ? { lo: oaBr.lo, hi: oaBr.hi } : null,
            airflowBracket: bracket,
            airflowNearest: nearest
        };
    }

    // -----------------------------------------------------------------
    // Public API (the provider contract Design Search uses - same names
    // as HHpro.Capacity's condition-aware lookups)
    // -----------------------------------------------------------------
    HHpro.HeatPumpCapacity = {
        PRODUCT: PRODUCT,
        load: load,
        ensureFor: ensureFor,
        isProduct: function (productKey) { return productKey === PRODUCT; },
        hasTables: function () {
            return !!(cache && cache.units && Object.keys(cache.units).length);
        },
        columnsFor: function (data) { return resolveColumns(data); },
        matchupForRow: function (scheduleData, data) { return unitFor(scheduleData || {}, data); },
        coolingAt: core.coolingAt,
        hpAt: hpAt,

        // Design Search behaviour flags for this product:
        //  - the CFM target picks the rated airflow capacity is read at
        //    (at or below the design CFM first, as for gas packs), rather
        //    than gating the schedule row's stored CFM;
        //  - verified results are shown as evaluated values, because the
        //    schedule has no capacity dropdowns to carry them.
        airflowFollowsTarget: true,
        showsEvaluatedResults: true
    };

    core.register(PRODUCT, HHpro.HeatPumpCapacity);
})();
