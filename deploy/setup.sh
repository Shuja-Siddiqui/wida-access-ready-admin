#!/usr/bin/env bash
set -euo pipefail

# goelprep.admin  3.225.112.97  t3.micro — 2G swap so npm build fits in 1 GB RAM
if [[ ! -f /swapfile ]]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo apt-get update -y
sudo apt-get install -y rsync
sudo mkdir -p /opt/admin
sudo chown -R ubuntu:ubuntu /opt/admin

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
sudo cp "$SCRIPT_DIR/admin.service" /etc/systemd/system/admin.service
sudo systemctl daemon-reload
sudo systemctl enable admin

echo "Create /opt/admin/.env from .env.example."
echo "  PORT=3001"
echo "  BASE_PATH=/"
echo "  INTERNAL_PROXY_BASE_URL=https://api.goelprep.com"
echo "Then allow CI to restart the unit (same pattern as the student app):"
echo "echo 'ubuntu ALL=NOPASSWD: /usr/bin/systemctl daemon-reload, /usr/bin/systemctl restart admin, /usr/bin/systemctl is-active admin' | sudo tee /etc/sudoers.d/admin-deploy"
