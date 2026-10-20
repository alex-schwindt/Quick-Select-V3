/* ============================================================
   HHpro - Cloudflare Access identity check (used by worker/index.js)
   ------------------------------------------------------------
   Every request that reaches the site has passed Cloudflare Access,
   which attaches a signed token (JWT) naming the signed-in user.
   We verify that signature against the team's public keys rather
   than trusting the header, so a request that somehow skipped
   Access (e.g. an unprotected preview URL) gets nothing.

   Required variables (set in wrangler.jsonc "vars"):
     ACCESS_TEAM_DOMAIN  e.g. hoffman.cloudflareaccess.com
     ACCESS_AUD          the Access application's "Application
                         Audience (AUD) Tag"
   If either is missing, every check fails closed (standard layout
   only).

   Local development only: DEV_ACCESS_EMAIL in .dev.vars (never in
   wrangler.jsonc or the dashboard) skips verification and acts as
   that user under `bash build.sh && npx wrangler dev`.
   ============================================================ */

import FIRM_ACCESS from './firm-access.js';

const CERT_TTL_MS = 60 * 60 * 1000;
let certCache = { team: '', keys: [], fetchedAt: 0 };

function b64urlBytes(str) {
    let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function b64urlJson(str) {
    return JSON.parse(new TextDecoder().decode(b64urlBytes(str)));
}

function readCookie(request, name) {
    const header = request.headers.get('Cookie') || '';
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq > -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
    }
    return null;
}

async function signingKey(team, kid) {
    const fresh = certCache.team === team && Date.now() - certCache.fetchedAt < CERT_TTL_MS;
    let jwk = fresh ? certCache.keys.find((k) => k.kid === kid) : null;
    if (!jwk) {
        // Unknown kid on a fresh cache usually means Access rotated keys.
        const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
        if (!res.ok) return null;
        const body = await res.json();
        certCache = { team, keys: Array.isArray(body.keys) ? body.keys : [], fetchedAt: Date.now() };
        jwk = certCache.keys.find((k) => k.kid === kid);
    }
    if (!jwk || jwk.kty !== 'RSA') return null;
    return crypto.subtle.importKey(
        'jwk',
        { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
    );
}

/**
 * The verified, lower-cased email of the signed-in user, or null.
 */
export async function accessEmail(request, env) {
    if (env.DEV_ACCESS_EMAIL) return String(env.DEV_ACCESS_EMAIL).toLowerCase();

    const team = String(env.ACCESS_TEAM_DOMAIN || '')
        .replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const aud = env.ACCESS_AUD;
    if (!team || !aud) return null;

    const token = request.headers.get('Cf-Access-Jwt-Assertion') || readCookie(request, 'CF_Authorization');
    const parts = token ? token.split('.') : [];
    if (parts.length !== 3) return null;

    try {
        const header = b64urlJson(parts[0]);
        const payload = b64urlJson(parts[1]);
        if (header.alg !== 'RS256') return null;

        const key = await signingKey(team, header.kid);
        if (!key) return null;
        const valid = await crypto.subtle.verify(
            'RSASSA-PKCS1-v1_5',
            key,
            b64urlBytes(parts[2]),
            new TextEncoder().encode(parts[0] + '.' + parts[1])
        );
        if (!valid) return null;

        const now = Math.floor(Date.now() / 1000);
        const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        if (payload.iss !== `https://${team}`) return null;
        if (!auds.includes(aud)) return null;
        if (typeof payload.exp !== 'number' || payload.exp < now) return null;
        if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null;

        return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    } catch (err) {
        return null;
    }
}

function matches(email, entries) {
    return (entries || []).some((entry) => {
        const e = String(entry).trim().toLowerCase();
        if (!e) return false;
        return e.startsWith('@') ? email.endsWith(e) : email === e;
    });
}

/**
 * Firm keys this email may use (never includes 'hoffman', which
 * everyone gets client-side).
 */
export function firmsFor(email) {
    if (!email) return [];
    const all = Object.keys(FIRM_ACCESS.firms || {});
    if (matches(email, FIRM_ACCESS.allFirms)) return all;
    return all.filter((key) => matches(email, FIRM_ACCESS.firms[key]));
}
