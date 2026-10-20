-- Executado automaticamente pelo container da réplica apenas na PRIMEIRA inicialização.
-- Aponta a réplica para o primário (replicação por GTID) e a deixa somente leitura.
-- Uso exclusivo de desenvolvimento.
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = 'mysql',
  SOURCE_PORT = 3306,
  SOURCE_USER = 'replicator',
  SOURCE_PASSWORD = 'replicator_pass',
  SOURCE_AUTO_POSITION = 1,
  SOURCE_CONNECT_RETRY = 5,
  SOURCE_RETRY_COUNT = 86400,
  GET_SOURCE_PUBLIC_KEY = 1;

START REPLICA;

-- Bloqueia escrita até para usuários com SUPER; só a thread de replicação escreve.
SET PERSIST read_only = ON;
SET PERSIST super_read_only = ON;
