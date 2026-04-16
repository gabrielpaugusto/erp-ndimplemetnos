#!/bin/bash
set -e

echo "==================================="
echo "  ERP - Migration de Produção"
echo "==================================="

# Verificar NODE_ENV
if [ "$NODE_ENV" != "production" ]; then
  echo "AVISO: NODE_ENV não é 'production' ($NODE_ENV)"
  read -p "Deseja continuar? (s/N): " confirm
  if [ "$confirm" != "s" ] && [ "$confirm" != "S" ]; then
    echo "Migration cancelada."
    exit 0
  fi
fi

# Backup primeiro
echo ""
echo "Passo 1: Backup do banco..."
./scripts/backup-before-migrate.sh

echo ""
echo "Passo 2: Executando migrations..."
npx prisma migrate deploy

echo ""
echo "Passo 3: Verificando status..."
npx prisma migrate status

echo ""
echo "==================================="
echo "  Migration concluída com sucesso!"
echo "==================================="
