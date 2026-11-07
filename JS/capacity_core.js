/* ============================================================
   HHpro - Capacity table core (HHpro.CapacityCore)
   ------------------------------------------------------------
   Product-neutral math shared by every capacity-table feature:
   Multi Position Splits (capacity.js) and Gas Pack RTUs
   (gas_pack_capacity.js) today.

   Both products' JSON stores a cooling table in the same shape,
   which is what lets one lookup serve both:

     table.axes    = { eatDb:[...], eatWb:[...], oaCooling:[...], airflow:[...] }
     table.cooling = { "<eatDb>|<eatWb>|<oaCooling>|<airflow>":
                       [total BTU/h, sensible BTU/h, LAT degF], ... }

   Only RATED points are stored - a combination the spec sheet
   printed "-" (or misprinted, and so was left blank) is absent,
   never guessed at.

   THE OFF-GRID POLICY, in one place so both products agree:
   where a design condition lands between rated points, the
   reported point is the WORST-CASE bracketing rated point.
     - Outdoor ambient rounds UP: a hotter condenser always
       lowers capacity.
     - Entering air (DB/WB) can't simply round one way. On a DX
       coil a higher entering WB raises total capacity, and at a
       given WB a higher entering DB raises sensible capacity -
       but a LOWER WB raises sensible. So every bracketing DB/WB
       corner is looked up and the one where the unit looks
       weakest against the targets is reported (see worstCorner).
   Nothing is ever interpolated and nothing outside the table's
   range is extrapolated; out-of-range inputs come back flagged
   instead. The reported row is always a real rated row, so it
   matches the schedule and the capacity dropdowns.
   ============================================================ */

