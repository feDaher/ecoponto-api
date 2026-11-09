#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${MYSQL_CONTAINER:-ecoponto-mysql}"
BACKUP_FILE="${1:-}"
TARGET_DATABASE="${2:-ecoponto_restore}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Uso: bash scripts/restore.sh <arquivo.sql.gz> [banco_destino]" >&2
  echo "Sem banco_destino, restaura em 'ecoponto_restore' (o banco principal não é tocado)." >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Erro: arquivo de backup não encontrado: $BACKUP_FILE" >&2
  exit 1
fi

if [[ ! "$TARGET_DATABASE" =~ ^[A-Za-z0-9_]{1,64}$ ]]; then
  echo "Erro: nome de banco inválido: $TARGET_DATABASE" >&2
  exit 1
fi

if ! gzip -t "$BACKUP_FILE" 2>/dev/null || ! gzip -dc "$BACKUP_FILE" | tail -n 1 | grep -q "Dump completed"; then
  echo "Erro: o arquivo está corrompido ou o dump está incompleto: $BACKUP_FILE" >&2
  exit 1
fi

mysql_root() {
  docker exec -i "$CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$@"' sh "$@"
}

existing_tables=$(mysql_root -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$TARGET_DATABASE'")

if [ "$existing_tables" -gt 0 ]; then
  echo "ATENÇÃO: o banco '$TARGET_DATABASE' já existe com $existing_tables tabela(s) e será APAGADO e recriado."
  if [ "${RESTORE_CONFIRM:-}" != "$TARGET_DATABASE" ]; then
    if [ ! -t 0 ]; then
      echo "Erro: confirme com RESTORE_CONFIRM=$TARGET_DATABASE ao rodar sem terminal." >&2
      exit 1
    fi
    read -r -p "Digite o nome do banco para confirmar: " answer
    if [ "$answer" != "$TARGET_DATABASE" ]; then
      echo "Restauração cancelada."
      exit 1
    fi
  fi
fi

echo "Recriando o banco $TARGET_DATABASE..."
mysql_root -e "DROP DATABASE IF EXISTS \`$TARGET_DATABASE\`; CREATE DATABASE \`$TARGET_DATABASE\`"

echo "Restaurando $BACKUP_FILE em $TARGET_DATABASE..."
gzip -dc "$BACKUP_FILE" | mysql_root "$TARGET_DATABASE"

restored_tables=$(mysql_root -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$TARGET_DATABASE'")
echo "Restauração concluída: $restored_tables tabela(s) em $TARGET_DATABASE."
