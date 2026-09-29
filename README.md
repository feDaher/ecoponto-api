# EcoPonto Digital — API

Backend da plataforma **EcoPonto Digital**, sistema de mapeamento e credenciamento de pontos de coleta de resíduos recicláveis e eletrônicos.

Este guia parte do zero: clonar o projeto, instalar tudo que ele precisa e rodar localmente. Se você nunca configurou um ambiente Node.js antes, siga a ordem exata dos passos.

> Para entender a arquitetura, as regras de negócio e as decisões técnicas do projeto, veja o [CLAUDE.md](CLAUDE.md) depois de concluir este setup.

### Resumo (para quem já tem tudo instalado)

```bash
git clone https://github.com/feDaher/ecoponto-api.git
cd ecoponto-api
npm install
cp .env.example .env      # cole as credenciais do Firebase recebidas do orientador (passo 5)
npm run db:up             # sobe o MySQL no Docker
npx prisma generate       # gera o cliente Prisma
npm run db:migrate        # cria as tabelas
npm run db:seed           # cria as contas de teste (admin, coletor, cidadão)
npm run dev               # http://localhost:3333/docs
```

## 1. Pré-requisitos

Instale, na ordem:

1. **Git** — [git-scm.com/downloads](https://git-scm.com/downloads)
2. **Node.js 20 ou superior** — [nodejs.org](https://nodejs.org/) (baixe a versão LTS). Depois de instalar, confira no terminal:
   ```bash
   node --version
   npm --version
   ```
3. **Um servidor MySQL** — escolha uma das opções:
   - **Docker** (mais rápido, recomendado): [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
   - **MySQL instalado localmente**: [dev.mysql.com/downloads/installer](https://dev.mysql.com/downloads/installer/)
4. Um editor de código, como o [VS Code](https://code.visualstudio.com/).

## 2. Clonar o repositório

```bash
git clone https://github.com/feDaher/ecoponto-api.git
cd ecoponto-api
```

## 3. Instalar as dependências

```bash
npm install
```

Isso baixa tudo que está listado no `package.json` (Express, Prisma, Firebase Admin SDK, Zod, etc.) para a pasta `node_modules/`.

## 4. Subir um banco MySQL

O jeito recomendado é usar o `docker-compose.yml` que já está na raiz do projeto — ele sobe um MySQL com o banco, usuário e senha já criados, com os dados persistidos num volume (não se perdem se você desligar o container).

```bash
npm run db:up
```

Esse comando (`docker compose up -d --wait`) só retorna depois que o MySQL estiver de pé e respondendo — não precisa adivinhar quanto tempo esperar. Pra ver os logs, `npm run db:logs`; pra derrubar, `npm run db:down`.

As credenciais já vêm prontas no `docker-compose.yml`: banco `ecoponto`, usuário `ecoponto_app`, senha `SENHA`, porta `3306` (se você mudar algum desses valores no `docker-compose.yml`, reflita a mudança no `DATABASE_URL` do `.env` no passo 6).

> **Porta 3306 já em uso?** Se você tiver um MySQL local rodando na mesma porta, o `db:up` vai falhar. Troque o mapeamento de porta no `docker-compose.yml` (ex: `"3307:3306"`) e ajuste a porta no `DATABASE_URL`.

Se preferir MySQL instalado localmente (sem Docker), crie o banco e o usuário manualmente com essas mesmas credenciais (ou outras de sua escolha) usando o MySQL Workbench ou a linha de comando.

## 5. Credenciais do Firebase (compartilhadas pela turma)

O EcoPonto usa o Firebase só para autenticação (cadastro/login). **Você não precisa criar um projeto Firebase**: a turma inteira usa o projeto de desenvolvimento do orientador, e as credenciais dele são entregues **por canal privado** (nunca pelo repositório).

Você vai receber quatro valores:

| Variável                | O que é                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `FIREBASE_PROJECT_ID`   | ID do projeto Firebase                                                 |
| `FIREBASE_CLIENT_EMAIL` | E-mail da conta de serviço (Admin SDK)                                 |
| `FIREBASE_PRIVATE_KEY`  | Chave privada da conta de serviço — **dá acesso administrativo total** |
| `FIREBASE_API_KEY`      | Chave de API da Web, usada no login (diferente da chave privada)       |

Regras de segurança:

- **Nunca commite o `.env`** (ele já está no `.gitignore`), nem cole essas credenciais em issues, prints, grupos públicos ou ferramentas online.
- Não altere nada no console do Firebase: o projeto é o mesmo para todos.
- Se suspeitar que a chave vazou, avise o orientador para que ela seja trocada.

## 6. Configurar as variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Abra o `.env` criado e preencha:

```bash
DATABASE_URL="mysql://ecoponto_app:SENHA@localhost:3306/ecoponto"
PORT=3333

FIREBASE_PROJECT_ID="id-recebido"
FIREBASE_CLIENT_EMAIL="email-recebido"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_API_KEY="chave-recebida"
```

- `DATABASE_URL` já vem certo para o MySQL do Docker (passo 4). Só mude se alterou usuário/senha/porta no `docker-compose.yml`.
- Mantenha a `FIREBASE_PRIVATE_KEY` **entre aspas e numa linha só**, com os `\n` literais, exatamente como foi recebida.

## 7. Criar as tabelas no banco (Prisma)

```bash
npx prisma generate
npm run db:migrate
```

- `prisma generate` cria o cliente Prisma (código TypeScript que a API usa para falar com o banco) dentro de `src/generated/`. Precisa ser rodado toda vez que o arquivo `prisma/schema.prisma` mudar.
- `npm run db:migrate` aplica no seu MySQL as migrations que já estão em `prisma/migrations/` (cria as tabelas). Não passe `--name` aqui: isso só é usado quando você mesmo muda o schema (veja 7.1).

Se der erro de conexão aqui, revise o `DATABASE_URL` e confirme que o container do MySQL está rodando (`docker compose ps`, no caso do Docker).

### 7.1 Criando novas migrations (dia a dia)

Toda mudança de estrutura do banco (nova tabela, nova coluna, novo índice, etc.) segue este fluxo:

1. Edite o `prisma/schema.prisma` (ex: adicione um `model CollectionPoint { ... }` ou um campo novo em `User`).
2. Gere e aplique a migration com um nome descritivo, em `snake_case`:
   ```bash
   npm run db:migrate -- --name add_collection_points
   ```
   Isso cria a pasta `prisma/migrations/<timestamp>_add_collection_points/migration.sql`, aplica o SQL no seu banco local e já roda o `prisma generate`.
3. Confira o SQL gerado em `migration.sql` antes de commitar.
4. **Commite a pasta da migration junto com o `schema.prisma`**. As migrations são o histórico do banco e todo mundo do time aplica as mesmas.

Regras importantes:

- **Nunca edite nem apague uma migration que já foi commitada/aplicada.** Se errou, crie uma nova migration corrigindo.
- Depois de um `git pull` que trouxe migrations novas, rode `npm run db:migrate` (sem `--name`) para aplicá-las no seu banco local.
- `npm run db:migrate:status` mostra quais migrations já foram aplicadas.
- Em produção/homologação use `npm run db:migrate:deploy`. Ele só aplica as migrations pendentes, sem gerar novas e sem shadow database.
- Se o banco local ficar inconsistente, `npx prisma migrate reset` apaga os dados e reaplica todas as migrations do zero (só em desenvolvimento).

> O `prisma migrate dev` cria um banco temporário ("shadow database") para validar as migrations. Por isso o `docker/mysql/init/01-grant-app-user.sql` dá ao usuário `ecoponto_app` permissão para criar bancos. Esse script só roda na **primeira** vez que o volume é criado. Se o seu container é anterior a ele e você receber o erro `P3014`, rode `npm run db:reset` (apaga os dados locais).

### 7.2 Visualizar o banco no DBeaver

1. Com o container rodando (`npm run db:up`), abra o DBeaver e clique em **Nova conexão** (ícone de tomada com `+`) → **MySQL** → **Avançar**.
2. Preencha a aba **Principal**:
   | Campo    | Valor          |
   | -------- | -------------- |
   | Host     | `localhost`    |
   | Porta    | `3306`         |
   | Database | `ecoponto`     |
   | Usuário  | `ecoponto_app` |
   | Senha    | `SENHA`        |
3. Na aba **Propriedades do driver**, ajuste (necessário para o MySQL 8, que não usa SSL neste container):
   - `allowPublicKeyRetrieval` = `true`
   - `useSSL` = `false`
4. Clique em **Testar conexão**. Na primeira vez o DBeaver pede para baixar o driver JDBC do MySQL: aceite.
5. **Concluir**. As tabelas ficam em `ecoponto → Databases → ecoponto → Tables` (`User` e `_prisma_migrations`, que é a tabela de controle do Prisma e não deve ser editada à mão).

Se quiser acesso total (ver/criar outros bancos), use o usuário `root` / senha `root`.

## 8. Popular o banco com as contas de teste (seed)

```bash
npm run db:seed
```

Cria no seu MySQL local três usuários, um para cada perfil:

| Perfil    | E-mail                 | Senha          |
| --------- | ---------------------- | -------------- |
| ADMIN     | `admin@ecoponto.dev`   | `Ecoponto@123` |
| COLLECTOR | `coletor@ecoponto.dev` | `Ecoponto@123` |
| CITIZEN   | `cidadao@ecoponto.dev` | `Ecoponto@123` |

Como funciona:

- As contas **já existem no Firebase compartilhado** (foram criadas pelo orientador). O seed só busca o `uid` de cada uma no Firebase e cria/atualiza a linha correspondente na tabela `User` do seu banco. Ele **não altera** senha nem dados das contas no Firebase, então rodar o seed não afeta os colegas.
- Pode rodar quantas vezes quiser. Depois de um `npm run db:reset`, rode `db:migrate` e `db:seed` de novo.
- Essas são as únicas contas que funcionam igual em todos os ambientes. Use-as para testar os três perfis (é a única forma de ter um `ADMIN`, pois não existe cadastro de admin pela API).

## 9. Rodar a API

```bash
npm run dev
```

Se tudo estiver certo, aparece no terminal:

```
Ecoponto API listening on port 3333
```

A API está no ar em `http://localhost:3333`.

## 10. Testar

Abra no navegador: **http://localhost:3333/docs** — é o Swagger UI, com todas as rotas documentadas e testáveis pela interface (sem precisar de Postman/Insomnia).

Ou pelo terminal:

```bash
curl http://localhost:3333/health
```

Deve responder algo como:

```json
{ "status": "ok", "timestamp": "2026-..." }
```

### Testando login e rotas protegidas

1. Faça login com uma conta do seed:
   ```bash
   curl -X POST http://localhost:3333/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@ecoponto.dev","password":"Ecoponto@123"}'
   ```
   A resposta traz um `idToken`: é o token de acesso (Firebase ID Token), válido por 1 hora.
2. Use o token no cabeçalho `Authorization` das rotas protegidas:
   ```bash
   curl http://localhost:3333/auth/me -H "Authorization: Bearer <idToken>"
   curl http://localhost:3333/users   -H "Authorization: Bearer <idToken>"   # só ADMIN
   ```
   No Swagger, clique em **Authorize** e cole o token.

Para cadastrar usuários novos (`POST /auth/register`), **use e-mails de teste com o seu nome** (ex: `joao.silva+teste1@gmail.com`). O Firebase é compartilhado com a turma, então um e-mail usado por um colega vai dar `409 Email already registered` para você.

## Outros comandos úteis

| Comando                                | O que faz                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`                          | Sobe a API com hot-reload (reinicia sozinha a cada alteração de código)          |
| `npm run build`                        | Compila o TypeScript para `dist/` (verifica erros de tipo)                       |
| `npm start`                            | Roda a versão compilada (`dist/server.js`) — usar em produção, depois do `build` |
| `npx prisma generate`                  | Regenera o cliente Prisma após mexer no `schema.prisma`                          |
| `npx prisma migrate dev --name <nome>` | Cria uma nova migration a partir de mudanças no `schema.prisma`                  |
| `npx prisma studio`                    | Abre uma interface visual no navegador para ver/editar os dados do banco         |
| `npm run lint`                         | Verifica o código com ESLint                                                     |
| `npm run lint:fix`                     | Verifica e corrige automaticamente o que der pra corrigir                        |
| `npm run format`                       | Formata todo o código com Prettier                                               |
| `npm run format:check`                 | Só verifica a formatação, sem alterar nada                                       |
| `npm run db:up`                        | Sobe o MySQL via Docker Compose e espera ele ficar saudável                      |
| `npm run db:down`                      | Derruba o container do MySQL (mantém os dados no volume)                         |
| `npm run db:logs`                      | Mostra os logs do MySQL em tempo real                                            |
| `npm run db:reset`                     | **Apaga todos os dados** do banco e sobe um MySQL limpo do zero                  |
| `npm run db:migrate -- --name <nome>`  | Cria e aplica uma nova migration (mesmo que `npx prisma migrate dev`)            |
| `npm run db:migrate:status`            | Mostra quais migrations já foram aplicadas no banco                              |
| `npm run db:migrate:deploy`            | Aplica migrations pendentes em produção (sem criar novas)                        |
| `npm run db:generate`                  | Mesmo que `npx prisma generate`                                                  |
| `npm run db:studio`                    | Mesmo que `npx prisma studio`                                                    |
| `npm run db:seed`                      | Cria no banco local as contas de teste (admin, coletor, cidadão)                 |

## Padronização de código (ESLint + Prettier + Husky)

O projeto usa **ESLint** (regras de código) e **Prettier** (formatação) para manter um padrão único entre todo mundo que contribui. Isso é reforçado automaticamente pelo **Husky**: toda vez que você roda `git commit`, um hook de pre-commit roda o `lint-staged`, que aplica `eslint --fix` e `prettier --write` só nos arquivos que você alterou (staged).

- Se tudo for corrigível automaticamente (formatação, espaçamento, etc.), o commit segue normalmente com os arquivos já corrigidos.
- Se houver um erro real (ex: variável declarada e nunca usada), **o commit é bloqueado** até você corrigir manualmente.

Isso já é configurado sozinho quando você roda `npm install` (o script `prepare` do `package.json` ativa o Husky) — não precisa fazer nada a mais.

## Problemas comuns

- **`Invalid environment variables`** ao rodar `npm run dev`: alguma variável do `.env` está faltando ou vazia. Confira o passo 6.
- **Erro de conexão com o MySQL**: confirme que o container está rodando e saudável (`docker compose ps`) e que usuário/senha/porta no `DATABASE_URL` batem com os do `docker-compose.yml`.
- **`npm run db:up` falha ou a porta 3306 já está em uso**: você provavelmente tem outro MySQL rodando na mesma porta. Veja a nota na seção 4 sobre trocar a porta.
- **`prisma migrate dev` dá erro de conexão logo depois do `db:up`**: raríssimo (o `--wait` já garante que o healthcheck passou), mas se acontecer, rode `docker compose logs mysql` pra ver se ele terminou de inicializar, espere alguns segundos e tente de novo.
- **`prisma generate` não roda automaticamente**: é esperado — sempre que puxar código novo (`git pull`) que tenha mudado o `prisma/schema.prisma`, rode `npx prisma generate` de novo antes de `npm run dev`.
- **Erro ao chamar `/auth/register` ou `/auth/login`**: confira se as quatro variáveis `FIREBASE_*` do `.env` estão preenchidas exatamente como recebidas (passo 6).
- **`409 Email already registered` no cadastro**: esse e-mail já existe no Firebase compartilhado (talvez criado por um colega). Use outro e-mail de teste.
- **Login funciona, mas `/auth/me` retorna `401`**: a conta existe no Firebase, mas não no **seu** banco local (foi cadastrada no ambiente de outro colega, ou você resetou o banco). Para as contas de teste, rode `npm run db:seed`; para outras, cadastre um e-mail novo.
- **`Seed failed` com erro de conexão**: o MySQL não está rodando (`npm run db:up`) ou as tabelas não foram criadas (`npm run db:migrate`).
- **`401` depois de um tempo usando o mesmo token**: o ID Token expira em 1 hora. Faça login de novo.
