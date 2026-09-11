# Grow Together — Ubuntu Deployment Guide

A full-stack social learning platform. Backend: ASP.NET Core 8. Frontend: React + Vite. Storage: PostgreSQL, MinIO, Redis.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Ubuntu 20.04 / 22.04 / 24.04 | Fresh instance recommended |
| 2 GB RAM minimum | 4 GB recommended |
| EC2 or any VPS with a public IP | |
| Root / sudo access | Scripts must run as root |
| Git | For cloning the repo |

---

## EC2 Security Group — Open These Ports

| Port | Purpose |
|---|---|
| 22 | SSH |
| 5000 | Application (HTTP) |
| 9000 | MinIO API |
| 9001 | MinIO Web Console |

---

## Step-by-Step Deployment

### 1. SSH into your server

```bash
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

### 2. Clone the repository

```bash
git clone <your-repo-url> /home/ubuntu/growtogether
cd /home/ubuntu/growtogether
```

### 3. (Optional) Set your Google OAuth Client ID

If you want Google Sign-In to work, export your Client ID before running the script:

```bash
export GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
```

Skip this step if you do not need Google OAuth — the app works without it.

### 4. Run the install script

```bash
sudo -E bash scripts/install.sh
```

> The `-E` flag passes your exported environment variables (like `GOOGLE_CLIENT_ID`) through to the sudo session.

The script will:

1. Install .NET 8 SDK, Node.js 20, PostgreSQL 16, Redis, MinIO
2. Create a system user `growtogether`
3. Create the database `combinedstudies` with a random password
4. Download MinIO, create the bucket, set public-read policy
5. Build the React frontend (`npm run build`)
6. Copy the built frontend into the backend `wwwroot`
7. Publish the ASP.NET Core backend
8. Write `/etc/growtogether/appsettings.Production.json` with all secrets
9. Create and start systemd services for the app and MinIO
10. Print a summary with the access URL and credentials location

Total time: ~5–10 minutes depending on internet speed.

### 5. Access the application

After the script finishes it prints:

```
  Application:     http://<PUBLIC-IP>:5000
  MinIO Console:   http://<PUBLIC-IP>:9001
  Credentials:     /etc/growtogether/credentials.env
```

Open `http://<PUBLIC-IP>:5000` in your browser.

---

## Updating After Code Changes

On your local machine, commit and push your changes. Then on the server:

```bash
cd /home/ubuntu/growtogether
git pull
sudo bash scripts/update.sh
```

The update script:
1. Rebuilds the frontend (`npm ci && npm run build`)
2. Copies the new build to backend wwwroot
3. Re-publishes the backend
4. Restarts the `growtogether` systemd service

---

## Uninstalling

**Remove everything (including database and MinIO data):**

```bash
sudo bash scripts/delete.sh
```

**Remove services and binaries but keep the data:**

```bash
sudo bash scripts/delete.sh --keep-data
```

---

## Service Management

```bash
# Application
sudo systemctl status growtogether
sudo systemctl restart growtogether
sudo systemctl stop growtogether
sudo journalctl -u growtogether -f          # live logs

# MinIO
sudo systemctl status minio
sudo systemctl restart minio
sudo journalctl -u minio -f

# PostgreSQL
sudo systemctl status postgresql
sudo journalctl -u postgresql -f
```

---

## Credentials & Config

All auto-generated secrets are stored in:

```
/etc/growtogether/credentials.env           # DB password, MinIO password, JWT secret
/etc/growtogether/appsettings.Production.json  # Full production config (symlinked into app)
/etc/growtogether/minio.env                 # MinIO root credentials
```

These files are owned by root and readable only by root and the `growtogether` system user.

**To update the Google Client ID after install:**

```bash
sudo nano /etc/growtogether/appsettings.Production.json
# Edit the "Google" > "ClientId" value
sudo systemctl restart growtogether
```

---

## Architecture Overview

```
Browser  ──►  :5000  (ASP.NET Core)
                │
                ├── Serves React SPA (static files in wwwroot)
                ├── REST API  /api/*
                ├── SignalR   /hubs/*   (real-time chat, notifications)
                │
                ├── PostgreSQL :5433    (main database)
                ├── Redis      :6379    (SignalR backplane / caching)
                └── MinIO      :9000    (image & document storage)
```

The backend serves the frontend as static files — no nginx or reverse proxy required for basic deployment. For HTTPS, add an nginx reverse proxy or use an AWS Application Load Balancer.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| App not reachable | Check EC2 security group — port 5000 must be open |
| `502` or blank page | `sudo journalctl -u growtogether -n 100` — check for DB connection errors |
| Images not loading | Check MinIO is running: `sudo systemctl status minio` |
| Login fails | Verify the `Jwt.Secret` in `appsettings.Production.json` is not empty |
| Google Sign-In fails | Set the correct `Google.ClientId` and add the EC2 IP to Google OAuth allowed origins |
| Migrations fail | Check PostgreSQL is running on port 5433; check `ConnectionStrings.Default` |

---

## Notes

- The install script is **idempotent** — safe to re-run. It reuses existing credentials and skips steps already completed.
- The database migrations run automatically when the application starts (`app.RunMigrationsAsync()` in `Program.cs`).
- Passwords and JWT secrets are randomly generated on first install and stored in `/etc/growtogether/credentials.env`. **Back this file up** if you need to restore the server.
