#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Grow Together — Complete Ubuntu Setup Script
#
#  Smart behaviour:
#   • Detects existing PostgreSQL → reuses it (no port change, no reinstall)
#   • Detects port conflicts      → picks next free port
#   • Detects existing nginx      → adds a new server block (with SSL)
#   • Asks for domain, Google Client ID, Let's Encrypt interactively
#
#  Usage:  sudo bash scripts/install.sh
#  Run from the repo root after git clone.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; CYAN='\033[0;36m'; NC='\033[0m'
step()    { echo -e "\n${GREEN}${BOLD}━━━  STEP $1  ━━━${NC}"; }
info()    { echo -e "  ${BLUE}→ $1${NC}"; }
ok()      { echo -e "  ${GREEN}✓ $1${NC}"; }
warn()    { echo -e "  ${YELLOW}⚠ $1${NC}"; }
die()     { echo -e "\n${RED}${BOLD}ERROR: $1${NC}" >&2; exit 1; }

# ── Must run as root ──────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Run as root:  sudo bash scripts/install.sh"

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(dirname "$SCRIPT_DIR")"
APP_NAME="growtogether"
DEPLOY_DIR="/opt/$APP_NAME"
CONFIG_DIR="/etc/$APP_NAME"
CREDS_FILE="$CONFIG_DIR/credentials.env"
CRED_SUMMARY="/root/$APP_NAME-credentials.txt"
NGINX_CONF="growtogether"
SSL_DIR="/etc/ssl/$APP_NAME"

# ── Fixed names ────────────────────────────────────────────────────────────────
DB_NAME="combinedstudies"
DB_USER="cs_user"
MINIO_BIN="/opt/minio/minio"
MINIO_MC="/opt/minio/mc"
MINIO_DATA="/var/lib/minio"
MINIO_PORT="9000"
MINIO_CONSOLE_PORT="9001"
MINIO_BUCKET="combinedstudies"
APP_USER="growtogether"

# ════════════════════════════════════════════════════════════════════════════
#  PHASE 0 — Auto-detect environment & interactive prompts
# ════════════════════════════════════════════════════════════════════════════

# ── Public IP ─────────────────────────────────────────────────────────────────
PUBLIC_IP="$(curl -s --max-time 5 https://checkip.amazonaws.com 2>/dev/null \
    || curl -s --max-time 5 https://ifconfig.me 2>/dev/null \
    || hostname -I | awk '{print $1}')"

echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║      Grow Together — Automated Ubuntu Setup        ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════════════════╝${NC}"
echo -e "  Server IP  : ${BOLD}${PUBLIC_IP}${NC}"
echo ""

# ── Detect systemd ────────────────────────────────────────────────────────────
USE_SYSTEMD=false
systemctl --version &>/dev/null 2>&1 && USE_SYSTEMD=true

# ── Detect existing PostgreSQL ────────────────────────────────────────────────
PG_ALREADY_INSTALLED=false
DB_PORT="5433"        # default for fresh install

if command -v psql &>/dev/null; then
    PG_ALREADY_INSTALLED=true
    # Find the port the running instance is listening on
    DETECTED_PORT="$(sudo -u postgres psql -tAc 'SHOW port' 2>/dev/null | tr -d ' \n' || echo '')"
    if [[ -n "$DETECTED_PORT" ]]; then
        DB_PORT="$DETECTED_PORT"
    else
        # PostgreSQL installed but not running yet — read from config
        PG_CONF="$(find /etc/postgresql -name "postgresql.conf" 2>/dev/null | head -1)"
        if [[ -n "$PG_CONF" ]]; then
            CONF_PORT="$(grep -E '^port\s*=' "$PG_CONF" 2>/dev/null | awk -F'=' '{print $2}' | tr -d ' ' || echo '')"
            [[ -n "$CONF_PORT" ]] && DB_PORT="$CONF_PORT"
        fi
    fi
    warn "Existing PostgreSQL detected on port $DB_PORT — will create database in existing instance."
fi

# ── Detect port conflicts for the app ─────────────────────────────────────────
DESIRED_PORT=5000
APP_PORT="$DESIRED_PORT"
if ss -tlnp 2>/dev/null | grep -q ":${DESIRED_PORT} "; then
    APP_PORT=5001
    # Keep incrementing until we find a free port
    while ss -tlnp 2>/dev/null | grep -q ":${APP_PORT} "; do
        APP_PORT=$((APP_PORT + 1))
    done
    warn "Port $DESIRED_PORT is in use (existing app detected). Using port $APP_PORT for Grow Together."
