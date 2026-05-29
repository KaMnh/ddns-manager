# DDNS Manager — a GUI for [qdm12/ddns-updater](https://github.com/qdm12/ddns-updater)

[![CI](https://github.com/KaMnh/ddns-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/KaMnh/ddns-manager/actions/workflows/ci.yml)

> Một GUI đơn giản để **cấu hình & quản lý record** cho `ddns-updater` và xem trạng thái — chạy cạnh ddns-updater, đọc/ghi trực tiếp `config.json`.

A small web app that runs **alongside** ddns-updater. It gives you a form-based editor for DNS records (no hand-editing JSON) and a status dashboard.

## Why this exists

ddns-updater is **config-file driven**: records live in `config.json` and are loaded **only at startup**. Its HTTP server exposes just three routes — `GET /` (status page), `GET /update` (force a refresh of already-loaded records), and static assets. There is **no API to add/edit/delete records**.

So this GUI:

- reads & writes `config.json` directly (on a shared volume),
- shows live status by reading `updates.json`,
- triggers a refresh by proxying ddns-updater's `GET /update`.

> ⚠️ **Adding, editing, or removing a record requires restarting ddns-updater** for it to take effect — ddns-updater only reads `config.json` at startup. **Force refresh** only re-checks the IPs of records that are *already* loaded. The UI shows a banner reminding you to restart after changes.

## Features (scope)

- **Records** — add / edit / delete records with provider-aware forms and inline validation.
- **Dashboard** — current IP + last-update time per record (from `updates.json`), online/pending status. Records are **grouped by root domain**, so many domains (e.g. several Cloudflare zones) stay easy to tell apart.
- **Force refresh** — button that calls ddns-updater's `/update`.
- **Secret safety** — tokens/passwords are masked in API responses; editing without revealing keeps the stored value. Files are written atomically with a `.bak` backup, and records/fields the GUI doesn't understand are preserved untouched.
- Providers with detailed forms: **Cloudflare, DuckDNS, No-IP, GoDaddy, Namecheap, Porkbun** (others still work via a generic editor).

Out of scope: global settings UI (PERIOD, IP fetchers…), notifications/health config, and one-click container restart.

## Architecture

```
Browser ──▶ ddns-updater-gui (Fastify)
                ├─ serves the built React app
                └─ /api/* : records CRUD, /api/status, /api/refresh
                       │ read/write
                       ▼
        shared volume:  config.json  +  updates.json
                       ▲ read (at startup)
        ddns-updater ──┘   ◀── GET /update (force refresh)
```

- **Backend**: Node + Fastify + TypeScript.
- **Frontend**: React + Vite + Tailwind CSS.

## Quick start (Docker Compose)

```bash
# 1. ddns-updater needs an initial config.json to start:
mkdir -p data && echo '{"settings":[]}' > data/config.json

# 2. bring up ddns-updater + the GUI (they share ./data)
docker compose -f docker-compose.example.yml up -d --build

# 3. open the GUI
#    http://localhost:8080
#
# 4. add records, then apply them:
docker compose -f docker-compose.example.yml restart ddns-updater
```

## Run from the published image (GHCR)

```bash
docker pull ghcr.io/kamnh/ddns-manager:latest   # or pin a version: :0.1.0
```

In [docker-compose.example.yml](docker-compose.example.yml), swap `build: .` for
`image: ghcr.io/kamnh/ddns-manager:latest`. The image is published by CI on every `v*` tag.

> If the package is private, make it public in its package settings, or `docker login ghcr.io` with a token that has `read:packages` before pulling.

## Local development

```bash
# backend (terminal 1) — point it at a data dir with config.json/updates.json
cd backend && npm install
DATA_DIR=../sample-data DDNS_UPDATER_URL=http://localhost:8000 npm run dev   # :8080

# frontend (terminal 2) — proxies /api to :8080
cd frontend && npm install && npm run dev                                    # :5173

# backend tests
cd backend && npm test
```

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Port the GUI listens on |
| `DATA_DIR` | `/data` | Directory holding `config.json` + `updates.json` (shared with ddns-updater) |
| `CONFIG_FILE` | `$DATA_DIR/config.json` | Override the config path |
| `UPDATES_FILE` | `$DATA_DIR/updates.json` | Override the updates path |
| `DDNS_UPDATER_URL` | `http://ddns-updater:8000` | ddns-updater base URL (for Force refresh) |
| `STATIC_DIR` | `/app/public` | Built frontend directory |
| `GUI_USERNAME` / `GUI_PASSWORD` | _(unset)_ | Enable HTTP basic auth when both are set |

## Security

The GUI reads and edits provider **credentials**. When exposing it beyond localhost, set `GUI_USERNAME`/`GUI_PASSWORD` (basic auth) and/or run it behind a reverse proxy with TLS. Secrets are never logged and are masked in API responses.

## Project structure

```
backend/   Fastify API — configStore, providers, validation, routes (records/status/refresh)
frontend/  React UI — Dashboard, Records, dynamic provider form
sample-data/  example config.json + updates.json for local dev
Dockerfile, docker-compose.example.yml
```
