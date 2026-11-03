/* ============================================================
   HHpro - Who receives emails from the site
   ------------------------------------------------------------
   designRequests: every Air Handler Design Request goes to `always`,
   plus the salespeople of any `bySubmitter` rule that matches the
   signed-in person who sent it. Example rule for later:
     { match: ['@abcmechanical.com'], to: ['jane.doe@hoffman-hoffman.com'] }

   feedback: everyone who gets the Feedback button's bug reports and
   feature requests.

   Exact emails or '@domain' entries, matched ignoring case. On the
   Cloudflare Workers Free plan every address here must be verified
   once under Email Service > Email Routing > Destination addresses.
   Changes take effect on the next deploy (push to GitHub).
   ============================================================ */

import { matches } from './mail.js';

const RECIPIENTS = {
    designRequests: {
        always: [
            'alex.schwindt@hoffman-hoffman.com'
        ],
        bySubmitter: [
        ]
    },
    feedback: [
        'alex.schwindt@hoffman-hoffman.com'
    ]
};

const clean = (list) => [...new Set((list || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean))];

/** Everyone who gets this submitter's design requests. */
export function designRequestRecipients(submitter) {
    const dr = RECIPIENTS.designRequests;
    const out = [...(dr.always || [])];
    (dr.bySubmitter || []).forEach((rule) => { if (matches(submitter, rule.match)) out.push(...(rule.to || [])); });
    return clean(out);
}

export function feedbackRecipients() {
    return clean(RECIPIENTS.feedback);
}