fi

# ── Detect existing nginx ─────────────────────────────────────────────────────
NGINX_EXISTS=false
command -v nginx &>/dev/null && NGINX_EXISTS=true

# ── Load existing credentials if re-running ───────────────────────────────────
NEW_DB_PASS="$(openssl rand -hex 16)"
NEW_MINIO_USER="gtminio"
NEW_MINIO_PASS="$(openssl rand -hex 16)"
NEW_JWT_SECRET="$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9!@#$%^&*' | head -c 64)"

if [[ -f "$CREDS_FILE" ]]; then
    warn "Existing install found — reusing stored credentials."
    # shellcheck disable=SC1090
    source "$CREDS_FILE"
else
    DB_PASS="$NEW_DB_PASS"
    MINIO_USER="$NEW_MINIO_USER"
    MINIO_PASS="$NEW_MINIO_PASS"
    JWT_SECRET="$NEW_JWT_SECRET"
fi

# ── Interactive prompts ───────────────────────────────────────────────────────
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
echo -e "  ${BOLD}Setup Configuration${NC}"
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
echo ""

# Domain
DOMAIN_NAME=""
read -rp "  Enter domain name for Grow Together (e.g. gtg.yourdomain.com)
  Press Enter to skip (app will be accessible at http://${PUBLIC_IP}:${APP_PORT}): " DOMAIN_NAME
DOMAIN_NAME="$(echo "$DOMAIN_NAME" | tr -d ' ')"

# Google OAuth Client ID
echo ""
if [[ -n "${GOOGLE_CLIENT_ID:-}" ]]; then
    ok "Google Client ID already set via environment."
else
    read -rp "  Enter Google OAuth Client ID (press Enter to skip Google Sign-In): " GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_ID="$(echo "$GOOGLE_CLIENT_ID" | tr -d ' ')"
    [[ -z "$GOOGLE_CLIENT_ID" ]] && GOOGLE_CLIENT_ID="REPLACE_WITH_YOUR_GOOGLE_CLIENT_ID"
fi

echo ""
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
echo -e "  ${BOLD}Summary${NC}"
echo -e "  App port   : ${BOLD}${APP_PORT}${NC}"
echo -e "  DB port    : ${BOLD}${DB_PORT}${NC}  ($([ "$PG_ALREADY_INSTALLED" = true ] && echo 'existing PostgreSQL' || echo 'fresh install'))"
echo -e "  Domain     : ${BOLD}$([ -n "$DOMAIN_NAME" ] && echo "$DOMAIN_NAME" || echo "none — IP:port access")${NC}"
echo -e "  nginx      : ${BOLD}$([ "$NGINX_EXISTS" = true ] && echo 'add server block' || echo 'install new')${NC}"
echo -e "  Google SSO : ${BOLD}$([ "$GOOGLE_CLIENT_ID" != "REPLACE_WITH_YOUR_GOOGLE_CLIENT_ID" ] && echo 'enabled' || echo 'skipped')${NC}"
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
echo ""
read -rp "  Proceed with installation? [Y/n]: " CONFIRM
[[ "${CONFIRM,,}" == "n" ]] && { echo "Aborted."; exit 0; }

# ════════════════════════════════════════════════════════════════════════════
# STEP 1 — System packages
# ════════════════════════════════════════════════════════════════════════════
step "1 / 9  System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
    curl wget gnupg lsb-release apt-transport-https ca-certificates \
    unzip git openssl software-properties-common 2>&1 | tail -3
ok "System packages installed"

# ════════════════════════════════════════════════════════════════════════════
# STEP 2 — Swap (needed on low-memory EC2 instances for npm/Vite build)
# ════════════════════════════════════════════════════════════════════════════
step "2 / 9  Swap space"
SWAP_FILE="/swapfile"
if [[ "$(swapon --show 2>/dev/null | wc -l)" -le 1 ]]; then
    info "No swap — creating 2 GB swap file..."
    if fallocate -l 2G "$SWAP_FILE" 2>/dev/null || \
       dd if=/dev/zero of="$SWAP_FILE" bs=1M count=2048 status=none; then
        chmod 600 "$SWAP_FILE"
        mkswap "$SWAP_FILE" > /dev/null
        swapon "$SWAP_FILE"
        grep -q "$SWAP_FILE" /etc/fstab || echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
        ok "2 GB swap created"
    else
        warn "Could not create swap — build may fail on <2 GB RAM instances"
    fi
else
    ok "Swap already present — skipping"
fi

# ════════════════════════════════════════════════════════════════════════════
# STEP 3 — .NET 8 SDK
# ════════════════════════════════════════════════════════════════════════════
step "3 / 9  .NET 8 SDK"
if dotnet --version 2>/dev/null | grep -qE "^[89]\."; then
    ok ".NET already installed: $(dotnet --version)"
else
    info "Installing .NET 8 via dotnet-install.sh (works on all Ubuntu versions)..."
    curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
    chmod +x /tmp/dotnet-install.sh
    /tmp/dotnet-install.sh --channel 8.0 --install-dir /usr/share/dotnet 2>&1 | tail -5
    # Symlink so dotnet is on PATH for all users
    ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet
    # Make sure it's usable in this shell session
    export DOTNET_ROOT=/usr/share/dotnet
    export PATH=$PATH:/usr/share/dotnet
    ok ".NET $(dotnet --version) installed"
fi

# ════════════════════════════════════════════════════════════════════════════
# STEP 4 — Node.js 20
# ════════════════════════════════════════════════════════════════════════════
step "4 / 9  Node.js 20"
if node --version 2>/dev/null | grep -qE "^v2[0-9]\."; then
    ok "Node.js already installed: $(node --version)"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>&1 | tail -3
    apt-get install -y -qq nodejs 2>&1 | tail -3
    ok "Node.js $(node --version) installed"
fi

# ════════════════════════════════════════════════════════════════════════════
# STEP 5 — PostgreSQL (smart: reuse existing or fresh install)
# ════════════════════════════════════════════════════════════════════════════
step "5 / 9  PostgreSQL + Redis + app user"

if [[ "$PG_ALREADY_INSTALLED" == "false" ]]; then
    # ── Fresh install ─────────────────────────────────────────────────────
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
    echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
    apt-get update -qq
    apt-get install -y -qq postgresql-16 2>&1 | tail -3
    ok "PostgreSQL 16 installed"

    # Set port 5433 for fresh install (avoids conflict with default 5432 on other apps)
    PG_CONF="$(find /etc/postgresql -name "postgresql.conf" 2>/dev/null | head -1)"
    if [[ -n "$PG_CONF" ]] && ! grep -q "^port = $DB_PORT" "$PG_CONF"; then
        sed -i "s/^#\?port = .*/port = $DB_PORT/" "$PG_CONF"
        ok "PostgreSQL port set to $DB_PORT"
    fi

    if $USE_SYSTEMD; then
        systemctl enable postgresql 2>/dev/null || true
        pg_ctlcluster 16 main start 2>/dev/null \
            || systemctl start postgresql@16-main 2>/dev/null || true
    else
        pg_ctlcluster 16 main start 2>/dev/null || true
    fi
    sleep 3
else
    # ── Existing PostgreSQL — just make sure it's running ─────────────────
    ok "PostgreSQL already installed: $(psql --version)"
    if $USE_SYSTEMD; then
        systemctl enable postgresql 2>/dev/null || true
        pg_ctlcluster "$(pg_lsclusters -h 2>/dev/null | awk '{print $1}' | head -1)" \
            "$(pg_lsclusters -h 2>/dev/null | awk '{print $2}' | head -1)" start 2>/dev/null || true
    fi
    sleep 2
    ok "Using existing PostgreSQL on port $DB_PORT"
fi

# ── Create DB user + database ─────────────────────────────────────────────
PSQL="sudo -u postgres psql -p $DB_PORT"
if $PSQL -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null | grep -q 1; then
    $PSQL -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null
    ok "DB user $DB_USER — password refreshed"
else
    $PSQL -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null
    ok "DB user $DB_USER created"
fi

if ! $PSQL -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
    $PSQL -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null
    ok "Database $DB_NAME created"
else
    ok "Database $DB_NAME already exists"
fi

$PSQL -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
$PSQL -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true
ok "DB permissions set"

# ── Redis ─────────────────────────────────────────────────────────────────
if ! command -v redis-server &>/dev/null; then
    apt-get install -y -qq redis-server 2>&1 | tail -3
    ok "Redis installed"
else
    ok "Redis already installed"
fi
if $USE_SYSTEMD; then
    systemctl enable redis-server 2>/dev/null || true
    systemctl start redis-server 2>/dev/null || true
else
    service redis-server start || true
fi
ok "Redis running"

# ── App system user ───────────────────────────────────────────────────────
if id "$APP_USER" &>/dev/null; then
    ok "System user $APP_USER already exists"
else
    useradd --system --no-create-home --shell /usr/sbin/nologin "$APP_USER"
    ok "System user $APP_USER created"
fi
mkdir -p "$DEPLOY_DIR"
chown "$APP_USER:$APP_USER" "$DEPLOY_DIR"

# ════════════════════════════════════════════════════════════════════════════
# STEP 6 — MinIO  (runs via Docker — MinIO dropped standalone binary downloads)
# ════════════════════════════════════════════════════════════════════════════
step "6 / 9  MinIO"
mkdir -p "$MINIO_DATA"

# ── Install Docker if missing ─────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh 2>&1 | tail -5
    systemctl enable docker  2>/dev/null || true
    systemctl start  docker  2>/dev/null || true
    ok "Docker installed"
else
    ok "Docker already present: $(docker --version | head -1)"
    systemctl enable docker  2>/dev/null || true
    systemctl start  docker  2>/dev/null || true
fi

# ── Config file ───────────────────────────────────────────────────────────
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/minio.env" <<EOF
MINIO_ROOT_USER=$MINIO_USER
MINIO_ROOT_PASSWORD=$MINIO_PASS
EOF
chmod 600 "$CONFIG_DIR/minio.env"
chown -R "$APP_USER:$APP_USER" "$MINIO_DATA"

# ── Pull image ────────────────────────────────────────────────────────────
info "Pulling MinIO Docker image (quay.io/minio/minio:latest)..."
docker pull quay.io/minio/minio:latest 2>&1 | tail -3
ok "MinIO image ready"

# ── Wrapper script (reads credentials from env file at start time) ────────
cat > /opt/minio/start-minio.sh <<SCRIPT
#!/usr/bin/env bash
set -a; source ${CONFIG_DIR}/minio.env; set +a
docker rm -f minio 2>/dev/null || true
exec docker run --rm --name minio \\
    -p ${MINIO_PORT}:9000 -p ${MINIO_CONSOLE_PORT}:9001 \\
    -v ${MINIO_DATA}:/data \\
    -e MINIO_ROOT_USER="\$MINIO_ROOT_USER" \\
    -e MINIO_ROOT_PASSWORD="\$MINIO_ROOT_PASSWORD" \\
    quay.io/minio/minio:latest server /data --console-address ":9001"
SCRIPT
chmod +x /opt/minio/start-minio.sh

if $USE_SYSTEMD; then
    cat > /etc/systemd/system/minio.service <<EOF
[Unit]
Description=MinIO Object Storage (Docker)
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=simple
User=root
ExecStart=/opt/minio/start-minio.sh
ExecStop=/usr/bin/docker stop minio
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable minio 2>/dev/null || true
    systemctl restart minio 2>/dev/null || true
    sleep 5
    ok "MinIO service started"
else
    nohup /opt/minio/start-minio.sh > /var/log/minio.log 2>&1 &
    echo $! > /var/run/minio.pid
    sleep 5
    ok "MinIO started"
fi

# ── Create bucket via mc Docker image ────────────────────────────────────
sleep 3
docker run --rm --network host quay.io/minio/mc:latest \
    alias set local "http://localhost:$MINIO_PORT" "$MINIO_USER" "$MINIO_PASS" --quiet 2>/dev/null || true
docker run --rm --network host quay.io/minio/mc:latest \
    mb --ignore-existing "local/$MINIO_BUCKET" 2>/dev/null || true
docker run --rm --network host quay.io/minio/mc:latest \
    anonymous set download "local/$MINIO_BUCKET" 2>/dev/null || true
ok "MinIO bucket '$MINIO_BUCKET' ready"

# ════════════════════════════════════════════════════════════════════════════
# STEP 7 — Production config
# ════════════════════════════════════════════════════════════════════════════
step "7 / 9  Production config"
mkdir -p "$CONFIG_DIR"
chmod 750 "$CONFIG_DIR"
chown root:"$APP_USER" "$CONFIG_DIR"

# Public URL for MinIO (used for image URLs stored in DB).
# When a domain is set we proxy MinIO through nginx at /storage so
# the browser never needs to reach port 9000 directly.
if [[ -n "$DOMAIN_NAME" ]]; then
    MINIO_PUBLIC_URL="https://${DOMAIN_NAME}/storage"
else
    MINIO_PUBLIC_URL="http://${PUBLIC_IP}:${MINIO_PORT}"
fi

cat > "$CREDS_FILE" <<EOF
# Grow Together — generated credentials
# DO NOT SHARE THIS FILE
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS
DB_PORT=$DB_PORT
MINIO_USER=$MINIO_USER
MINIO_PASS=$MINIO_PASS
MINIO_PORT=$MINIO_PORT
MINIO_BUCKET=$MINIO_BUCKET
JWT_SECRET=$JWT_SECRET
APP_PORT=$APP_PORT
APP_NAME=$APP_NAME
DEPLOY_DIR=$DEPLOY_DIR
APP_USER=$APP_USER
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
DOMAIN_NAME=${DOMAIN_NAME:-}
EOF
chmod 600 "$CREDS_FILE"

cat > "$CONFIG_DIR/appsettings.Production.json" <<EOF
{
  "Logging": {
    "LogLevel": {
      "Default": "Warning",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "Default": "Host=localhost;Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASS}"
  },
  "Jwt": {
    "Secret": "${JWT_SECRET}",
    "Issuer": "combined-studies",
    "Audience": "combined-studies-users",
    "ExpiryDays": "7"
  },
  "Google": {
    "ClientId": "${GOOGLE_CLIENT_ID}"
  },
  "MinIO": {
    "Endpoint": "localhost:${MINIO_PORT}",
    "AccessKey": "${MINIO_USER}",
    "SecretKey": "${MINIO_PASS}",
    "Bucket": "${MINIO_BUCKET}",
    "PublicUrl": "${MINIO_PUBLIC_URL}"
  }
}
EOF
chmod 640 "$CONFIG_DIR/appsettings.Production.json"
chown root:"$APP_USER" "$CONFIG_DIR/appsettings.Production.json"
ok "Production config written to $CONFIG_DIR/"

# ════════════════════════════════════════════════════════════════════════════
# STEP 8 — Build frontend + publish backend
# ════════════════════════════════════════════════════════════════════════════
step "8 / 9  Build (frontend + backend)"

info "Installing npm dependencies..."
cd "$APP_ROOT/web"
npm ci --prefer-offline 2>&1 | tail -3

cat > .env.production <<EOF
VITE_API_URL=
VITE_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
EOF

info "Building React frontend..."
export NODE_OPTIONS='--max-old-space-size=1536'
npm run build 2>&1 | tail -5
ok "Frontend built → web/dist/"

WWWROOT="$APP_ROOT/backend/src/CombinedStudies.Api/wwwroot"
rm -rf "$WWWROOT"
cp -r "$APP_ROOT/web/dist" "$WWWROOT"
ok "Frontend copied to backend wwwroot"

info "Publishing ASP.NET Core backend..."
cd "$APP_ROOT/backend"
dotnet publish src/CombinedStudies.Api/CombinedStudies.Api.csproj \
    -c Release -r linux-x64 --self-contained false \
    -o "$DEPLOY_DIR/app" --nologo -v quiet 2>&1 | tail -5

ln -sf "$CONFIG_DIR/appsettings.Production.json" \
    "$DEPLOY_DIR/app/appsettings.Production.json"
chown -R "$APP_USER:$APP_USER" "$DEPLOY_DIR"
ok "Backend published → $DEPLOY_DIR/app/"

# ════════════════════════════════════════════════════════════════════════════
# STEP 9 — nginx + SSL + systemd service + health check
# ════════════════════════════════════════════════════════════════════════════
step "9 / 9  nginx + App service + health check"

# ── nginx ─────────────────────────────────────────────────────────────────
if [[ -n "$DOMAIN_NAME" ]]; then
    # Install nginx if not present
    if ! command -v nginx &>/dev/null; then
        apt-get install -y -qq nginx 2>&1 | tail -3
        ok "nginx installed"
    else
        ok "nginx already installed — adding server block"
    fi

    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

    # Ensure nginx.conf includes sites-enabled
    if ! grep -q "sites-enabled" /etc/nginx/nginx.conf 2>/dev/null; then
        sed -i '/include \/etc\/nginx\/conf\.d/a\    include /etc/nginx/sites-enabled/*;' \
            /etc/nginx/nginx.conf 2>/dev/null || true
    fi

    # ── SSL certificate ───────────────────────────────────────────────────
    CERT_PATH=""
    KEY_PATH=""
    CERTBOT_DOMAIN=""

    echo ""
    echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
    echo -e "  ${BOLD}SSL Certificate for ${DOMAIN_NAME}${NC}"
    echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
    echo ""
    read -rp "  Get a free trusted SSL cert from Let's Encrypt? [y/N]: " CERT_CHOICE

    if [[ "${CERT_CHOICE,,}" == "y" ]]; then
        echo ""
        echo -e "  ${YELLOW}DNS for '${DOMAIN_NAME}' must point to ${PUBLIC_IP} before proceeding.${NC}"
        read -rp "  DNS is ready — proceed? [y/N]: " DNS_READY

        if [[ "${DNS_READY,,}" == "y" ]]; then
            apt-get install -y -qq certbot python3-certbot-nginx 2>&1 | tail -3
            # Write a minimal nginx config for certbot to validate
            cat > "/etc/nginx/sites-available/${NGINX_CONF}" <<TMPNGINX
server {
    listen 80;
    server_name ${DOMAIN_NAME};
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}
TMPNGINX
            ln -sf "/etc/nginx/sites-available/${NGINX_CONF}" \
                   "/etc/nginx/sites-enabled/${NGINX_CONF}" 2>/dev/null || true
            nginx -t 2>/dev/null && (systemctl reload nginx 2>/dev/null || true)

            if certbot certonly --nginx -d "$DOMAIN_NAME" \
                --non-interactive --agree-tos \
                --register-unsafely-without-email 2>&1; then
                CERT_PATH="/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem"
                KEY_PATH="/etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem"
                CERTBOT_DOMAIN="$DOMAIN_NAME"
                ok "Let's Encrypt certificate issued"
                systemctl enable certbot.timer 2>/dev/null || true
            else
                warn "Certbot failed — falling back to self-signed cert"
            fi
        fi
    fi

    # Fallback to self-signed if no cert yet
    if [[ -z "$CERT_PATH" ]]; then
        mkdir -p "$SSL_DIR"
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
            -keyout "$SSL_DIR/${APP_NAME}.key" \
            -out    "$SSL_DIR/${APP_NAME}.crt" \
            -subj "/C=US/ST=State/L=City/O=GrowTogether/CN=${DOMAIN_NAME}" \
            2>/dev/null
        chmod 600 "$SSL_DIR/${APP_NAME}.key"
        CERT_PATH="$SSL_DIR/${APP_NAME}.crt"
        KEY_PATH="$SSL_DIR/${APP_NAME}.key"
        ok "Self-signed SSL certificate generated"
    fi

    # ── Write nginx server block ──────────────────────────────────────────
    cat > "/etc/nginx/sites-available/${NGINX_CONF}" <<NGINXEOF
# ── HTTP — redirect to HTTPS ──────────────────────────────────────────────
server {
    listen 80;
    server_name ${DOMAIN_NAME};
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}

# ── HTTPS — proxy to Grow Together on :${APP_PORT} ─────────────────────────
server {
    listen 443 ssl;
    http2 on;
    server_name ${DOMAIN_NAME};

    ssl_certificate     ${CERT_PATH};
    ssl_certificate_key ${KEY_PATH};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL_GT:10m;
    ssl_session_timeout 10m;

    # Gzip compression — reduces JS/CSS/JSON by ~70%
    gzip              on;
    gzip_vary         on;
    gzip_proxied      any;
    gzip_comp_level   5;
    gzip_min_length   1024;
    gzip_types        text/plain text/css application/javascript application/json
                      application/x-javascript text/xml application/xml
                      image/svg+xml application/wasm;

    client_max_body_size 30M;

    # MinIO object storage — proxied so images load over HTTPS without port 9000
    location /storage/ {
        proxy_pass         http://127.0.0.1:${MINIO_PORT}/;
        # Must use the MinIO endpoint as Host — sending $host causes MinIO
        # to treat the domain as a bucket name (virtual-host style) → 404
        proxy_set_header   Host              "127.0.0.1:${MINIO_PORT}";
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_buffering    off;
        proxy_connect_timeout 30s;
        proxy_read_timeout    60s;
        # Cache images in the browser for 7 days (content-addressed by MinIO)
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    # Static assets have content hashes — safe to cache forever
    location ~* \.(js|css|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|svg|webp)$ {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        add_header         Cache-Control "public, max-age=31536000, immutable";
        proxy_connect_timeout 30s;
        proxy_read_timeout    30s;
    }

    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;
    }
}
NGINXEOF

    ln -sf "/etc/nginx/sites-available/${NGINX_CONF}" \
           "/etc/nginx/sites-enabled/${NGINX_CONF}" 2>/dev/null || true

    nginx -t 2>&1 || warn "nginx config test failed — check /etc/nginx/sites-available/${NGINX_CONF}"
    if $USE_SYSTEMD; then
        systemctl enable nginx 2>/dev/null || true
        systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true
    fi
    ok "nginx server block added for ${DOMAIN_NAME}"
else
    info "No domain provided — app accessible directly at http://${PUBLIC_IP}:${APP_PORT}"
    info "Open port ${APP_PORT} in your EC2 Security Group."
fi

# ── App systemd service ───────────────────────────────────────────────────
if $USE_SYSTEMD; then
    cat > /etc/systemd/system/$APP_NAME.service <<EOF
[Unit]
Description=Grow Together Platform
After=network.target postgresql.service minio.service redis.service
Wants=postgresql.service minio.service redis.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$DEPLOY_DIR/app
ExecStart=/usr/bin/dotnet $DEPLOY_DIR/app/CombinedStudies.Api.dll
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=$APP_NAME
StandardOutput=journal
StandardError=journal
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://0.0.0.0:$APP_PORT
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false
Environment=DOTNET_ROOT=/usr/share/dotnet

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable "$APP_NAME" 2>/dev/null || true
    systemctl restart "$APP_NAME" 2>/dev/null || true
    sleep 8
    if systemctl is-active --quiet "$APP_NAME"; then
        ok "Service $APP_NAME is running"
    else
        warn "Service did not start — check: journalctl -u $APP_NAME -n 50"
    fi
else
    sudo -u "$APP_USER" \
        ASPNETCORE_ENVIRONMENT=Production \
        ASPNETCORE_URLS="http://0.0.0.0:$APP_PORT" \
        DOTNET_PRINT_TELEMETRY_MESSAGE=false \
        nohup dotnet "$DEPLOY_DIR/app/CombinedStudies.Api.dll" \
            > /var/log/$APP_NAME.log 2>&1 &
    echo $! > /var/run/$APP_NAME.pid
    sleep 8
    ok "App started"
fi

# ── Health checks ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
echo -e "  ${BOLD}Health checks...${NC}"
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
sleep 4

HEALTH_PASS=true

APP_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    "http://127.0.0.1:$APP_PORT/api/auth/me" 2>/dev/null || echo "000")"
if [[ "$APP_CODE" == "200" || "$APP_CODE" == "401" || "$APP_CODE" == "403" ]]; then
    ok "App  :$APP_PORT → HTTP $APP_CODE  ✓"
else
    warn "App  :$APP_PORT → HTTP $APP_CODE  ✗"
    HEALTH_PASS=false
fi

MINIO_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    "http://127.0.0.1:$MINIO_PORT/minio/health/live" 2>/dev/null || echo "000")"
if [[ "$MINIO_CODE" == "200" ]]; then
    ok "MinIO :$MINIO_PORT → HTTP $MINIO_CODE  ✓"