(function () {
    'use strict';
    window.HHpro = window.HHpro || {};

    // Key fragment for a numeric axis value: 70.0 -> "70", matching the
    // keys convert_to_json.py writes.
    function numStr(v) {
        var n = Number(v);
        return isFinite(n) ? String(n) : String(v);
    }

    // Capacity cell -> number. Some heat-pump tables hold text like
    // "15900 (standard), 22500 (boost)"; the leading number is the
    // standard, non-boost rating and the conservative pick for search math.
    function capNum(v) {
        if (v == null) return NaN;
        return parseFloat(String(v).replace(/,/g, ''));
    }

    // Bracketing rated points for x on an axis. One of:
    //   { exact: x } | { lo, hi } | { outOfRange: true, min, max } | null
    function bracketOn(axis, x) {
        var vals = (axis || []).map(Number).filter(isFinite)
            .sort(function (a, b) { return a - b; });
        if (!vals.length || !isFinite(x)) return null;
        if (x < vals[0] || x > vals[vals.length - 1]) {
            return { outOfRange: true, min: vals[0], max: vals[vals.length - 1] };
        }
        var lo = null;
        for (var i = 0; i < vals.length; i++) {
            if (vals[i] === x) return { exact: x };
            if (vals[i] < x) lo = vals[i];
            else return { lo: lo, hi: vals[i] };
        }
        return null;
    }

    // The harsher end of a bracket for an axis where higher is always
    // tougher (outdoor ambient; see the policy note above).
    function harsher(b) { return (b.exact != null) ? b.exact : b.hi; }

    // Both rated ends of a bracket (one value when the input is exact).
    function ends(b) { return (b.exact != null) ? [b.exact] : [b.lo, b.hi]; }

    // How strong a corner looks against the targets: the smaller of
    // total/target and sensible/target. With no target for a metric, the
    // corner's value relative to the best corner stands in, so the
    // weakest corner still wins.
    function strength(c, targets, best) {
        var t = (targets && targets.total > 0) ? targets.total : best.total;
        var s = (targets && targets.sensible > 0) ? targets.sensible : best.sensible;
        var rt = t > 0 ? c.total / t : Infinity;
        var rs = s > 0 ? c.sensible / s : Infinity;
        return Math.min(rt, rs);
    }

    // The weakest rated DB/WB corner at one ambient + airflow, or null when
    // none of the bracketing corners is rated. Corners missing from the
    // table are physically impossible combinations (WB above DB) or
    // unpublished points and are skipped, never guessed at.
    function worstCorner(table, dbs, wbs, oa, cfm, targets) {
        var corners = [];
        dbs.forEach(function (db) {
            wbs.forEach(function (wb) {
                var r = table.cooling[[db, wb, oa, cfm].map(numStr).join('|')];
                if (!r || !isFinite(capNum(r[0]))) return;
                corners.push({
                    eatDb: db, eatWb: wb, oaCooling: oa, airflow: cfm,
                    total: capNum(r[0]), sensible: capNum(r[1]), lat: r[2]
                });
            });
        });
        if (!corners.length) return null;
        var best = {
            total: Math.max.apply(null, corners.map(function (c) { return c.total; })),
            sensible: Math.max.apply(null, corners.map(function (c) { return c.sensible; }))
        };
        var worst = null, worstS = Infinity;
        corners.forEach(function (c) {
            var s = strength(c, targets, best);
            if (s < worstS) { worst = c; worstS = s; }
        });
        return worst;
    }

    /**
     * Cooling performance at design conditions.
     *
     * table   - { axes, cooling } as described at the top of this file.
     * cond    - { oa, eatDb, eatWb } design conditions (degF).
     * targets - { total, sensible } BTU/h; either may be null. They steer
     *           which rated airflow is chosen: the CFM whose worst-case
     *           corner best matches the targets wins, ties going to the
     *           higher capacity (so with no targets the max-capacity
     *           airflow is reported).
     * opts    - { airflows } to restrict the airflows considered (the Gas
     *           Pack search narrows to the CFM the engineer typed).
     *
     * Returns one of:
     *   { applicable:false }
     *   { applicable:true, outOfRange:true, ranges:{axis:{min,max}} }
     *   { applicable:true, noData:true, offGrid }
     *   { applicable:true, offGrid, result:{eatDb,eatWb,oaCooling,airflow,
     *                                       total,sensible,lat} }
     */
    function coolingAt(table, cond, targets, opts) {
        if (!table || !table.cooling) return { applicable: false };
        var axes = table.axes || {};
        var br = {
            eatDb: bracketOn(axes.eatDb, cond.eatDb),
            eatWb: bracketOn(axes.eatWb, cond.eatWb),
            oaCooling: bracketOn(axes.oaCooling, cond.oa)
        };
        if (!br.eatDb || !br.eatWb || !br.oaCooling) return { applicable: false };

        var ranges = {};
        var out = false;
        ['eatDb', 'eatWb', 'oaCooling'].forEach(function (f) {
            if (br[f].outOfRange) { out = true; ranges[f] = br[f]; }
        });
        if (out) return { applicable: true, outOfRange: true, ranges: ranges };

        var dbs = ends(br.eatDb), wbs = ends(br.eatWb), oa = harsher(br.oaCooling);
        var offGrid = {};
        ['eatDb', 'eatWb', 'oaCooling'].forEach(function (f) {
            if (br[f].exact == null) offGrid[f] = { lo: br[f].lo, hi: br[f].hi };
        });

        var pool = (opts && opts.airflows) || axes.airflow || [];
        var best = null;
        pool.map(Number).forEach(function (cfm) {
            // Sparse tables: an airflow with no rated bracketing corner
            // is skipped.
            var c = worstCorner(table, dbs, wbs, oa, cfm, targets);
            if (!c) return;
            var dev = 0;
            if (targets && targets.total > 0) {
                dev += Math.abs(c.total - targets.total) / targets.total;
            }
            if (targets && targets.sensible > 0) {
                dev += Math.abs(c.sensible - targets.sensible) / targets.sensible;
            }
            if (!best || dev < best.dev ||
                (dev === best.dev && c.total > best.result.total)) {
                best = { result: c, dev: dev };
            }
        });
        if (!best) return { applicable: true, noData: true, offGrid: offGrid };
        return { applicable: true, offGrid: offGrid, result: best.result };
    }

    // Provider registry. Each capacity-table module registers itself under
    // the productKey it serves, so Design Search can ask "is this product
    // condition-aware?" without naming the modules. Adding a third product
    // means adding a file, not editing the search page.
    var providers = {};

    HHpro.CapacityCore = {
        numStr: numStr,
        capNum: capNum,
        bracketOn: bracketOn,
        harsher: harsher,
        coolingAt: coolingAt,

        register: function (productKey, provider) { providers[productKey] = provider; },
        providerFor: function (productKey) { return providers[productKey] || null; },
        /** The provider for this product, but only once its tables are
         *  actually loaded and non-empty. */
        activeProviderFor: function (productKey) {
            var p = providers[productKey];
            return (p && p.hasTables && p.hasTables()) ? p : null;
        },
        /** Resolve every registered product's tables that apply here. */
        ensureFor: function (productKey) {
            var p = providers[productKey];
            return p && p.ensureFor ? p.ensureFor(productKey) : Promise.resolve(null);
        }
    };
})();
