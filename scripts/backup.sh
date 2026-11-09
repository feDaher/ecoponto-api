#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${MYSQL_CONTAINER:-ecoponto-mysql}"
DATABASE="${BACKUP_DATABASE:-ecoponto}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

if [[ ! "$DATABASE" =~ ^[A-Za-z0-9_]{1,64}$ ]]; then
  echo "Erro: nome de banco inválido: $DATABASE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/${DATABASE}_$(date +%Y-%m-%d_%H-%M-%S).sql.gz"
PARTIAL_FILE="$BACKUP_FILE.partial"
trap 'rm -f "$PARTIAL_FILE"' EXIT

echo "Iniciando backup do banco $DATABASE (container $CONTAINER)..."

docker exec "$CONTAINER" sh -c '
  MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot \
    --single-transaction --routines --triggers --events \
    --set-gtid-purged=OFF --no-tablespaces "$1"
' sh "$DATABASE" | gzip > "$PARTIAL_FILE"

gzip -t "$PARTIAL_FILE"
if ! gzip -dc "$PARTIAL_FILE" | tail -n 1 | grep -q "Dump completed"; then
  echo "Erro: o dump está incompleto; nenhum backup foi gravado." >&2
  exit 1
fi

mv "$PARTIAL_FILE" "$BACKUP_FILE"
echo "Backup criado: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

echo "Removendo backups com mais de $RETENTION_DAYS dias..."
find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DATABASE}_*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete
echo "Concluído."
