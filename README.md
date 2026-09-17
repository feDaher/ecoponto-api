# EcoPonto Digital — API

Backend da plataforma **EcoPonto Digital**, sistema de mapeamento e credenciamento de pontos de coleta de resíduos recicláveis e eletrônicos.

Este guia parte do zero: clonar o projeto, instalar tudo que ele precisa e rodar localmente. Se você nunca configurou um ambiente Node.js antes, siga a ordem exata dos passos.

> Para entender a arquitetura, as regras de negócio e as decisões técnicas do projeto, veja o [CLAUDE.md](CLAUDE.md) depois de concluir este setup.

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
4. **Uma conta Google** para criar um projeto Firebase (gratuito) — usado para login/cadastro.
5. Um editor de código, como o [VS Code](https://code.visualstudio.com/).

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

Se você optou por Docker, rode:

```bash
docker run --name ecoponto-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=ecoponto \
  -e MYSQL_USER=ecoponto_app \
  -e MYSQL_PASSWORD=SENHA \
  -p 3306:3306 \
  -d mysql:8
```

Isso cria um banco `ecoponto` acessível em `localhost:3306`, com usuário `ecoponto_app` e senha `SENHA` (você pode trocar esses valores, só lembre de refletir a troca no `.env` do passo 6).

Se preferir MySQL instalado localmente, crie o banco e o usuário manualmente com essas mesmas credenciais (ou outras de sua escolha) usando o MySQL Workbench ou a linha de comando.

## 5. Criar um projeto Firebase

O EcoPonto usa o Firebase só para autenticação (cadastro/login) — não precisa de nenhum plano pago.

1. Acesse [console.firebase.google.com](https://console.firebase.google.com/) e clique em **Criar projeto** (pode desativar o Google Analytics, não é necessário).
2. No menu lateral, vá em **Compilação → Authentication → Sign-in method** e habilite o provedor **E-mail/senha**.
3. Vá em **Configurações do projeto** (ícone de engrenagem) → aba **Contas de serviço** → **Gerar nova chave privada**. Isso baixa um arquivo `.json` parecido com:
   ```json
   {
     "project_id": "seu-projeto-id",
     "client_email": "firebase-adminsdk-xxxxx@seu-projeto-id.iam.gserviceaccount.com",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   }
   ```
   Guarde esse arquivo — você vai usar os três campos acima no passo 6. **Nunca suba esse arquivo pro Git.**
4. Ainda em **Configurações do projeto**, na aba **Geral**, copie a **Chave de API da Web** (Web API Key) — é diferente da chave privada do passo anterior.

## 6. Configurar as variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Abra o `.env` criado e preencha:

```bash
DATABASE_URL="mysql://ecoponto_app:SENHA@localhost:3306/ecoponto"
PORT=3333

FIREBASE_PROJECT_ID=seu-projeto-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@seu-projeto-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_API_KEY=sua-web-api-key
```

- `DATABASE_URL` deve bater com o usuário/senha/porta/nome do banco que você criou no passo 4.
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` vêm do JSON baixado no passo 5.3 (mantenha a `private_key` entre aspas, exatamente como veio no JSON, com os `\n`).
- `FIREBASE_API_KEY` vem do passo 5.4.

## 7. Criar as tabelas no banco (Prisma)

```bash
npx prisma generate
npx prisma migrate dev --name init
```

- `prisma generate` cria o cliente Prisma (código TypeScript que a API usa para falar com o banco) dentro de `src/generated/`. Precisa ser rodado toda vez que o arquivo `prisma/schema.prisma` mudar.
- `prisma migrate dev` cria as tabelas de verdade no MySQL a partir do schema.

Se der erro de conexão aqui, revise o `DATABASE_URL` e confirme que o container/serviço do MySQL está rodando (`docker ps`, no caso do Docker).

## 8. Rodar a API

```bash
npm run dev
```

Se tudo estiver certo, aparece no terminal:

```
Ecoponto API listening on port 3333
```

A API está no ar em `http://localhost:3333`.

## 9. Testar

Abra no navegador: **http://localhost:3333/docs** — é o Swagger UI, com todas as rotas documentadas e testáveis pela interface (sem precisar de Postman/Insomnia).

Ou pelo terminal:

```bash
curl http://localhost:3333/health
```

Deve responder algo como:

```json
{ "status": "ok", "timestamp": "2026-..." }
```

Para testar o fluxo de cadastro e login, veja os exemplos de `curl` em [CLAUDE.md](CLAUDE.md).

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

## Padronização de código (ESLint + Prettier + Husky)

O projeto usa **ESLint** (regras de código) e **Prettier** (formatação) para manter um padrão único entre todo mundo que contribui. Isso é reforçado automaticamente pelo **Husky**: toda vez que você roda `git commit`, um hook de pre-commit roda o `lint-staged`, que aplica `eslint --fix` e `prettier --write` só nos arquivos que você alterou (staged).

- Se tudo for corrigível automaticamente (formatação, espaçamento, etc.), o commit segue normalmente com os arquivos já corrigidos.
- Se houver um erro real (ex: variável declarada e nunca usada), **o commit é bloqueado** até você corrigir manualmente.

Isso já é configurado sozinho quando você roda `npm install` (o script `prepare` do `package.json` ativa o Husky) — não precisa fazer nada a mais.

## Problemas comuns

- **`Invalid environment variables`** ao rodar `npm run dev`: alguma variável do `.env` está faltando ou vazia. Confira o passo 6.
- **Erro de conexão com o MySQL**: confirme que o banco está rodando (`docker ps`) e que usuário/senha/porta no `DATABASE_URL` batem com os do banco.
- **`prisma generate` não roda automaticamente**: é esperado — sempre que puxar código novo (`git pull`) que tenha mudado o `prisma/schema.prisma`, rode `npx prisma generate` de novo antes de `npm run dev`.
- **Erro ao chamar `/auth/register` ou `/auth/login`**: confira se o provedor **E-mail/senha** está mesmo habilitado no Firebase (passo 5.2) e se as credenciais no `.env` são do projeto certo.
