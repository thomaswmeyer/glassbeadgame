#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="phoam"
REMOTE_HOST="tom.to"
REMOTE_PATH="/home/phoam/tom.to/glassbeadgame/"
REMOTE="${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
RSYNC_OPTS="-avz --no-perms --chmod=Do+rx,Fo+r --force --modify-window=2"

SOCKET="/tmp/deploy-glassbeadgame-$$"
trap 'ssh -O exit -o ControlPath="$SOCKET" "${REMOTE_USER}@${REMOTE_HOST}" 2>/dev/null; rm -f "$SOCKET"' EXIT

if [ ! -d ".next/standalone" ]; then
  echo "Missing .next/standalone. Run npm run build first."
  exit 1
fi

echo "Opening SSH connection..."
ssh -fNM -o ControlMaster=yes -o ControlPath="$SOCKET" "${REMOTE_USER}@${REMOTE_HOST}"

RSYNC_SSH="ssh -o ControlPath=$SOCKET"

echo "Deploying to ${REMOTE} ..."

rsync $RSYNC_OPTS --delete --size-only \
  -e "$RSYNC_SSH" \
  .next/standalone/ \
  "${REMOTE}/"

rsync $RSYNC_OPTS --delete --size-only \
  -e "$RSYNC_SSH" \
  .next/static/ \
  "${REMOTE}/.next/static/"

rsync $RSYNC_OPTS --delete \
  -e "$RSYNC_SSH" \
  public/ \
  "${REMOTE}/public/"

echo "Done."
