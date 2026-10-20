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
    // only has to fetch the engineering-firm layouts this user may use
    // and bring their saved projects in from the server (both fall back
    // quietly when unavailable), then open the overview.
    function init() {
        Promise.all([HHpro.Templates.loadFirms(), HHpro.ProjectSync.init()]).then(function (res) {
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