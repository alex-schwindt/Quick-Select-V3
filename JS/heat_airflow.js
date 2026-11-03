/* ============================================================
   HHpro - Entered heating airflow (product.heatAirflow in data.js)
   ------------------------------------------------------------
   SDR single duct VAVs with electric heat: the data carries every kW
   the box could take (up to max airflow / 70), each rated at the least
   heating CFM that kW needs. The engineer types the heating airflow
   they will schedule; this module

     - keeps only the rows that airflow supports
       (row heating CFM <= entered CFM <= row max airflow),
     - swaps the heating airflow cell for the entered value and
       recalculates LAT = EAT + MBH x 1000 / (1.085 x CFM).

   The entered value rides on the cart item as `heatCfm`, so the
   project schedule and every export (Excel / CAD / PDF / engineer
   templates) show the same numbers as the browse page.
   ============================================================ */

window.HHpro = window.HHpro || {};

(function () {
    'use strict';

    var AIR = 1.085;      // sensible heat factor the catalog LAT formula uses

    function configFor(productKey) {
        var p = HHpro.Data && HHpro.Data.getProduct ? HHpro.Data.getProduct(productKey) : null;
        return (p && p.heatAirflow) || null;
    }

    function num(v) {
        var n = parseFloat(v);
        return isFinite(n) ? n : null;
    }

    /** Row is one the entered airflow applies to (appliesWhen columns match). */
    function applies(cfg, sd) {
        if (!cfg || !sd) return false;
        var when = cfg.appliesWhen || {};
        return Object.keys(when).every(function (col) {
            return String(sd[col]).toUpperCase() === String(when[col]).toUpperCase();
        });
    }

    /** The entered CFM is at or above the row's own heating CFM and within its max airflow. */
    function fits(cfg, sd, cfm) {
        var need = num(sd[cfg.airflowColumn]);
        var max = num(sd[cfg.maxColumn]);
        return need !== null && max !== null && need <= cfm && cfm <= max;
    }

    /** Column letter -> value for one row at the entered CFM; {} when N/A. */
    function overrides(cfg, sd, cfm) {
        if (!cfm || !applies(cfg, sd)) return {};
        var out = {};
        out[cfg.airflowColumn] = cfm;
        var eat = num(sd[cfg.eatColumn]);
        var mbh = num(sd[cfg.capacityColumn]);
        if (eat !== null && mbh !== null) {
            out[cfg.latColumn] = Math.round((eat + mbh * 1000 / (AIR * cfm)) * 10) / 10;
        }
        return out;
    }

    function sdOf(sel) {
        return (sel && sel.rows && sel.rows[0] && sel.rows[0].scheduleData) || {};
    }

    HHpro.HeatAirflow = {
        configFor: configFor,
        applies: applies,

        /** The input box shows only while every showWhen filter is set to its value. */
        isShown: function (cfg, filterValues) {
            if (!cfg) return false;
            var when = cfg.showWhen || {};
            return Object.keys(when).every(function (name) {
                return filterValues[name] !== null && filterValues[name] !== undefined &&
                       String(filterValues[name]) === String(when[name]);
            });
        },

        /** Drop the applicable rows the entered CFM can't serve; other rows pass through. */
        filterSelections: function (cfg, selections, cfm) {
            if (!cfg || !cfm) return selections;
            return selections.filter(function (sel) {
                var sd = sdOf(sel);
                return !applies(cfg, sd) || fits(cfg, sd, cfm);
            });
        },

        /** Variant list for a saved item: only the kW sizes its heatCfm supports. */
        fitsSelection: function (cfg, sel, cfm) {
            var sd = sdOf(sel);
            return !cfm || !applies(cfg, sd) || fits(cfg, sd, cfm);
        },

        overrides: overrides,

        /** Overrides for a cart item (project schedule, exports); {} when not applicable. */
        overridesForItem: function (item, scheduleData) {
            if (!item || !item.heatCfm) return {};
            return overrides(configFor(item.productKey), scheduleData || {}, num(item.heatCfm));
        }
    };
})();
