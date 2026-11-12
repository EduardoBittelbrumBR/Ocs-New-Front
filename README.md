# ocs-console

A modern web console for [OCS Inventory NG](https://www.ocsinventory-ng.org/) — search, browse, and export your IT asset inventory with a clean, responsive UI.

Built with **Angular 18** + **Node/Express BFF** in a single Docker container, reading directly from the OCS MariaDB database.

## Features

- **Dashboard** — KPIs, charts (by OS, by company, by type, by freshness), recent/stale asset lists
- **Asset list** — searchable, sortable, paginated table with freshness chips; filter by servers/workstations; CSV export
- **Asset detail** — full hardware/software summary, editable administrative fields, disk usage, network, BitLocker status, SQL Server instances
- **Software** — aggregated software inventory with publisher, versions, install count
- **Reports** — pre-filtered shortcuts (recently added, stale, by type)
- **SQL Server** — instances report with edition filter (requires the `sqlserver_instances` plugin)
- **Updates** — Windows/Linux update status report (requires the `windows_updates`/`linux_updates` plugins)
- **Dark mode** — light/dark theme with system preference detection
- **SSO** — OIDC authentication (Microsoft Entra ID out of the box) with group-based authorization
- **Configurable** — administrative field labels, server-type detection, and description field are all configurable via environment variables

## Quick start (Docker)

```bash
# 1. Copy and edit the environment file
cp .env.example .env
# Fill in: DB credentials, OIDC tenant/client/group IDs, BASE_URL

# 2. Build and run
docker compose up -d --build

# 3. Access
# http://localhost:8080 (or your BASE_URL via reverse proxy)
```

The container expects the OCS Inventory MariaDB database to be reachable at `DB_HOST:DB_PORT`. If OCS runs on the same host, use `host.docker.internal` (already the default).

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `host.docker.internal` | MariaDB/MySQL host |
| `DB_PORT` | `3306` | Database port |
| `DB_USER` | `ocs` | Database user (needs SELECT on `ocsweb.*`) |
| `DB_PASS` | — | Database password |
| `DB_NAME` | `ocsweb` | OCS database name |
| `PORT` | `3000` | BFF listen port (container internal) |
| `CACHE_TTL` | `60` | Cache TTL in seconds for list/stats queries |
| `AUTH_ENABLED` | `true` | Enable OIDC authentication |
| `TENANT_ID` | — | OIDC tenant ID (Entra ID) |
| `CLIENT_ID` | — | OIDC client (app) ID |
| `CLIENT_SECRET` | — | OIDC client secret |
| `BASE_URL` | — | Public URL (used for OIDC redirect) |
| `AUTHORIZED_GROUP_ID` | — | Security group ID required for access |
| `SESSION_SECRET` | random | Session signing secret (set for persistent sessions) |
| `DESCRIPTION_FIELD` | `fields_16` | accountinfo column used as free-text description |
| `SERVER_TYPE_FIELD` | `fields_6` | accountinfo column used to detect servers |
| `SERVER_TYPE_PATTERN` | `serv\|server` | Regex pattern to match server values |
| `ADMIN_FIELDS_FILE` | — | Optional JSON file with admin field definitions |

### Administrative fields

The console automatically loads administrative field labels from the OCS `accountinfo_config` table. To override, set `ADMIN_FIELDS_FILE` to a JSON file:

```json
[
  {"key": "TAG", "label": "TAG"},
  {"key": "fields_3", "label": "Company"},
  {"key": "fields_6", "label": "Type"}
]
```

## Development

```bash
# Install dependencies
cd web && npm install
cd ../server && npm install

# Run Angular dev server (port 4200)
cd web && npm start

# Run BFF (port 3000) — serves the API, proxies to Angular in dev
cd server && npm start
```

The Angular dev server proxies `/api` and `/auth` requests to the BFF at `localhost:3000`.

## Architecture

```
Browser → [Reverse proxy / HTTPS] → ocs-console container (8080→3000)
                                        ├── Angular 18 SPA (static files)
                                        └── Node/Express BFF (API)
                                              └── MariaDB (ocsweb) via mysql2
```

Single Docker container with a multi-stage build:
1. **Build stage** — compiles the Angular app with `ng build`
2. **Runtime stage** — Node/Express serves the static Angular files + the REST API

Security hardening: helmet CSP, rate limiting, MySQL session store, non-root container, read-only filesystem, all capabilities dropped.

## Optional OCS plugins

The console gracefully handles optional OCS plugin tables — if a plugin is not installed, the corresponding UI section simply doesn't render:

- **BitLocker** (`bitlockerstatus` table) — disk encryption status in the asset detail
- **SQL Server** (`sqlserver_instances` table) — SQL Server instances report
- **Windows Updates** (`windows_updates` table) — update status report
- **Linux Updates** (`linux_updates` table) — update status report

## Tech stack

- **Frontend:** Angular 18 (standalone components, Angular Material)
- **Backend:** Node.js 22 + Express 4 (ESM)
- **Database:** MariaDB / MySQL via `mysql2`
- **Auth:** `@azure/msal-node` (Microsoft Entra ID / OIDC)
- **Security:** helmet, express-rate-limit, express-mysql-session
- **Container:** Docker multi-stage, read-only, non-root

## License

[MIT](LICENSE)
