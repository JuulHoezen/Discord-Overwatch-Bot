#!/usr/bin/env bash
#
# Zet de Overwatch-bot als systeemdienst op een Debian- of Ubuntu-server.
#
# Op de server, vanuit de map waar je dit project hebt neergezet:
#     sudo bash deploy/install.sh
#
# Wat het doet:
#   1. Node.js 22 installeren als dat er nog niet staat (NodeSource)
#   2. systeemgebruiker 'owbot' aanmaken
#   3. dit project naar /opt/overwatch kopiëren (zonder node_modules, .git, .env)
#   4. productie-afhankelijkheden installeren (npm ci --omit=dev)
#   5. .env aanmaken met beperkte rechten als die nog niet bestaat
#   6. systemd-dienst installeren en starten + wekelijkse sync-cron
#
# Aanpasbaar met omgevingsvariabelen, bijvoorbeeld:
#     sudo APP_DIR=/srv/overwatch SYNC_CRON="30 3 * * 1" bash deploy/install.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/overwatch}"
SERVICE_USER="${SERVICE_USER:-owbot}"
SYNC_CRON="${SYNC_CRON:-0 4 * * 0}" # zondag 04:00
NODE_MAJOR_MIN="${NODE_MAJOR_MIN:-20}"

if [ "${EUID}" -ne 0 ]; then
  echo "Draai dit script met sudo (het schrijft naar /etc en /opt)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "== 1/6 Node.js controleren"
if command -v node >/dev/null 2>&1; then
  major="$(node -v | sed 's/^v//' | cut -d. -f1)"
else
  major=0
fi
if [ "${major}" -lt "${NODE_MAJOR_MIN}" ]; then
  echo "   Node ${NODE_MAJOR_MIN}+ nodig, installeren via NodeSource"
  curl -fsSL "https://deb.nodesource.com/setup_22.x" | bash -
  apt-get install -y nodejs
else
  echo "   node $(node -v) is goed genoeg"
fi
NODE_BIN="$(command -v node)"

echo "== 2/6 gebruiker ${SERVICE_USER}"
if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
  useradd --system --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${SERVICE_USER}"
  echo "   aangemaakt"
else
  echo "   bestaat al"
fi

echo "== 3/6 bestanden naar ${APP_DIR}"
mkdir -p "${APP_DIR}"
if [ "${SRC_DIR}" = "${APP_DIR}" ]; then
  echo "   je draait dit script al in ${APP_DIR} (bijvoorbeeld na een git clone); kopiëren overgeslagen"
else
  tar -C "${SRC_DIR}" \
    --exclude=./node_modules --exclude=./.git --exclude=./.env \
    -cf - . | tar -C "${APP_DIR}" -xf -
  echo "   gekopieerd"
fi

echo "== 4/6 afhankelijkheden installeren (alleen productie)"
cd "${APP_DIR}"
npm ci --omit=dev --no-audit --no-fund

echo "== 5/6 .env"
if [ ! -f "${APP_DIR}/.env" ]; then
  cp "${APP_DIR}/.env.sample" "${APP_DIR}/.env"
  echo "   LET OP: ${APP_DIR}/.env is nieuw en bevat nog placeholders."
  echo "   Vul APP_ID en DISCORD_TOKEN in en start de dienst opnieuw."
fi
chmod 600 "${APP_DIR}/.env"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${APP_DIR}"

echo "== 6/6 systemd-dienst en wekelijkse sync"
install -m 644 "${SCRIPT_DIR}/overwatch-bot.service" /etc/systemd/system/overwatch-bot.service
sed -i "s#/opt/overwatch#${APP_DIR}#g; s#User=owbot#User=${SERVICE_USER}#g; s#Group=owbot#Group=${SERVICE_USER}#g; s#ExecStart=/usr/bin/node#ExecStart=${NODE_BIN}#g" \
  /etc/systemd/system/overwatch-bot.service

cat > /etc/cron.d/overwatch-sync <<EOF
# Wekelijkse verversing van de seizoensdata (bot/lib/sync.js)
SHELL=/bin/sh
${SYNC_CRON} ${SERVICE_USER} cd ${APP_DIR} && ${NODE_BIN} bot/lib/sync.js >> /var/log/overwatch-sync.log 2>&1
EOF
chmod 644 /etc/cron.d/overwatch-sync

systemctl daemon-reload
systemctl enable --now overwatch-bot.service

sleep 3
echo
echo "== status"
systemctl --no-pager --full status overwatch-bot.service || true
echo
echo "Klaar. Nuttige commando's:"
echo "  systemctl restart overwatch-bot      # herstarten"
echo "  journalctl -u overwatch-bot -f       # live logs"
echo "  sudo -u ${SERVICE_USER} ${NODE_BIN} ${APP_DIR}/bot/lib/sync.js   # seizoensdata verversen"
