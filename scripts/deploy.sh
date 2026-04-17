#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"

cd "$PROJECT_DIR"

usage() {
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  main      Pull latest code, rebuild, and restart all services"
    echo "  restore   Full restore: pull, rebuild, restore DB from latest backup"
    echo "  status    Show container status and health"
    exit 1
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

wait_healthy() {
    local container=$1
    local max_wait=${2:-60}
    local elapsed=0
    log "Waiting for $container to be healthy..."
    while [ $elapsed -lt $max_wait ]; do
        status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "missing")
        if [ "$status" = "healthy" ]; then
            log "$container is healthy"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    log "WARNING: $container did not become healthy within ${max_wait}s (status: $status)"
    return 1
}

cmd_main() {
    log "Deploying MovieNexus..."

    if [ -d .git ]; then
        log "Pulling latest from GitHub..."
        git pull origin main
    else
        log "Not a git repo, skipping pull"
    fi

    log "Building containers..."
    docker compose build

    log "Starting services..."
    docker compose up -d

    wait_healthy movienexus-db
    wait_healthy movienexus-redis

    sleep 3
    log "Checking backend..."
    if curl -sf http://localhost:8910/api/health > /dev/null 2>&1; then
        log "Backend is responding"
    else
        log "WARNING: Backend not responding yet (may still be starting)"
    fi

    log "Checking frontend..."
    if curl -sf -o /dev/null http://localhost:3210/; then
        log "Frontend is responding"
    else
        log "WARNING: Frontend not responding yet (may still be starting)"
    fi

    cmd_status
    log "Deploy complete"
}

cmd_restore() {
    log "Starting full restore..."

    cmd_main

    if [ -d "$BACKUP_DIR" ]; then
        LATEST=$(ls -t "$BACKUP_DIR"/movienexus_*.sql.gz 2>/dev/null | head -1)
        if [ -n "$LATEST" ]; then
            log "Restoring database from $LATEST"
            "$SCRIPT_DIR/restore-db.sh" "$LATEST"
        else
            log "No database backups found in $BACKUP_DIR"
            log "You can re-import data via the API: POST /api/import/discover/movies?pages=1"
        fi
    else
        log "No backups directory found"
    fi

    log "Restore complete"
}

cmd_status() {
    echo ""
    echo "=== MovieNexus Status ==="
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""
}

case "${1:-}" in
    main)    cmd_main ;;
    restore) cmd_restore ;;
    status)  cmd_status ;;
    *)       usage ;;
esac
