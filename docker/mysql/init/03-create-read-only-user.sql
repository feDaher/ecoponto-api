-- Executado automaticamente pelo container MySQL apenas na PRIMEIRA inicialização.
-- Usuário da API para a réplica (DATABASE_REPLICA_URL): só SELECT, então mesmo se a URL
-- for trocada por engano para o primário ele não consegue escrever. Criado no primário
-- e copiado para a réplica pela própria replicação. Uso exclusivo de desenvolvimento.
CREATE USER IF NOT EXISTS 'ecoponto_reader'@'%' IDENTIFIED BY 'SENHA_LEITURA';
GRANT SELECT ON ecoponto.* TO 'ecoponto_reader'@'%';
FLUSH PRIVILEGES;
