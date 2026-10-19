-- Executado automaticamente pelo container MySQL apenas na PRIMEIRA inicialização.
-- Usuário usado pela réplica (mysql-replica) para ler o binlog do primário.
-- Uso exclusivo de desenvolvimento.
CREATE USER IF NOT EXISTS 'replicator'@'%' IDENTIFIED BY 'replicator_pass';
GRANT REPLICATION SLAVE ON *.* TO 'replicator'@'%';
FLUSH PRIVILEGES;
