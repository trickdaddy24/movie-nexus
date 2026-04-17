#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date '+%Y-%m-%d')
DAY_OF_WEEK=$(date '+%u')
CONTAINER="movienexus-db"
DB_NAME="movienexus"
DB_USER="postgres"

mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "Starting backup..."

if ! docker inspect "$CONTAINER" > /dev/null 2>&1; then
    log "ERROR: Container $CONTAINER not found"
    exit 1
fi

BACKUP_FILE="$BACKUP_DIR/movienexus_${DATE}.sql.gz"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Database backed up to $BACKUP_FILE ($SIZE)"

cp "$PROJECT_DIR/.env" "$BACKUP_DIR/env_backup_${DATE}" 2>/dev/null && \
    log "Production .env backed up" || \
    log "WARNING: Could not backup .env file"

# Weekly backup: keep Sunday dumps in a separate naming pattern
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    WEEKLY_FILE="$BACKUP_DIR/movienexus_weekly_${DATE}.sql.gz"
    cp "$BACKUP_FILE" "$WEEKLY_FILE"
    log "Weekly backup saved: $WEEKLY_FILE"
fi

# Retention: delete daily backups older than 7 days
find "$BACKUP_DIR" -name "movienexus_[0-9]*.sql.gz" -not -name "*weekly*" -mtime +7 -delete 2>/dev/null && \
    log "Cleaned up daily backups older than 7 days" || true

# Retention: delete weekly backups older than 30 days
find "$BACKUP_DIR" -name "movienexus_weekly_*.sql.gz" -mtime +30 -delete 2>/dev/null && \
    log "Cleaned up weekly backups older than 30 days" || true

# Retention: delete old .env backups older than 30 days
find "$BACKUP_DIR" -name "env_backup_*" -mtime +30 -delete 2>/dev/null || true

log "Backup complete"
