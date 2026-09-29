-- Executado automaticamente pelo container MySQL apenas na PRIMEIRA inicialização
-- (quando o volume ecoponto_mysql_data ainda está vazio).
--
-- O `prisma migrate dev` cria um "shadow database" temporário para detectar
-- divergências entre o schema e as migrations, então o usuário da aplicação
-- precisa de permissão para criar/apagar bancos. Uso exclusivo de desenvolvimento.
GRANT ALL PRIVILEGES ON *.* TO 'ecoponto_app'@'%';
FLUSH PRIVILEGES;