else
    warn "MinIO :$MINIO_PORT → HTTP $MINIO_CODE  ✗"
    HEALTH_PASS=false
fi

if sudo -u postgres psql -p "$DB_PORT" -c "SELECT 1" &>/dev/null 2>&1; then
    ok "PostgreSQL :$DB_PORT → reachable  ✓"
else
    warn "PostgreSQL :$DB_PORT → not reachable  ✗"
    HEALTH_PASS=false
fi

if [[ -n "$DOMAIN_NAME" ]]; then
    HTTPS_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -k \
        "https://${DOMAIN_NAME}/api/auth/me" 2>/dev/null || echo "000")"
    if [[ "$HTTPS_CODE" == "200" || "$HTTPS_CODE" == "401" ]]; then
        ok "HTTPS https://${DOMAIN_NAME} → HTTP $HTTPS_CODE  ✓"
    else
        warn "HTTPS https://${DOMAIN_NAME} → HTTP $HTTPS_CODE  ✗  (DNS may not propagate yet)"
    fi
fi

# ── Credentials summary ───────────────────────────────────────────────────
APP_URL="http://${PUBLIC_IP}:${APP_PORT}"
[[ -n "$DOMAIN_NAME" ]] && APP_URL="https://${DOMAIN_NAME}"

cat > "$CRED_SUMMARY" <<EOF
╔══════════════════════════════════════════════════════════╗
  Grow Together — Credentials  ($(date '+%Y-%m-%d %H:%M'))
