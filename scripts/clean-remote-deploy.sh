#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="phoam"
REMOTE_HOST="tom.to"
REMOTE_PATH="/home/phoam/tom.to/glassbeadgame"

case "$REMOTE_PATH" in
  /home/phoam/tom.to/glassbeadgame|/home/phoam/tom.to/glassbeadgame/) ;;
  *)
    echo "Refusing to clean unexpected remote path: ${REMOTE_PATH}" >&2
    exit 1
    ;;
esac

echo "Cleaning deployed files from ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/ ..."

ssh "${REMOTE_USER}@${REMOTE_HOST}" "bash -lc '
  set -euo pipefail
  target=\"${REMOTE_PATH}\"
  case \"\$target\" in
    /home/phoam/tom.to/glassbeadgame|/home/phoam/tom.to/glassbeadgame/) ;;
    *)
      echo \"Refusing to clean unexpected remote path: \$target\" >&2
      exit 1
      ;;
  esac
  mkdir -p \"\$target\"
  find \"\$target\" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
'"

echo "Done."
