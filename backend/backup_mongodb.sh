#!/bin/bash
# LOTTOLAB MongoDB Backup Script
# Run daily via cron: 0 2 * * * /var/www/lottolab/backend/backup_mongodb.sh

set -e

# Configuration
BACKUP_DIR="/var/backups/lottolab/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Load environment variables
source /var/www/lottolab/backend/.env

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

echo "[$DATE] Starting MongoDB backup..."

# Perform backup
mongodump --uri="$MONGO_URL" --out="$BACKUP_DIR/$DATE" --gzip

# Verify backup
if [ -d "$BACKUP_DIR/$DATE" ]; then
    echo "[$DATE] Backup completed successfully"
    
    # Create a compressed archive
    tar -czf "$BACKUP_DIR/lottolab_backup_$DATE.tar.gz" -C "$BACKUP_DIR" "$DATE"
    rm -rf "$BACKUP_DIR/$DATE"
    
    echo "[$DATE] Archive created: lottolab_backup_$DATE.tar.gz"
else
    echo "[$DATE] ERROR: Backup failed!"
    exit 1
fi

# Cleanup old backups
echo "[$DATE] Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "lottolab_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete

# List remaining backups
echo "[$DATE] Current backups:"
ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "No backups found"

echo "[$DATE] Backup process completed"
