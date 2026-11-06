/* ============================================================
   HHpro - MULTI POSITION SPLITS product extension
   ------------------------------------------------------------
   Uses default single-row schedule rendering from base.js.
   ============================================================ */

(function () {
    'use strict';
    window.HHpro = window.HHpro || {};
    HHpro.ProductExtensions = HHpro.ProductExtensions || {};

    HHpro.ProductExtensions.multi_position_splits = {
        // Column P ("TEMPERATURE RISE (DB)") values can carry float
        // precision -- show them rounded to 2 decimals for readability.
        formatScheduleCellValue: function (colLetter, value) {
            if (colLetter === 'P' && typeof value === 'number') {
                return Number(value.toFixed(2)).toString();
            }
            return undefined;
        }
    };
})();
