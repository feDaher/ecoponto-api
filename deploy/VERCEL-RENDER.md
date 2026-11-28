# Deploy de teste gratuito: Vercel + Render + TiDB Cloud

Para testar o MVP sem cartão de crédito. Não é o ambiente definitivo: os dados ficam nos EUA e os planos gratuitos têm limites (veja o fim do guia).

```
Navegador ──► Vercel (ecoponto-web, Next.js) ──fetch direto (CORS)──┐
App mobile (Expo) ─────────────────────────────────────────────────┤
                                                                   ▼
                                       Render (ecoponto-api em Docker, free, Virginia)
                                         ├─► TiDB Cloud Starter (MySQL, us-east-1)
                                         ├─► Firebase Auth (projeto de teste)
                                         └─► Google Places (busca de endereço, opcional)
UptimeRobot ──► /health a cada 5 min (mantém a API acordada e o cron diário rodando)
```

| Serviço            | Plano gratuito: o que importa                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel             | Publica o front a cada push no `main` do `ecoponto-web`                                                                                                               |
| Render             | 512 MB de memória (a API usa ~140 MB); **dorme após 15 min sem acesso** (o primeiro acesso depois leva até 1 min); 750 h/mês, o bastante para 1 serviço ligado direto |
| TiDB Cloud Starter | Compatível com MySQL; 5 GiB de dados e 50 milhões de RUs por mês; exige TLS                                                                                           |
| Firebase (Spark)   | Login por e-mail e senha, sem custo                                                                                                                                   |

> **Antes de começar:** o código precisa estar no `main` do GitHub dos dois repositórios (`ecoponto-api` e `ecoponto-web`). Render e Vercel publicam a partir dele.
>
> **Segredos** (senha do banco, chave do Firebase) vão **só** nos painéis dos serviços e nos comandos do passo 6. Nunca em arquivos do repositório.

## 1. Banco no TiDB Cloud

1. Crie a conta em `https://tidbcloud.com` (entrar com o GitHub é o mais rápido).
2. Crie um cluster **Starter** (gratuito) em **AWS, N. Virginia (us-east-1)**, a mesma região do Render. Nome sugerido: `ecoponto-teste`.
3. Abra o cluster → **Connect**:
   - em **Connect With**, escolha **General**;
   - clique em **Generate Password** e guarde a senha (ela só aparece uma vez);
   - anote **HOST**, **PORT** (4000) e **USERNAME** (algo como `xxxxxxxx.root`).
4. Em **SQL Editor**, crie o banco: `CREATE DATABASE ecoponto;`
5. Monte a **DATABASE_URL**:

   ```
   mysql://USERNAME:SENHA@HOST:4000/ecoponto?sslaccept=strict&ssl=true
   ```

   - `sslaccept=strict` é para o Prisma (migrations) e `ssl=true` para a API: os dois ligam o TLS que o TiDB exige.
   - Se a senha tiver `@`, `:`, `/`, `?`, `#` ou `%`, troque cada um pelo código da URL (`@` → `%40`, `:` → `%3A`, `/` → `%2F`, `?` → `%3F`, `#` → `%23`, `%` → `%25`). O mais simples é gerar outra senha até vir só com letras e números.

Não é preciso rodar migrations à mão: na primeira subida a API cria a estrutura sozinha (passo 3).

## 2. Firebase de teste

Projeto separado do Firebase da turma: cadastros feitos no site público não se misturam com as contas de desenvolvimento.

1. Em `https://console.firebase.google.com`, **Adicionar projeto**: nome `ecoponto-teste`, Google Analytics desativado. O plano Spark é o padrão e não pede cartão.
2. **Criação → Authentication → Vamos começar → E-mail/senha → Ativar → Salvar**.
3. **Configurações do projeto (engrenagem) → Geral**: copie a **Chave de API da Web** → `FIREBASE_API_KEY`. Se ela não aparecer, adicione um app Web (ícone `</>`, qualquer apelido) e ela passa a aparecer.
4. **Configurações do projeto → Contas de serviço → Gerar nova chave privada**: baixa um JSON. Dele vêm:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (o texto inteiro, de `-----BEGIN` até `END PRIVATE KEY-----\n`; a API aceita com ou sem aspas)

   Guarde o JSON fora da pasta dos repositórios e apague depois do passo 6.

