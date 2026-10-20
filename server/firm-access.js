/* ============================================================
   HHpro - Who may use which engineering firm's schedule layouts
   ------------------------------------------------------------
   Two layers decide access:
     1. Cloudflare Access (dashboard) decides who can open the site
        at all. Anyone listed below must ALSO be allowed there.
     2. This file decides which firm layouts each signed-in person
        gets. Everyone gets the standard Hoffman & Hoffman layout.

   Entries are either a whole domain ('@example.com') or one exact
   email address ('jane.doe@example.com'). Matching ignores case.
   Changes take effect on the next deploy (push to GitHub).

   Adding a firm: add its key here AND create firms/<key>/templates.js.
   ============================================================ */

export default {
    // Gets every firm's layouts.
    allFirms: [
        '@hoffman-hoffman.com'
    ],

    // H&H staff: can see internal-only sections (e.g. Stocked Chillers -
    // H&H inventory). Same entry format as below.
    internal: [
        '@hoffman-hoffman.com'
    ],

    // firm key -> people/domains allowed that firm's layouts.
    // TODO: fill in each firm's email domain or individual addresses.
    firms: {
        refresco: [],
        barrett_woodyard: [],
        allied: [],
        saber: [],
        mswg: []
    }
};
