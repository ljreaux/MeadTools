#!/usr/bin/env bash
# Encrypted Weblate backup. Run on the permanent Ubuntu host.
set -euo pipefail

COMPOSE_DIR=${COMPOSE_DIR:-/srv/meadtools-weblate}
CONFIG_FILE=${BACKUP_CONFIG_FILE:-"$COMPOSE_DIR/backup.env"}

if [[ ! -r "$CONFIG_FILE" ]]; then
  echo "Missing protected backup configuration: $CONFIG_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"

: "${BACKUP_SSH_HOST:?Set BACKUP_SSH_HOST in backup.env}"
: "${BACKUP_SSH_USER:?Set BACKUP_SSH_USER in backup.env}"
: "${BACKUP_REMOTE_PATH:?Set BACKUP_REMOTE_PATH in backup.env}"

BACKUP_DIR=${BACKUP_DIR:-"$COMPOSE_DIR/backups"}
STAGING_DIR="$BACKUP_DIR/staging"
RESTIC_REPOSITORY="$BACKUP_DIR/restic-repository"
SSH_DIR=${BACKUP_SSH_DIR:-"$COMPOSE_DIR/backup-ssh"}
RESTIC_IMAGE=${RESTIC_IMAGE:-restic/restic:0.19.1}
SSH_KEY="$SSH_DIR/id_ed25519"
KNOWN_HOSTS="$SSH_DIR/known_hosts"
PASSWORD_FILE="$SSH_DIR/restic-password"
WEBLATE_VOLUME=${WEBLATE_VOLUME:-meadtools-weblate_weblate-data}
CADDY_VOLUME=${CADDY_VOLUME:-meadtools-weblate_caddy-data}

for required_file in "$SSH_KEY" "$KNOWN_HOSTS" "$PASSWORD_FILE"; do
  [[ -r "$required_file" ]] || { echo "Missing backup secret: $required_file" >&2; exit 1; }
done

umask 077
mkdir -p "$STAGING_DIR" "$RESTIC_REPOSITORY"
rm -f "$STAGING_DIR/weblate.pg.dump"

cd "$COMPOSE_DIR"
docker compose exec -T database pg_dump --username weblate --format=custom weblate > "$STAGING_DIR/weblate.pg.dump"

restic() {
  docker run --rm --network none \
    -e RESTIC_PASSWORD_FILE=/secrets/restic-password \
    -v "$PASSWORD_FILE":/secrets/restic-password:ro \
    -v "$RESTIC_REPOSITORY":/repository \
    -v "$STAGING_DIR":/staging:ro \
    -v "$WEBLATE_VOLUME":/weblate-data:ro \
    -v "$CADDY_VOLUME":/caddy-data:ro \
    "$RESTIC_IMAGE" -r /repository "$@"
}

if [[ ! -f "$RESTIC_REPOSITORY/config" ]]; then
  restic init
fi

restic backup --host meadtools-weblate --tag weblate /staging /weblate-data /caddy-data
restic forget --host meadtools-weblate --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune

# The backup container writes the local repository as root. Make it readable by
# the unprivileged systemd service before rsync mirrors the encrypted files.
docker run --rm -v "$RESTIC_REPOSITORY":/repository alpine:3.21 \
  chown -R "$(id -u):$(id -g)" /repository

ssh -i "$SSH_KEY" -o UserKnownHostsFile="$KNOWN_HOSTS" -o StrictHostKeyChecking=yes \
  -o BatchMode=yes "$BACKUP_SSH_USER@$BACKUP_SSH_HOST" "mkdir -p '$BACKUP_REMOTE_PATH'"
rsync -a --delete \
  -e "ssh -i $SSH_KEY -o UserKnownHostsFile=$KNOWN_HOSTS -o StrictHostKeyChecking=yes -o BatchMode=yes" \
  "$RESTIC_REPOSITORY/" "$BACKUP_SSH_USER@$BACKUP_SSH_HOST:$BACKUP_REMOTE_PATH/"
