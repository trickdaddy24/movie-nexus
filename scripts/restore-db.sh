#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
CONTAINER="movienexus-db"
DB_NAME="movienexus"
DB_USER="postgres"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
    BACKUP_FILE=$(ls -t "$BACKUP_DIR"/movienexus_*.sql.gz 2>/dev/null | head -1)
    if [ -z "$BACKUP_FILE" ]; then
        echo "ERROR: No backup file specified and none found in $BACKUP_DIR"
        echo "Usage: $0 [backup_file.sql.gz]"
        exit 1
    fi
    log "Using latest backup: $BACKUP_FILE"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

log "Restoring from: $BACKUP_FILE"

log "Stopping backend to prevent writes..."
cd "$PROJECT_DIR"
docker compose stop backend frontend 2>/dev/null || true

log "Dropping and recreating database..."
docker exec "$CONTAINER" psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;"
docker exec "$CONTAINER" psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"

log "Restoring database..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" "$DB_NAME"

log "Restarting services..."
docker compose up -d

sleep 3
log "Verifying..."
MOVIE_COUNT=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM movies;" 2>/dev/null | tr -d ' ')
SHOW_COUNT=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM tv_shows;" 2>/dev/null | tr -d ' ')

log "Restore complete: $MOVIE_COUNT movies, $SHOW_COUNT shows"