╚══════════════════════════════════════════════════════════╝

  App URL        : ${APP_URL}
  MinIO Console  : http://${PUBLIC_IP}:${MINIO_CONSOLE_PORT}
  Deploy dir     : ${DEPLOY_DIR}
  Config dir     : ${CONFIG_DIR}

── Database ───────────────────────────────────────────────
  Host     : localhost:${DB_PORT}
  Database : ${DB_NAME}
  User     : ${DB_USER}
  Password : ${DB_PASS}

── MinIO ──────────────────────────────────────────────────
  Endpoint : localhost:${MINIO_PORT}
  User     : ${MINIO_USER}
  Password : ${MINIO_PASS}
  Bucket   : ${MINIO_BUCKET}

── JWT ────────────────────────────────────────────────────
  Secret   : ${JWT_SECRET}

── EC2 Security Group — open inbound ports ────────────────
$(if [[ -n "$DOMAIN_NAME" ]]; then
  echo "  Port 80   — HTTP  (redirects to HTTPS)"
  echo "  Port 443  — HTTPS"
else
  echo "  Port ${APP_PORT}  — App (HTTP direct)"
fi)
  Port ${MINIO_PORT} — MinIO API
  Port ${MINIO_CONSOLE_PORT} — MinIO Console

── Service commands ───────────────────────────────────────
  sudo systemctl status ${APP_NAME}
  sudo systemctl restart ${APP_NAME}
  sudo journalctl -u ${APP_NAME} -f

