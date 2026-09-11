#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Grow Together — Delete / Uninstall Script
#  Usage: sudo bash scripts/delete.sh [--keep-data]
#  --keep-data  removes services and binaries but keeps the database & minio data
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'
log()     { echo -e "${GREEN}[✔]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
section() { echo -e "\n${CYAN}━━━  $1  ━━━${NC}"; }

[[ $EUID -eq 0 ]] || { echo -e "${RED}[✘] Run as root: sudo bash scripts/delete.sh${NC}"; exit 1; }

KEEP_DATA=false
for arg in "$@"; do [[ "$arg" == "--keep-data" ]] && KEEP_DATA=true; done

APP_NAME="growtogether"
DEPLOY_DIR="/opt/$APP_NAME"
CONFIG_DIR="/etc/$APP_NAME"
CREDS_FILE="$CONFIG_DIR/credentials.env"
MINIO_BIN="/opt/minio/minio"
MINIO_MC="/opt/minio/mc"
MINIO_DATA="/var/lib/minio"
APP_USER="growtogether"
DB_NAME="combinedstudies"
DB_USER="cs_user"

USE_SYSTEMD=false
systemctl --version &>/dev/null 2>&1 && USE_SYSTEMD=true

echo -e "${RED}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   Grow Together — Delete Script       ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

if [[ "$KEEP_DATA" == false ]]; then
    warn "This will REMOVE all services, binaries, config, AND data (DB + MinIO)."
else
    warn "This will remove services and binaries but KEEP database and MinIO data."
fi
read -rp "Are you sure? Type YES to confirm: " CONFIRM
[[ "$CONFIRM" == "YES" ]] || { echo "Aborted."; exit 0; }

section "Stopping and removing services"

if $USE_SYSTEMD; then
    for svc in "$APP_NAME" minio; do
        if systemctl is-active --quiet "$svc" 2>/dev/null; then
            systemctl stop "$svc" && log "Stopped $svc"
        fi
        if systemctl is-enabled --quiet "$svc" 2>/dev/null; then
            systemctl disable "$svc" && log "Disabled $svc"
        fi
        if [[ -f "/etc/systemd/system/$svc.service" ]]; then
            rm -f "/etc/systemd/system/$svc.service"
            log "Removed /etc/systemd/system/$svc.service"
        fi
    done
    systemctl daemon-reload
else
    # kill by PID file
    for pidfile in /var/run/$APP_NAME.pid /var/run/minio.pid; do
        if [[ -f "$pidfile" ]]; then
            PID=$(cat "$pidfile")
            kill "$PID" 2>/dev/null && log "Killed PID $PID"
            rm -f "$pidfile"
        fi
    done
fi

section "Removing application binaries"
if [[ -d "$DEPLOY_DIR" ]]; then
    rm -rf "$DEPLOY_DIR"
    log "Removed $DEPLOY_DIR"
fi

section "Removing config"
if [[ -d "$CONFIG_DIR" ]]; then
    rm -rf "$CONFIG_DIR"
    log "Removed $CONFIG_DIR"
fi

section "Removing MinIO (Docker)"
docker rm -f minio 2>/dev/null || true
docker rmi quay.io/minio/minio:latest 2>/dev/null || true
rm -f /opt/minio/start-minio.sh
rmdir /opt/minio 2>/dev/null || true
log "Removed MinIO Docker container and image"

if [[ "$KEEP_DATA" == false ]]; then
    section "Dropping database"
    DB_PORT="5433"
    [[ -f "$CREDS_FILE" ]] && { source "$CREDS_FILE" 2>/dev/null || true; }

    if command -v psql &>/dev/null; then
        sudo -u postgres psql -p "$DB_PORT" \
            -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null && log "Dropped DB $DB_NAME" || warn "Could not drop DB (may not exist)"
        sudo -u postgres psql -p "$DB_PORT" \
            -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null && log "Dropped DB user $DB_USER" || true
    else
        warn "psql not found — skipping DB removal"
    fi

    section "Removing MinIO data"
    if [[ -d "$MINIO_DATA" ]]; then
        rm -rf "$MINIO_DATA"
        log "Removed $MINIO_DATA"
    fi
fi

section "Removing system user"
if id "$APP_USER" &>/dev/null; then
    userdel "$APP_USER" 2>/dev/null && log "Removed system user $APP_USER" || warn "Could not remove user $APP_USER"
fi

section "Removing log files"
rm -f /var/log/$APP_NAME.log /var/log/minio.log

echo ""
echo -e "${GREEN}━━━  Grow Together removed successfully  ━━━${NC}"
if [[ "$KEEP_DATA" == true ]]; then
    echo -e "${YELLOW}Database and MinIO data preserved.${NC}"
fi
echo ""
