#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="tomto"
REMOTE_HOST="gbg.tom.to"
REMOTE_PATH="/home/tomto/gbg.tom.to/"
REMOTE="${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
RSYNC_OPTS="-avz --partial --exclude=.env* --no-perms --chmod=Do+rx,Fo+r --force --modify-window=2"
RSYNC_SSH="ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=4"
STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/glassbeadgame-deploy.XXXXXX")"
trap 'rm -rf "$STAGING_DIR"' EXIT

if [ ! -d ".next/standalone" ]; then
  echo "Missing .next/standalone. Run npm run build first."
  exit 1
fi

echo "Staging deploy bundle..."

rsync $RSYNC_OPTS --delete \
  .next/standalone/ \
  "$STAGING_DIR/"

mkdir -p "$STAGING_DIR/.next/static" "$STAGING_DIR/public"

rsync $RSYNC_OPTS --delete \
  .next/static/ \
  "$STAGING_DIR/.next/static/"

rsync $RSYNC_OPTS --delete \
  public/ \
  "$STAGING_DIR/public/"

install -m 755 scripts/start-dreamhost.sh "$STAGING_DIR/start.sh"

echo "Deploying staged bundle to ${REMOTE} ..."

rsync $RSYNC_OPTS --delete \
  -e "$RSYNC_SSH" \
  "$STAGING_DIR/" \
  "${REMOTE}/"

echo "Done."
