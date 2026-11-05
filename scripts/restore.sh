
#!/bin/bash

# Configurações
CONTAINER="ecoponto-mysql"
DATABASE="ecoponto_teste"
BACKUP_FILE="$1"

# Verifica se o backup foi informado
if [ -z "$BACKUP_FILE" ]; then
    echo "Uso: bash scripts/restore.sh caminho/do/backup.sql.gz"
    exit 1
fi

# Verifica se o arquivo existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Erro: arquivo de backup não encontrado!"
    exit 1
fi

echo "Criando banco de teste..."

docker exec "$CONTAINER" mysql -uroot -proot \
    -e "CREATE DATABASE IF NOT EXISTS $DATABASE;"

echo "Restaurando backup no banco $DATABASE..."

gzip -dc "$BACKUP_FILE" | docker exec -i "$CONTAINER" \
    mysql -uroot -proot "$DATABASE"

if [ $? -eq 0 ]; then
    echo "Restauração concluída com sucesso!"
else
    echo "Erro durante a restauração!"
    exit 1
fi
