/* ============================================================
   HHpro - Who receives Air Handler Design Requests
   ------------------------------------------------------------
   Every submitted request is emailed to everyone in `always`,
   plus the salespeople of any `bySubmitter` rule that matches
   the signed-in person who sent it. Exact emails or '@domain'
   entries, matched ignoring case (same style as firm-access.js).

   Example rule for later - route one customer's requests to
   their salesman:
     { match: ['@abcmechanical.com'], to: ['jane.doe@hoffman-hoffman.com'] }

   Changes take effect on the next deploy (push to GitHub).
   ============================================================ */

export default {
    always: [
        'alex.schwindt@hoffman-hoffman.com'
    ],
    bySubmitter: [
    ]
};
