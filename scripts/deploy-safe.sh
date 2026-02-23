#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-buy-alert-bot-all}"
APP_DIR="${APP_DIR:-$(pwd)}"
API_BASE="${API_BASE:-http://127.0.0.1:8787}"
HEALTH_URL="${HEALTH_URL:-${API_BASE}/healthz}"
READY_URL="${READY_URL:-${API_BASE}/readyz}"
WAIT_SECONDS="${WAIT_SECONDS:-90}"
ROLLBACK_CMD="${ROLLBACK_CMD:-}"

echo "[deploy-safe] app=${APP_NAME} dir=${APP_DIR}"
cd "${APP_DIR}"

PREVIOUS_COMMIT="$(git rev-parse HEAD)"
echo "[deploy-safe] current=${PREVIOUS_COMMIT}"

git pull --ff-only
NEW_COMMIT="$(git rev-parse HEAD)"
echo "[deploy-safe] updated=${NEW_COMMIT}"

npm ci
npm test

pm2 restart "${APP_NAME}" --update-env

echo "[deploy-safe] waiting for health checks"
curl -fsS "${HEALTH_URL}" >/dev/null

deadline=$((SECONDS + WAIT_SECONDS))
ready_ok=0
while (( SECONDS < deadline )); do
  if curl -fsS "${READY_URL}" >/dev/null; then
    ready_ok=1
    break
  fi
  sleep 3
done

if (( ready_ok == 1 )); then
  echo "[deploy-safe] success: readyz ok"
  exit 0
fi

echo "[deploy-safe] readyz failed after ${WAIT_SECONDS}s"

if [[ -n "${ROLLBACK_CMD}" ]]; then
  echo "[deploy-safe] running rollback command"
  bash -lc "${ROLLBACK_CMD}"
else
  echo "[deploy-safe] rollback command not configured"
  echo "[deploy-safe] previous commit: ${PREVIOUS_COMMIT}"
fi

exit 1
