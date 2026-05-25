#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/tomto/gbg.tom.to"
ENV_FILE="/home/tomto/.gbg.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
else
  echo "Missing environment file: $ENV_FILE" >&2
  exit 1
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "GEMINI_API_KEY is not set after loading $ENV_FILE" >&2
  exit 1
fi

cd "$APP_DIR"

export PORT="${PORT:-4321}"
export HOSTNAME="${GBG_HOSTNAME:-0.0.0.0}"
export NODE_OPTIONS="${NODE_OPTIONS:---jitless}"

exec node --jitless server.js