## 3. API no Render

1. Crie a conta em `https://render.com` (entrar com o GitHub) e autorize o acesso ao repositório `ecoponto-api`.
2. **New → Blueprint**, escolha o repositório. O Render lê o [`render.yaml`](../render.yaml) e cria o serviço `ecoponto-api` (Docker, plano free, Virginia).
3. Preencha as variáveis pedidas:

   | Variável                                                                                   | Valor                                                                 |
   | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
   | `DATABASE_URL`                                                                             | a do passo 1.5                                                        |
   | `CORS_ORIGINS`                                                                             | por enquanto `https://exemplo.vercel.app` (troca no passo 5)          |
   | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_API_KEY` | as do passo 2                                                         |
   | `GOOGLE_MAPS_API_KEY`                                                                      | opcional; sem ela a busca de endereço responde 503 e o resto funciona |

4. **Apply**. O primeiro build leva de 5 a 10 minutos. No log, a primeira subida mostra:

   ```
   [deploy] Banco vazio: criando a estrutura a partir do schema.prisma.
   [deploy] Marcando 26 migrations como aplicadas.
   No pending migrations to apply.
   Ecoponto API listening on port …
   ```

5. Copie o endereço da API (`https://ecoponto-api-xxxx.onrender.com`) e confira:
   - `/health` → `{"status":"ok",…}`
   - `/health/ready` → `{"status":"ok","database":"up",…}` (prova que a API alcança o TiDB)
   - `/docs` → Swagger

> **Por que a estrutura é criada "pelo schema":** duas migrations antigas (BE-16 e BE-17) usam `JSON_TABLE` para copiar dados do formato anterior, e o TiDB não tem essa função. Num banco novo não há o que copiar, então, só quando o banco está vazio, o `scripts/deploy/start.mjs` cria a estrutura final e marca as migrations como aplicadas. Daí em diante, migrations novas rodam normalmente a cada deploy.

## 4. Front na Vercel

1. Crie a conta em `https://vercel.com` (entrar com o GitHub).
2. **Add New → Project**, importe o repositório `ecoponto-web`. O framework (Next.js) é detectado sozinho; não mude o Root Directory.
3. **Environment Variables** (marque **Production** e **Preview**):

   | Variável                          | Valor                                               |
   | --------------------------------- | --------------------------------------------------- |
   | `NEXT_PUBLIC_API_URL`             | o endereço da API no Render, **sem barra no final** |
   | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | a chave do mapa (Maps JavaScript API)               |
   | `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`  | o Map ID (ou `DEMO_MAP_ID`)                         |

   O endereço da API é **gravado no build**: se a variável for criada ou alterada depois, faça **Redeploy**. Sem ela, o build falha de propósito com a mensagem "NEXT_PUBLIC_API_URL não está definida na Vercel".

4. **Deploy**. Copie o endereço de produção (`https://NOME.vercel.app`).
5. No Google Cloud, na chave `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (restrição por referenciador HTTP), acrescente `https://NOME.vercel.app/*`, senão o mapa não carrega.

## 5. Ligar o front à API

No Render, em `ecoponto-api → Environment`, troque **`CORS_ORIGINS`** pelo endereço da Vercel (`https://NOME.vercel.app`, sem barra no final) e salve. A API reinicia sozinha. Sem isso, o navegador bloqueia as chamadas do site à API.

> Use o endereço de **produção** da Vercel. Os endereços de _preview_ mudam a cada deploy e são recusados pelo CORS. Para liberar mais de um, separe por vírgula.

## 6. Contas iniciais (seed)

