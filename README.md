# ocs-console

A modern, responsive web console for [OCS Inventory NG](https://www.ocsinventory-ng.org/) — search, browse, edit, and export your IT asset inventory with a clean UI featuring dashboards, charts, dark mode, and SSO authentication.

Built with **Angular 18** + **Node.js/Express BFF** in a single Docker container, reading directly from the OCS MariaDB/MySQL database. No modifications to your OCS installation required — just point it at the database.

---

## Table of contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Prerequisites](#prerequisites)
- [Architecture](#architecture)
- [Quick start (Docker)](#quick-start-docker)
- [Manual installation (development)](#manual-installation-development)
- [Connecting to OCS Inventory](#connecting-to-ocs-inventory)
- [Configuration reference](#configuration-reference)
- [Authentication (SSO)](#authentication-sso)
- [Administrative fields](#administrative-fields)
- [Reverse proxy (HTTPS)](#reverse-proxy-https)
- [Optional OCS plugins](#optional-ocs-plugins)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Tech stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Dashboard** — KPIs (total assets, servers, workstations, software count), donut/bar charts (by OS, by company, by type, by freshness), recent and stale asset lists
- **Asset list** — searchable, sortable, paginated table with freshness chips; filter by servers/workstations; CSV export with all administrative fields
- **Asset detail** — full hardware/software summary styled like Lansweeper, editable administrative fields, disk usage bars, network interfaces, BitLocker status, SQL Server instances
- **Software** — aggregated software inventory with publisher, versions, and install count
- **Reports** — pre-filtered shortcuts (recently added, stale, by type, needs attention)
- **SQL Server** — instances report with edition filter (requires the `sqlserver_instances` plugin table)
- **Updates** — Windows/Linux update status report (requires the `windows_updates`/`linux_updates` plugin tables)
- **Dark mode** — light/dark theme toggle with system preference detection and no flash on load
- **SSO** — OIDC authentication (Microsoft Entra ID out of the box) with group-based authorization
- **Configurable** — administrative field labels, server-type detection, and description field are all configurable via environment variables or loaded automatically from the OCS database
- **Suggestions board** — built-in feedback wall where authenticated users can submit feature requests

---

## Screenshots

> Add screenshots here after first deployment:
>
> ```
> docs/dashboard.png        — Dashboard with KPIs and charts
> docs/asset-list.png       — Asset list with search and filters
> docs/asset-detail.png     — Asset detail page
> docs/dark-mode.png        — Dark mode
> docs/login.png            — SSO login page
> ```

---

## Prerequisites

| Requirement | Why | Version |
|---|---|---|
| **OCS Inventory NG** | The inventory server with agents reporting to it | 2.12+ (tested on 2.12.5) |
| **MariaDB / MySQL** | The OCS database (`ocsweb`) — must be reachable from the console | 10.6+ / 5.7+ |
| **Docker** + **Docker Compose** | To run the console container | Docker 20+, Compose v2+ |
| **OIDC Identity Provider** | For SSO authentication (Microsoft Entra ID, Keycloak, Authentik, etc.) | Any OIDC-compliant IdP |

> **Don't have OCS Inventory yet?** Install it first from [ocsinventory-ng.org](https://www.ocsinventory-ng.org/). The console is a read/edit UI on top of an existing OCS deployment — it does not replace the OCS agent, comm server, or classic web console.

---

## Architecture

```
                          ┌──────────────────────────────┐
                          │         OIDC IdP             │
                          │  (Entra ID / Keycloak / ...) │
                          └──────────────┬───────────────┘
                                         │ OAuth2 / OIDC
                                         ▼
  ┌──────────┐    HTTPS    ┌──────────────────────────────┐
  │ Browser  │───────────▶│     Reverse proxy (nginx)     │
  │          │            │   ocs-console.example.com     │
  └──────────┘            └──────────────┬───────────────┘
                                         │ proxy_pass
                                         ▼
                          ┌──────────────────────────────┐
                          │   ocs-console container      │
                          │   (Docker, port 8080→3000)    │
                          │                              │
                          │  ┌────────────────────────┐ │
                          │  │  Angular 18 SPA         │ │
                          │  │  (static files)         │ │
                          │  └───────────┬────────────┘ │
                          │              │              │
                          │  ┌───────────▼────────────┐ │
                          │  │  Node.js / Express BFF  │ │
                          │  │  REST API + auth        │ │
                          │  └───────────┬────────────┘ │
                          └──────────────┼──────────────┘
                                         │ mysql2 (TCP)
                                         ▼
                          ┌──────────────────────────────┐
                          │   MariaDB / MySQL            │
                          │   database: ocsweb           │
                          │   (OCS Inventory NG)         │
                          └──────────────────────────────┘
```

**Single Docker container** with a multi-stage build:
1. **Build stage** — compiles the Angular app with `ng build` (output: `public/`)
2. **Runtime stage** — Node.js/Express serves the static Angular files + the REST API, connecting to MariaDB via `mysql2`

The console **reads directly from the OCS database** — it does not use the OCS REST API. This is faster and allows editing administrative fields. The database user needs `SELECT` (and `UPDATE`/`INSERT` for editing) on `ocsweb.*`.

---

## Quick start (Docker)

### Step 1 — Clone and configure

```bash
git clone https://github.com/<your-org>/ocs-console.git
cd ocs-console
cp .env.example .env
```

Edit `.env` with your values (see [Configuration reference](#configuration-reference)):

```env
# Database — point at your OCS MariaDB/MySQL
DB_HOST=10.0.0.50          # IP of the server running OCS
DB_PORT=3306
DB_USER=ocs                # OCS database user
DB_PASS=your_password      # OCS database password
DB_NAME=ocsweb             # OCS database name (default: ocsweb)

# Authentication — your OIDC provider
AUTH_ENABLED=true
TENANT_ID=your-tenant-id
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
BASE_URL=https://ocs-console.example.com
AUTHORIZED_GROUP_ID=your-group-id
SESSION_SECRET=generate-a-random-string

# Optional: customize admin fields
DESCRIPTION_FIELD=fields_16
SERVER_TYPE_FIELD=fields_6
SERVER_TYPE_PATTERN=serv|server
```

### Step 2 — Build and run

```bash
docker compose up -d --build
```

### Step 3 — Access

```bash
# Direct (if port 8080 is accessible)
http://localhost:8080

# Or via reverse proxy (recommended for production)
https://ocs-console.example.com
```

You should see the login page. Click **"Sign in with SSO"** and authenticate with your OIDC provider. Only members of the authorized group will be admitted.

---

## Manual installation (development)

### Prerequisites

- Node.js 18+ (tested on Node 22/24)
- npm 10+
- Angular CLI 18 (`npm install -g @angular/cli`)

### Steps

```bash
# 1. Install backend dependencies
cd server
npm install

# 2. Install frontend dependencies
cd ../web
npm install

# 3. Create .env in the project root (from .env.example)
cd ..
cp .env.example .env
# Edit .env with your database and auth settings

# 4. Start the BFF (serves API on port 3000)
cd server
npm start

# 5. In another terminal, start the Angular dev server (port 4200)
cd web
npm start
```

The Angular dev server proxies `/api` and `/auth` requests to the BFF at `localhost:3000`. Open `http://localhost:4200`.

> **Note:** To disable authentication for local development, set `AUTH_ENABLED=false` in `.env`. The console will load without login.

---

## Connecting to OCS Inventory

The console connects to the **OCS database** (`ocsweb`), not to the OCS web API. This section explains how to prepare the database connection.

### 1. Identify your OCS database

OCS Inventory NG stores all inventory data in a MariaDB/MySQL database, typically named `ocsweb`. Find the credentials in your OCS installation:

- **Docker OCS:** check the `.env` file or `docker-compose.yml` in your OCS deployment for `OCS_DB_*` variables
- **Native OCS:** check `/usr/share/ocsinventory-reports/ocsreports/dbconfig.inc.php` or the OCS Apache config

### 2. Create a database user (recommended)

Instead of using the OCS admin user, create a dedicated user for the console:

```sql
-- On the OCS database server
CREATE USER 'ocs_console'@'%' IDENTIFIED BY 'your_strong_password';
GRANT SELECT, UPDATE, INSERT ON ocsweb.* TO 'ocs_console'@'%';
FLUSH PRIVILEGES;
```

> **Why UPDATE/INSERT?** The console can edit administrative fields (`accountinfo`) and save descriptions. If you only need read-only mode, grant just `SELECT`.

### 3. Ensure network reachability

The console container must reach the database on `DB_HOST:DB_PORT`:

- **OCS on the same host (Docker):** use `DB_HOST=host.docker.internal` (already the default)
- **OCS on a remote server:** use the server's IP, e.g. `DB_HOST=10.0.0.50`
- **Firewall:** ensure the database port (3306) is open to the console's IP

### 4. Verify the connection

After starting the container, check the health endpoint:

```bash
curl http://localhost:8080/api/health
# Expected: {"ok":true}
```

If it returns an error, check:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS` in `.env`
- Network connectivity from the container to the database
- Database user permissions

### 5. Administrative fields (accountinfo)

The console automatically loads field labels from the OCS `accountinfo_config` table — the same table the OCS classic console uses to define custom fields. If you have custom fields defined in OCS, they will appear automatically in the console.

To override or define fields manually, see [Administrative fields](#administrative-fields).

---

## Configuration reference

All configuration is via environment variables (see `.env.example`):

### Database

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `host.docker.internal` | MariaDB/MySQL host (OCS database server) |
| `DB_PORT` | `3306` | Database port |
| `DB_USER` | `ocs` | Database user (needs `SELECT` on `ocsweb.*`; `UPDATE`/`INSERT` for editing) |
| `DB_PASS` | — | Database password |
| `DB_NAME` | `ocsweb` | OCS database name |

### BFF (backend)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | BFF listen port (container internal; mapped to 8080 by default) |
| `CACHE_TTL` | `60` | Cache TTL in seconds for list/stats queries |

### Authentication (OIDC)

| Variable | Default | Description |
|---|---|---|
| `AUTH_ENABLED` | `true` | Enable OIDC authentication. Set to `false` for local dev (no login) |
| `TENANT_ID` | — | OIDC tenant/directory ID (Entra ID: Azure AD tenant ID) |
| `CLIENT_ID` | — | OIDC client (app registration) ID |
| `CLIENT_SECRET` | — | OIDC client secret |
| `BASE_URL` | — | Public URL of the console (used for OIDC redirect URI: `${BASE_URL}/auth/callback`) |
| `AUTHORIZED_GROUP_ID` | — | Security group ID required for access (users not in this group are denied) |
| `SESSION_SECRET` | random | Session signing secret. Set to a fixed random string for persistent sessions across restarts |

### Administrative fields

| Variable | Default | Description |
|---|---|---|
| `DESCRIPTION_FIELD` | `fields_16` | `accountinfo` column used as free-text description (editable in asset detail) |
| `SERVER_TYPE_FIELD` | `fields_6` | `accountinfo` column used to detect if an asset is a server |
| `SERVER_TYPE_PATTERN` | `serv\|server` | Regex pattern to match server values in `SERVER_TYPE_FIELD` |
| `ADMIN_FIELDS_FILE` | — | Optional path to a JSON file with admin field definitions (overrides auto-detection) |

---

## Authentication (SSO)

The console uses **OIDC/OAuth2** for authentication. Out of the box, it uses `@azure/msal-node` for **Microsoft Entra ID** (Azure AD). The auth flow is a standard authorization code flow:

1. User clicks "Sign in with SSO"
2. Browser redirects to the IdP login page
3. After authentication, the IdP redirects back to `${BASE_URL}/auth/callback`
4. The BFF validates the token and checks group membership
5. A session cookie is set; subsequent requests are authenticated

### Microsoft Entra ID (Azure AD)

1. Go to [Entra ID → App registrations → New registration](https://entra.microsoft.com)
2. Name: `OCS Console`
3. Supported account types: Single tenant (or multi-tenant if needed)
4. Redirect URI: `Web` → `https://ocs-console.example.com/auth/callback`
5. Under **API permissions**, add `Microsoft Graph → Delegated → User.Read`
6. Under **Certificates & secrets**, create a client secret
7. Under **Token configuration**, add group claim: `Groups assigned to the application` (or `SecurityGroup`)
8. Create a security group (e.g. `OCS_Console_Users`) and add the users who should have access
9. Fill in `.env`:
   ```env
   TENANT_ID=your-tenant-id          # from Overview → Directory (tenant) ID
   CLIENT_ID=your-client-id          # from Overview → Application (client) ID
   CLIENT_SECRET=your-client-secret  # from Certificates & secrets
   AUTHORIZED_GROUP_ID=group-id      # from the group's Object ID
   ```

### Other OIDC providers (Keycloak, Authentik, Google, etc.)

The BFF uses `@azure/msal-node` for Entra ID. To use a generic OIDC provider, replace the MSAL integration in `server/server.js` with [`openid-client`](https://github.com/panva/node-openid-client). The auth flow structure (login/callback/logout/me) stays the same — only the library calls change.

Key endpoints to adapt:
- `/auth/login` — redirect to IdP authorization endpoint
- `/auth/callback` — exchange code for tokens, validate, check group
- `/auth/logout` — clear session, redirect to IdP logout
- `/auth/me` — return current user info

---

## Administrative fields

The console displays and edits OCS **administrative fields** (the `accountinfo` table — custom fields like company, cost center, owner, etc.).

### Automatic mode (default)

If `ADMIN_FIELDS_FILE` is not set, the console loads field definitions from the OCS `accountinfo_config` table at startup. This means:

- Fields you defined in the OCS classic console (`/ocsreports`) appear automatically
- Labels match what you configured in OCS
- New fields added in OCS are picked up on container restart

### Manual mode (JSON file)

To override, create a JSON file and set `ADMIN_FIELDS_FILE`:

```json
[
  {"key": "TAG", "label": "TAG"},
  {"key": "fields_3", "label": "Company"},
  {"key": "fields_4", "label": "User"},
  {"key": "fields_5", "label": "Owner"},
  {"key": "fields_6", "label": "Type"},
  {"key": "fields_7", "label": "Cost"},
  {"key": "fields_8", "label": "Cost Center"},
  {"key": "fields_10", "label": "Business Line"}
]
```

Mount the file into the container and set the env var:

```yaml
# docker-compose.yml — add under the console service:
volumes:
  - ./admin-fields.json:/app/admin-fields.json:ro
environment:
  - ADMIN_FIELDS_FILE=/app/admin-fields.json
```

### Server detection

The console classifies assets as "server" or "workstation" for filtering and statistics. By default:

- It checks the `SERVER_TYPE_FIELD` (default: `fields_6`, the "Type" field in `accountinfo`)
- If the value matches `SERVER_TYPE_PATTERN` (default: `serv|server`), it's a server
- Fallback: if the OS name contains "Server", "Linux", "CentOS", "Ubuntu", or "Debian", it's also classified as a server

To customize, set `SERVER_TYPE_FIELD` and `SERVER_TYPE_PATTERN` in `.env`.

---

## Reverse proxy (HTTPS)

For production, run the console behind a reverse proxy with TLS. The OIDC redirect URI requires HTTPS.

### nginx example

```nginx
server {
    listen 443 ssl http2;
    server_name ocs-console.example.com;

    ssl_certificate     /etc/ssl/certs/ocs-console.crt;
    ssl_certificate_key /etc/ssl/private/ocs-console.key;

    # Security headers (the BFF also sets these, but the proxy should too)
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
    }
}
```

### Port mapping

The default `docker-compose.yml` maps `8080:3000`. To restrict access to only the proxy (recommended), bind to localhost:

```yaml
ports:
  - "127.0.0.1:8080:3000"
```

---

## Optional OCS plugins

The console gracefully handles optional OCS plugin tables — if a plugin is not installed, the corresponding UI section simply doesn't render (no errors, no broken pages).

| Plugin | Table | What it shows |
|---|---|---|
| **BitLocker** | `bitlockerstatus` | Disk encryption status in the asset detail page |
| **SQL Server** | `sqlserver_instances` | SQL Server instances report with edition filter |
| **Windows Updates** | `windows_updates` | Windows update status (last KB, pending count) |
| **Linux Updates** | `linux_updates` | Linux package update status |

### Installing plugins in OCS

OCS plugins have three parts (server-side Perl, database table, and agent script). See the [OCS Inventory documentation](https://wiki.ocsinventory-ng.org/) for details. The console only needs the **database table** to exist — it reads from it. The agent-side script populates the table during inventory.

Quick example for the SQL Server plugin:

1. Create the table in the OCS database:
   ```sql
   CREATE TABLE IF NOT EXISTS sqlserver_instances (
     ID INT AUTO_INCREMENT PRIMARY KEY,
     HARDWARE_ID INT NOT NULL,
     NAME VARCHAR(255),
     EDITION VARCHAR(255),
     VERSION VARCHAR(255),
     PATCH VARCHAR(255)
   );
   ```

2. Install the server-side Perl `Map.pm` in the OCS container
3. Deploy the agent script to the machines you want to inventory
4. Restart the console — the SQL Server report appears automatically

---

## Security

The console is built with security in mind:

- **Authentication** — OIDC/OAuth2 with group-based authorization; no unauthenticated access to `/api/*`
- **SQL injection** — all queries use parameterized statements via `mysql2`
- **CSP** — Content-Security-Policy via `helmet` (no inline scripts)
- **Rate limiting** — 600 requests / 5 min on `/api`, 40 requests / 15 min on `/auth`
- **Session store** — sessions persisted in MariaDB (survive restarts), cookies `secure` + `httpOnly` + `sameSite`
- **Container hardening** — runs as non-root (`USER node`), read-only filesystem, all Linux capabilities dropped, `no-new-privileges`
- **No secrets in code** — all credentials via environment variables; `.env` is gitignored

### Security recommendations

1. **Always use HTTPS** in production (via reverse proxy)
2. **Restrict database access** — the console user should only have access to `ocsweb.*`, not `*.*`
3. **Set `SESSION_SECRET`** to a random string (otherwise sessions don't survive restarts)
4. **Review the OIDC group** — only members of `AUTHORIZED_GROUP_ID` can access the console
5. **Firewall the container port** — bind `8080` to `127.0.0.1` and expose only via reverse proxy

---

## Troubleshooting

### The page loads but shows "no data" or empty lists

- Check `GET /api/health` returns `{"ok":true}` — if not, the BFF can't connect to the database
- Verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS` in `.env`
- Ensure the database user has `SELECT` on `ocsweb.*`
- Check network connectivity from the container to the database host

### Login fails or redirects to an error page

- Verify `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET` are correct
- Ensure `BASE_URL` matches the URL you're accessing the console from (the redirect URI is `${BASE_URL}/auth/callback`)
- Check that the redirect URI is registered in your OIDC app registration
- Verify the user is a member of the `AUTHORIZED_GROUP_ID` group
- For Entra ID: ensure `groupMembershipClaims` includes `SecurityGroup` in the app manifest

### "Could not complete login" error

- Check the BFF logs: `docker logs ocs-console`
- Common cause: `CLIENT_SECRET` expired or incorrect
- For Entra ID: verify the app registration's API permissions include `User.Read`

### Asset detail page is missing sections (BitLocker, SQL Server, etc.)

- These sections require optional OCS plugin tables — see [Optional OCS plugins](#optional-ocs-plugins)
- If the table doesn't exist, the section is hidden (by design)

### Dark mode doesn't persist

- The theme is saved in `localStorage` under the key `ocs-theme`
- If localStorage is blocked (private browsing, strict CSP), the theme resets on reload

### `docker compose up` fails to build

- Ensure Docker has enough memory (the Angular build is memory-intensive)
- Try building separately: `docker compose build --progress=plain` then `docker compose up -d`
- Check the build log for specific errors

---

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Angular 18 (standalone components, Angular Material) |
| **Backend** | Node.js 22+ / Express 4 (ESM) |
| **Database** | MariaDB / MySQL via `mysql2` |
| **Auth** | `@azure/msal-node` (Microsoft Entra ID / OIDC) |
| **Security** | `helmet`, `express-rate-limit`, `express-mysql-session` |
| **Container** | Docker multi-stage, read-only, non-root, `cap_drop: ALL` |

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development setup

```bash
# Install dependencies
cd web && npm install && cd ../server && npm install

# Start BFF (terminal 1)
cd server && npm start

# Start Angular dev server (terminal 2)
cd web && npm start
# Open http://localhost:4200
```

### Code style

- TypeScript strict mode
- Angular standalone components (no NgModules)
- ESM modules in the BFF (`"type": "module"`)
- No inline styles in HTML templates (use `styles: []` in the component)

---

## License

[MIT](LICENSE) — feel free to use, modify, and distribute.
