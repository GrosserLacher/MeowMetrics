#!/usr/bin/env bash
# Rauchtest der Oberfläche: startet einen Server mit leerer Datenbank, lädt die App in jsdom und klickt durch.
# Voraussetzungen: Node 20+, Python mit den Paketen aus requirements.txt. Aufruf: bash tests/frontend/run.sh
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
[ -d node_modules ] || npm install --no-audit --no-fund
export DATA_DIR="$(mktemp -d)"
(cd "$ROOT" && CORS_ORIGINS=https://localhost exec python3 -m uvicorn app.main:app --port 8123 --log-level warning) &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -sf http://127.0.0.1:8123/api/auth/status >/dev/null && break; sleep 0.5; done
node smoke.js
node appshell.js
node bundled.js