O seed cria as 11 categorias, as contas `admin@ecoponto.dev`, `coletor@ecoponto.dev` e `cidadao@ecoponto.dev` e os dados de demonstração (pontos em Manhuaçu, guias, avaliações).

**Atenção:** a senha padrão do seed (`Ecoponto@123`) está escrita no README. Num site público, use uma senha forte com `SEED_PASSWORD`, senão qualquer pessoa entra como admin.

No seu computador, no PowerShell, na pasta `ecoponto-api` (com `npm install` feito):

```powershell
$env:DATABASE_URL = "<a mesma DATABASE_URL do passo 1.5>"
$env:FIREBASE_PROJECT_ID = "<do passo 2>"
$env:FIREBASE_CLIENT_EMAIL = "<do passo 2>"
$env:FIREBASE_PRIVATE_KEY = "<do passo 2>"
$env:FIREBASE_API_KEY = "<do passo 2>"
$env:SEED_PASSWORD = "<senha forte, com 12 ou mais caracteres>"
npx prisma generate
npm run db:seed

# Limpa as variáveis desta janela do terminal
Remove-Item Env:DATABASE_URL, Env:FIREBASE_PROJECT_ID, Env:FIREBASE_CLIENT_EMAIL, Env:FIREBASE_PRIVATE_KEY, Env:FIREBASE_API_KEY, Env:SEED_PASSWORD
```

- **Defina as quatro variáveis do Firebase.** As da janela têm prioridade sobre o `.env`; se faltar alguma, o seed usa as do `.env`, que são do projeto da turma, e cria as contas no lugar errado.
- O seed só cria contas que ainda não existem e só define a senha na criação. Para trocar depois, use a tela de conta (troca de senha) ou o console do Firebase.

## 7. Manter a API acordada (UptimeRobot)

1. Crie a conta em `https://uptimerobot.com` (grátis).
2. **New monitor**: tipo **HTTP(s)**, URL `https://ecoponto-api-xxxx.onrender.com/health`, intervalo de **5 minutos**.

Além de evitar a espera do primeiro acesso, isso mantém o cron diário rodando (às 03:00 de Brasília ele marca os pontos com horário desatualizado). O `/health` não consulta o banco, então o TiDB pode descansar.

## 8. App mobile

No `.env` do `ecoponto-mobile`, aponte para a API publicada e reinicie o Expo:

```
EXPO_PUBLIC_API_URL=https://ecoponto-api-xxxx.onrender.com
```

O app chama a API direto (o CORS não se aplica a apps nativos).

## 9. Teste básico

1. Abra o endereço da Vercel. Se a API estiver dormindo, o primeiro acesso leva até 1 minuto.
2. Mapa público: sem login, os pontos de demonstração aparecem.
3. Entre como `admin@ecoponto.dev` com a senha do passo 6 e troque a senha na tela de conta.
4. Entre como coletor, edite um ponto e veja-o voltar para aprovação; aprove como admin.
5. Gere um relatório e exporte em PDF.

## Atualizar

Cada push no `main` publica sozinho: a Vercel refaz o front e o Render refaz a API (as migrations pendentes rodam na subida do container).

## Limitações desta configuração (só para teste)

- **Dados fora do Brasil** (EUA) e planos gratuitos: use dados fictícios, sem dados pessoais reais.
- **Sem réplica de leitura**: os relatórios leem do banco principal (a API já faz isso quando `DATABASE_REPLICA_URL` não existe).
- **Sem backup automático garantido** no plano gratuito do TiDB. Não guarde nada que não possa perder.
- A API usa o usuário principal do TiDB, que pode alterar a estrutura (necessário para as migrations na subida). Num ambiente definitivo, separe um usuário só de leitura e escrita para a API.
- O índice decrescente da trilha de auditoria (`AuditLog`) fica crescente no TiDB, que o percorre de trás para frente: mesmo efeito, mas por isso não rode `prisma migrate dev` apontando para o TiDB.
