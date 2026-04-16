#!/bin/bash
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "==================================="
echo "  ERP - Backup antes de Migration"
echo "==================================="
echo "Timestamp: $TIMESTAMP"
echo "Backup file: $BACKUP_FILE"
echo ""

echo "Criando backup do banco de dados..."
pg_dump "$DATABASE_URL" --no-owner --no-acl > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "Backup criado com sucesso: $BACKUP_FILE ($SIZE)"
else
  echo "ERRO: Falha ao criar backup!"
  exit 1
fi

# Manter apenas os últimos 10 backups
cd "$BACKUP_DIR"
ls -t backup_*.sql | tail -n +11 | xargs -r rm --
echo "Limpeza de backups antigos concluída."
