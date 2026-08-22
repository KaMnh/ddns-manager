# DDNS Manager — a GUI for [qdm12/ddns-updater](https://github.com/qdm12/ddns-updater)

[![CI](https://github.com/KaMnh/ddns-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/KaMnh/ddns-manager/actions/workflows/ci.yml)

> Một GUI đơn giản để **cấu hình & quản lý record** cho `ddns-updater` và xem trạng thái — chạy cạnh ddns-updater, đọc/ghi trực tiếp `config.json`.

A small web app that runs **alongside** ddns-updater. It gives you a form-based editor for DNS records (no hand-editing JSON) and a status dashboard.

## Why this exists

ddns-updater is **config-file driven**: records live in `config.json` and are loaded **only at startup**. Its HTTP server exposes just three routes — `GET /` (status page), `GET /update` (force a refresh of already-loaded records), and static assets. There is **no API to add/edit/delete records**.

So this GUI:

- reads & writes `config.json` directly (on a shared volume),
- shows live status by reading `updates.json`,
- triggers a refresh by proxying ddns-updater's `GET /update`,
- **restarts the ddns-updater container** — the only way to apply new records — via the Docker API.

> ⚠️ **Adding, editing, or removing a record only takes effect after ddns-updater restarts**, because it reads `config.json` at startup. **Force refresh** just re-checks the IPs of records that are *already* loaded. After a change the UI shows a banner with a **Restart & apply** button that does the restart for you; if the GUI can't reach Docker, the banner falls back to the `docker compose restart ddns-updater` command instead.

## Features (scope)

- **Records** — add / edit / delete records with provider-aware forms and inline validation.
- **Dashboard** — current IP + last-update time per record (from `updates.json`), online/pending status. Records are **grouped by root domain**, so many domains (e.g. several Cloudflare zones) stay easy to tell apart.
- **Force refresh** — button that calls ddns-updater's `/update` (re-checks IPs of loaded records).
- **Restart & apply** — one-click restart of the ddns-updater container, so records you just added/edited/removed go live. Restarts exactly the one container named by `DDNS_UPDATER_CONTAINER` — never one named by the request — and self-disables with an explanation when the Docker socket isn't reachable.
- **Secret safety** — tokens/passwords are masked in API responses; editing without revealing keeps the stored value. Files are written atomically with a `.bak` backup, and records/fields the GUI doesn't understand are preserved untouched.
- Providers with detailed forms: **Cloudflare, DuckDNS, No-IP, GoDaddy, Namecheap, Porkbun** (others still work via a generic editor).

Out of scope: global settings UI (PERIOD, IP fetchers…) and notifications/health config.

## Architecture

```
Browser ──▶ ddns-updater-gui (Fastify)
                ├─ serves the built React app
                └─ /api/* : records CRUD, /api/status, /api/refresh, /api/restart
                       │ read/write                              │
                       ▼                                         ▼
        shared volume:  config.json  +  updates.json      docker.sock
                       ▲ read (at startup)                       │ POST /containers/ddns-updater/restart
        ddns-updater ──┘   ◀── GET /update (force refresh)  ◀────┘
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
# 4. add records, then apply them with the "Restart & apply" button in the UI
#    (or, if you didn't mount the Docker socket, by hand:)
docker compose -f docker-compose.example.yml restart ddns-updater
```

### Enabling "Restart & apply"

The GUI restarts ddns-updater through the Docker API, so it needs the socket:

```yaml
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      DDNS_UPDATER_CONTAINER: ddns-updater
```

Prefer not to hand over the whole socket? Point the GUI at a
[docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy) with only `CONTAINERS=1` and
`POST=1` instead, via `DOCKER_HOST: tcp://docker-proxy:2375` — see the commented block at the bottom
of [docker-compose.example.yml](docker-compose.example.yml). Without either, everything else keeps
working and the UI tells you to run `docker compose restart ddns-updater` yourself.

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
| `DDNS_UPDATER_CONTAINER` | `ddns-updater` | Container restarted by **Restart & apply**; empty disables it |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Docker socket used for the restart |
| `DOCKER_HOST` | _(unset)_ | Use a `tcp://host:port` Docker endpoint (e.g. a socket proxy) instead of the socket |
| `RESTART_STOP_TIMEOUT` | `10` | Seconds ddns-updater gets to stop before Docker kills it |
| `STATIC_DIR` | `/app/public` | Built frontend directory |
| `GUI_USERNAME` / `GUI_PASSWORD` | _(unset)_ | Enable HTTP basic auth when both are set |

## Security

The GUI reads and edits provider **credentials**. When exposing it beyond localhost, set `GUI_USERNAME`/`GUI_PASSWORD` (basic auth) and/or run it behind a reverse proxy with TLS. Secrets are never logged and are masked in API responses.

Mounting `/var/run/docker.sock` grants **root-equivalent access to the host**, so anyone who can reach the GUI can reach Docker through it — always pair it with basic auth, or use the socket proxy above, or leave the socket unmounted and restart by hand. The restart endpoint itself takes no input: it can only restart the single container named by `DDNS_UPDATER_CONTAINER`.

## Project structure

```
backend/   Fastify API — configStore, providers, validation, docker, routes (records/status/refresh/restart)
frontend/  React UI — Dashboard, Records, dynamic provider form
sample-data/  example config.json + updates.json for local dev
Dockerfile, docker-compose.example.yml
```
