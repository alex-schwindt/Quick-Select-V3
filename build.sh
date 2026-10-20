#!/usr/bin/env bash
# Cloudflare Workers Builds build command (`bash build.sh`); wrangler.jsonc
# then deploys dist/ as the Worker's static assets.
#
# Copies ONLY the files the site serves into dist/. Everything else in
# the repo - the Excel source workbooks, DATA/ENGINEER SCHEDULES, the
# Python converters, server/ - never reaches the web. When the site
# starts loading a new folder, add it here or it will 404 when deployed.
set -euo pipefail

rm -rf dist
mkdir -p dist/DATA dist/ASSETS

cp index.html dist/
cp -R CSS JS firms dist/
cp -R DATA/JSON DATA/PICTURES dist/DATA/
cp -R ASSETS/FONTS dist/ASSETS/
cp ASSETS/favicon.svg dist/ASSETS/

# Served for missing paths with a real 404 (wrangler.jsonc
# not_found_handling), so a broken file link fails visibly rather than
# silently loading the homepage.
cat > dist/404.html <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Not found - HHpro</title></head>
<body style="font-family: system-ui, sans-serif; padding: 2rem;">
<p>That page or file doesn't exist. <a href="/">Back to HHpro</a></p>
</body>
</html>
HTML

echo "Built dist/: $(find dist -type f | wc -l) files"
