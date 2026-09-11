#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Grow Together — Update Script
#  Usage: sudo bash scripts/update.sh
#  Run from the repo root AFTER `git pull`.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
log()     { echo -e "${GREEN}[✔]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✘] $1${NC}"; exit 1; }
section() { echo -e "\n${CYAN}━━━  $1  ━━━${NC}"; }

[[ $EUID -eq 0 ]] || error "Run as root: sudo bash scripts/update.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(dirname "$SCRIPT_DIR")"
APP_NAME="growtogether"
DEPLOY_DIR="/opt/$APP_NAME"
CREDS_FILE="/etc/$APP_NAME/credentials.env"

echo -e "${CYAN}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   Grow Together — Update Script       ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Verify install exists
[[ -d "$DEPLOY_DIR" ]] || error "Application not installed. Run install.sh first."
[[ -f "$CREDS_FILE" ]] || error "Credentials not found at $CREDS_FILE. Run install.sh first."

# Load credentials so config values are available
# shellcheck disable=SC1090
source "$CREDS_FILE"

USE_SYSTEMD=false
systemctl --version &>/dev/null 2>&1 && USE_SYSTEMD=true

# ─── Build frontend ───────────────────────────────────────────────────────────
section "Building frontend"
cd "$APP_ROOT/web"
npm ci --silent

# Keep same production env (VITE_API_URL empty = same-origin)
cat > .env.production <<EOF
VITE_API_URL=
VITE_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-REPLACE_WITH_YOUR_GOOGLE_CLIENT_ID}
EOF

npm run build
log "Frontend built → web/dist/"

# ─── Copy to wwwroot ─────────────────────────────────────────────────────────
section "Updating wwwroot"
WWWROOT="$APP_ROOT/backend/src/CombinedStudies.Api/wwwroot"
rm -rf "$WWWROOT"
cp -r "$APP_ROOT/web/dist" "$WWWROOT"
log "Frontend copied to backend wwwroot"

# ─── Publish backend ──────────────────────────────────────────────────────────
section "Publishing backend"
cd "$APP_ROOT/backend"
dotnet publish src/CombinedStudies.Api/CombinedStudies.Api.csproj \
    -c Release \
    -r linux-x64 \
    --self-contained false \
    -o "$DEPLOY_DIR/app" \
    --nologo \
    -v quiet
chown -R "$APP_USER:$APP_USER" "$DEPLOY_DIR"
log "Backend published → $DEPLOY_DIR/app/"

# Ensure symlink to production config is still in place
ln -sf /etc/$APP_NAME/appsettings.Production.json \
    "$DEPLOY_DIR/app/appsettings.Production.json" 2>/dev/null || true

# ─── Restart service ──────────────────────────────────────────────────────────
section "Restarting service"
if $USE_SYSTEMD; then
    systemctl restart "$APP_NAME"
    sleep 3
    if systemctl is-active --quiet "$APP_NAME"; then
        log "Service $APP_NAME restarted successfully"
    else
        error "Service failed to start — check logs: journalctl -u $APP_NAME -n 50"
    fi
else
    # No systemd — kill old process and start new
    if [[ -f /var/run/$APP_NAME.pid ]]; then
        PID=$(cat /var/run/$APP_NAME.pid)
        kill "$PID" 2>/dev/null && log "Stopped old process (PID $PID)" || true
        rm -f /var/run/$APP_NAME.pid
    fi
    sudo -u "$APP_USER" \
        ASPNETCORE_ENVIRONMENT=Production \
        ASPNETCORE_URLS="http://0.0.0.0:${APP_PORT:-5000}" \
        DOTNET_PRINT_TELEMETRY_MESSAGE=false \
        nohup dotnet "$DEPLOY_DIR/app/CombinedStudies.Api.dll" \
            > /var/log/$APP_NAME.log 2>&1 &
    echo $! > /var/run/$APP_NAME.pid
    sleep 4
    log "App restarted (PID: $(cat /var/run/$APP_NAME.pid))"
fi

echo ""
echo -e "${GREEN}━━━  Update complete  ━━━${NC}"
echo ""
if $USE_SYSTEMD; then
    echo -e "  Check status:  ${CYAN}sudo systemctl status $APP_NAME${NC}"
    echo -e "  Live logs:     ${CYAN}sudo journalctl -u $APP_NAME -f${NC}"
else
    echo -e "  Live logs:     ${CYAN}tail -f /var/log/$APP_NAME.log${NC}"
fi
echo ""
