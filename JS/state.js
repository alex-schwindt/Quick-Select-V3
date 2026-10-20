/* ============================================================
   HHpro - State module
   ------------------------------------------------------------
   Holds all shared application state. Sign-in is handled by
   Cloudflare Access before the page loads, so nothing here is
   persisted: app.js marks the session ready and sets the firm
   layouts on every page load. Saved projects use localStorage
   (see cart.js / projects.js).
   ============================================================ */

(function () {
    'use strict';

    window.HHpro = window.HHpro || {};

    // Every user can see the standard (Hoffman & Hoffman) layout; the
    // server grants additional firm templates per signed-in email.
    var DEFAULT_ALLOWED = ['hoffman'];

    // Cloudflare Access sign-out: clears the Access session and shows
    // its signed-out page.
    var ACCESS_LOGOUT_URL = '/cdn-cgi/access/logout';

    var state = {
        // True once app.js has loaded this user's firm layouts. cart.js
        // waits on it before initialising.
        loggedIn: false,

        // Engineer-template keys this user may use. Always includes
        // 'hoffman' (the standard layout).
        allowedEngineers: DEFAULT_ALLOWED.slice(),

        // Placeholders for later steps. Listed here so the shape of the
        // state object is visible in one place.
        currentProject: null,
        cart: []
    };

    HHpro.State = {
        isLoggedIn: function () {
            return state.loggedIn === true;
        },

        setLoggedIn: function (value) {
            state.loggedIn = !!value;
        },

        /**
         * Engineer-template access for the current user. Returns a copy
         * of the allowed engineer keys (always at least ['hoffman']).
         */
        getAllowedEngineers: function () {
            return state.allowedEngineers.slice();
        },

        setAllowedEngineers: function (list) {
            var arr = Array.isArray(list) && list.length ? list.slice() : DEFAULT_ALLOWED.slice();
            // Standard layout is always available.
            if (arr.indexOf('hoffman') === -1) arr.unshift('hoffman');
            state.allowedEngineers = arr;
        },

        isEngineerAllowed: function (key) {
            return state.allowedEngineers.indexOf(key) !== -1;
        },

        logout: function () {
            window.location.href = ACCESS_LOGOUT_URL;
        }
    };
})();
