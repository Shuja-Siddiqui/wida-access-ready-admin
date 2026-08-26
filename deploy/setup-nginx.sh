#!/usr/bin/env bash
# Run on goelprep.admin after DNS for admin.goelprep.com, and after API has HTTPS.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EMAIL="${CERTBOT_EMAIL:-admin@zentu.io}"

sudo apt-get update -y
sudo apt-get install -y nginx certbot python3-certbot-nginx

sudo cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-available/admin
sudo ln -sfn /etc/nginx/sites-available/admin /etc/nginx/sites-enabled/admin
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

sudo certbot --nginx -d admin.goelprep.com --non-interactive --agree-tos -m "$EMAIL" --redirect

echo "Admin is https://admin.goelprep.com"
echo "Set INTERNAL_PROXY_BASE_URL=https://api.goelprep.com in /opt/admin/.env then: sudo systemctl restart admin"
