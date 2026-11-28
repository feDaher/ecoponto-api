# syntax=docker/dockerfile:1

# Etapa 1: instala tudo, gera o client do Prisma e compila o TypeScript.
FROM node:24-bookworm-slim AS build
ENV HUSKY=0
# O Prisma detecta a versão do OpenSSL para escolher o binário do motor de migrations, e o
# ca-certificates traz as autoridades raiz para validar o TLS do TiDB Cloud.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma7.config.ts tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# Etapa 2: só o que a API precisa para rodar, mais a CLI do Prisma para as migrations.
FROM node:24-bookworm-slim
ENV NODE_ENV=production HUSKY=0
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
# O "prepare" ativa o husky (hook de commit), que não existe nem faz sentido na imagem final.
RUN PRISMA_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
  && npm pkg delete scripts.prepare \
  && npm ci --omit=dev \
  && npm install --no-save --include=dev "prisma@${PRISMA_VERSION}" \
  && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma7.config.ts ./
COPY scripts/deploy ./scripts/deploy
# O Swagger (/docs) monta a documentação a partir dos comentários @openapi das rotas.
COPY src/modules ./src/modules
USER node
EXPOSE 3333
CMD ["node", "scripts/deploy/start.mjs"]
