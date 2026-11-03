# Staging (test) site

The live site (quickselect.hhtrecho.com) deploys from the `master` branch. A separate
staging copy at **staging.hhtrecho.com** deploys from the `staging` branch, so changes
can be tried before customers see them.

| | Live | Staging |
|---|---|---|
| Branch | `master` | `staging` |
| Worker | `quick-select-v3` | `quick-select-v3-staging` |
| Address | quickselect.hhtrecho.com | staging.hhtrecho.com (no workers.dev address) |
| Sign-in | Access app for the live site (H&H + beta customers) | Its own Access app (H&H staff only) |
| Saved projects | D1 `hhpro-projects` | D1 `hhpro-projects-staging` |
| Documents (manuals, Revit ...) | R2 `hhpro-assets` | same bucket |
| Request / feedback uploads | `REQUESTS/`, `FEEDBACK/` | `STAGING/REQUESTS/`, `STAGING/FEEDBACK/` |
| Emails | normal subject | subject starts with `[STAGING]` |

Settings live in `wrangler.jsonc` (top level = live, `env.staging` = staging).

## Day-to-day

1. Work on the `staging` branch: `git switch staging`
2. Before pushing, run the checks: `node tests/smoke.js`
3. Push `staging` - Workers Builds deploys it to staging.hhtrecho.com (orange STAGING badge at the bottom of the page).
4. Try it there. When it's right, promote it to the live site:
   ```
   git switch master
   git merge staging
   git push
   ```
5. `git switch staging` to keep working.

Data workbooks and converted JSON go through the same branches, so a new or rebuilt
section can be checked on staging first too. Staging has its own projects database:
projects saved on the live site don't appear there, and nothing saved on staging touches
the live one.

## One-time setup (Cloudflare dashboard)

Do these in order - the Access app must exist before the first deploy, otherwise
staging.hhtrecho.com would briefly be reachable without signing in.

1. **Access app** - Zero Trust > Access > Applications > Add an application >
   Self-hosted. Domain `staging.hhtrecho.com`. Policy: Allow, emails ending in
   `@hoffman-hoffman.com` (H&H staff only). Save, then copy the app's
   **Application Audience (AUD) Tag** into `wrangler.jsonc` > `env.staging.vars.ACCESS_AUD`.
2. **First deploy** (from this folder, one command per line in PowerShell):
   ```
   bash build.sh
   npx wrangler deploy --env staging
   ```
   This creates the `quick-select-v3-staging` Worker and the staging.hhtrecho.com
   address. Commit and push the AUD change to `master`.
3. **Live Worker builds** - Workers & Pages > quick-select-v3 > Settings > Build: keep the
   production branch `master` and turn off builds for non-production branches, so pushes to
   `staging` don't create preview versions of the live site. Do this before step 4.
4. **Branch** - create it once from an up-to-date `master`:
   ```
   git switch master
   git pull
   git switch -c staging
   git push -u origin staging
   ```
5. **Automatic builds** - Workers & Pages > quick-select-v3-staging > Settings > Build >
   Connect the same GitHub repository:
   - Branch: `staging`
   - Build command: `bash build.sh`
   - Deploy command: `npx wrangler deploy --env staging`
   - Turn off builds for non-production branches.

Design-request and feedback emails from staging go to the same recipients
(server/recipients.js), marked `[STAGING]`.
