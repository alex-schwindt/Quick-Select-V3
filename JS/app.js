/* ============================================================
   HHpro - App entry point and router
   ------------------------------------------------------------
   Registers views and decides which one to show on page load.
   Other modules register themselves onto HHpro.Views (keyed by
   name), and any code that wants to navigate just calls
   HHpro.App.showView('viewName').
   ============================================================ */

(function () {
    'use strict';

    window.HHpro = window.HHpro || {};

    function root() {
        return document.getElementById('app-root');
    }

    HHpro.App = {
        showView: function (viewName, params) {
            var view = (HHpro.Views || {})[viewName];
            if (!view || typeof view.render !== 'function') {
                console.error('HHpro.App: unknown view "' + viewName + '"');
                return;
            }
            // Remembered for the Feedback button's page context (feedback.js)
            HHpro.App.current = { view: viewName, params: params || {} };
            view.render(root(), params || {});
        }
    };

    // Sign-in happens before the page ever loads: Cloudflare Access
    // won't serve the site to anyone it hasn't authenticated. So init
    // only has to fetch the engineering-firm layouts this user may use
    // and bring their saved projects in from the server (both fall back
    // quietly when unavailable), then open the overview.
    function init() {
        // The staging copy (STAGING.md) wears a badge so it is never
        // mistaken for the live site.
        if (/^staging\./.test(location.hostname)) {
            var badge = document.createElement('div');
            badge.className = 'env-badge';
            badge.textContent = 'STAGING';
            badge.title = 'Test copy of HHpro - changes here do not affect the live site';
            document.body.appendChild(badge);
        }

        Promise.all([HHpro.Templates.loadFirms(), HHpro.ProjectSync.init()]).then(function (res) {
            // Re-point saved gas pack items if the schedule was regenerated
            // (gas_packs.js) and flag discontinued mini splits
            // (mini_splits.js) - before the cart reads them.
            return HHpro.GasPackDesign.migrateSavedItems()
                .then(function () { return HHpro.MiniSplits.flagDiscontinuedItems(); })
                .then(function () { return res; });
        }).then(function (res) {
            HHpro.State.setAllowedEngineers(['hoffman'].concat(res[0]));
            HHpro.State.setLoggedIn(true);
            HHpro.App.showView('main');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();