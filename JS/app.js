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
            view.render(root(), params || {});
        }
    };

    // Sign-in happens before the page ever loads: Cloudflare Access
    // won't serve the site to anyone it hasn't authenticated. So init
    // only has to fetch the engineering-firm layouts this user may use,
    // then open the overview.
    function init() {
        HHpro.Templates.loadFirms().then(function (firms) {
            HHpro.State.setAllowedEngineers(['hoffman'].concat(firms));
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