── Update after git pull ──────────────────────────────────
  sudo bash scripts/update.sh
EOF
chmod 600 "$CRED_SUMMARY"

# ── Final banner ──────────────────────────────────────────────────────────
echo ""
if [[ "$HEALTH_PASS" == "true" ]]; then
    echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║   🎉  Grow Together is up and running!                   ║${NC}"
    echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${YELLOW}${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}${BOLD}║   ⚠  Install complete but health checks had warnings.    ║${NC}"
    echo -e "${YELLOW}${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
fi
echo ""
echo -e "  ${BOLD}App URL    :${NC}  ${CYAN}${APP_URL}${NC}"
echo -e "  ${BOLD}MinIO UI   :${NC}  ${CYAN}http://${PUBLIC_IP}:${MINIO_CONSOLE_PORT}${NC}"
echo ""
if [[ -n "$DOMAIN_NAME" ]]; then
    echo -e "  ${BOLD}EC2 Security Group — open ports:${NC}  80, 443, ${MINIO_PORT}, ${MINIO_CONSOLE_PORT}"
    if [[ -z "$CERTBOT_DOMAIN" ]]; then
        echo -e "  ${YELLOW}⚠  Self-signed cert — browser will warn.${NC}"
        echo -e "     Run later: sudo certbot --nginx -d ${DOMAIN_NAME}"
    fi
else
    echo -e "  ${BOLD}EC2 Security Group — open port:${NC}  ${APP_PORT}, ${MINIO_PORT}, ${MINIO_CONSOLE_PORT}"
fi
echo ""
echo -e "  ${BOLD}Credentials:${NC}  ${CRED_SUMMARY}"
echo ""
