#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${1:?}"
UNIT="${2:?}"
cd "$APP_DIR"
export NODE_OPTIONS="${NODE_OPTIONS:-} --dns-result-order=ipv4first --max-old-space-size=512"
# Vite is built in GitHub Actions and rsynced in dist/. This t3.micro (1 GB)
# OOMs if we run `npm run build` here.
if [[ ! -d dist/public ]]; then
  echo "dist/public is missing. CI must build before rsync. Do not run npm run build on this instance."
  exit 1
fi
npm ci --legacy-peer-deps
sudo systemctl daemon-reload
sudo systemctl restart "$UNIT"
sudo systemctl is-active --quiet "$UNIT"
echo "$UNIT is active"
