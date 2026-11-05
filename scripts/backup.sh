
#!/bin/bash

# Configurações do backup
CONTAINER="ecoponto-mysql"
DATABASE="ecoponto"
BACKUP_DIR="backups"
RETENTION_DAYS=30

# Cria a pasta de backups, caso não exista
mkdir -p "$BACKUP_DIR"

# Nome do arquivo com data e hora
DATE=$(date +"%Y-%m-%d_%H-%M-%S" 2>/dev/null || powershell.exe -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'")
BACKUP_FILE="$BACKUP_DIR/${DATABASE}_${DATE}.sql.gz"

echo "Iniciando backup do banco $DATABASE..."

# Realiza o backup e compacta o arquivo
docker exec "$CONTAINER" sh -c \
  'exec mysqldump -uroot -proot --single-transaction ecoponto' \
  | gzip > "$BACKUP_FILE"

# Verifica se o backup foi criado
if [ $? -eq 0 ]; then
    echo "Backup criado com sucesso: $BACKUP_FILE"
else
    echo "Erro ao criar backup!"
    exit 1
fi

# Remove backups com mais de 30 dias
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Limpeza de backups antigos concluída."