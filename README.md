# Scheduling API

API REST para agendamento de horários em estabelecimentos (salões, barbearias, clínicas etc.). Cada empresa define seu horário de funcionamento, intervalo de almoço, duração padrão dos atendimentos e tipos de serviço; os clientes consultam os horários livres, reservam temporariamente um horário e confirmam o agendamento. Atualizações são notificadas em tempo real pelo Firebase Realtime Database.

## Sumário

- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Configuração](#configuração)
- [Executando localmente](#executando-localmente)
- [Criando o primeiro administrador](#criando-o-primeiro-administrador)
- [Build de produção](#build-de-produção)
- [Deploy no Google App Engine](#deploy-no-google-app-engine)
- [Autenticação](#autenticação)
- [Funcionalidades e endpoints](#funcionalidades-e-endpoints)
- [Fluxo de agendamento](#fluxo-de-agendamento)
- [Formato das respostas](#formato-das-respostas)

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 24+ / TypeScript |
| HTTP | Express 5 |
| Banco de dados | MongoDB (Mongoose) |
| Cache / reserva temporária | Redis |
| Autenticação de clientes, storage e eventos em tempo real | Firebase (Auth, Storage, Realtime Database) |
| Autenticação de owners | JWT (`jsonwebtoken`) + senha com `scrypt` |
| Validação | Zod |
| Injeção de dependência | tsyringe |

## Arquitetura

```
src/
├── app.ts                  # Inicialização (Express, Mongo, Redis, Firebase)
├── config/                 # Variáveis de ambiente (env.ts), conexões Mongo e Redis
├── routes/                 # Definição das rotas
├── controllers/            # Camada HTTP
├── application/
│   ├── services/           # Regras de negócio
│   ├── validations/        # Schemas Zod de entrada
│   ├── dtos/               # Formato das respostas
│   └── middlewares/        # Autenticação e tratamento de erros
├── domain/
│   ├── interfaces/         # Entidades e contratos (repositórios/serviços)
│   ├── schemas/            # Modelos Mongoose
│   ├── enums/ exceptions/ utils/
└── repository/             # Acesso ao MongoDB
```

Os imports usam aliases (`@domain`, `@application`, `@config/...`), definidos no `tsconfig.json` e resolvidos no build pelo `tsc-alias`.

## Pré-requisitos

- Node.js 24 ou superior
- Docker e Docker Compose (para MongoDB e Redis locais), ou instâncias externas
- Um projeto no Firebase com **Authentication**, **Storage** e **Realtime Database** habilitados
- O JSON de uma service account do Firebase (*Configurações do projeto → Contas de serviço → Gerar nova chave privada*)

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o arquivo de exemplo e preencha os valores:

   ```bash
   cp .env.example .env
   ```

3. Salve o JSON da service account do Firebase na raiz do projeto como `firebase_config.json` (ou em outro caminho, informado em `FIREBASE_CREDENTIALS_PATH`).

> `.env`, `firebase_config.json` e `app.yaml` contêm segredos e estão no `.gitignore`. Nunca os versione.

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `CHAVE_JWT` | Sim | Chave de assinatura dos tokens JWT dos owners. Gere com `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `DB_URL` | Sim | Connection string do MongoDB |
| `PORT` | Não | Porta HTTP (padrão `80`) |
| `ENVIROMENT` | Não | `development` isola os dados no Firebase (nó/pasta `development/`); em produção use `production` |
| `CACHE_HOST` / `CACHE_PORT` | Não | Host e porta do Redis |
| `CACHE_USERNAME` / `CACHE_PASSWORD` | Não | Credenciais do Redis (usuário padrão: `default`) |
| `FIREBASE_CREDENTIALS_PATH` | Não | Caminho do JSON da service account. Se ausente, usa as *Application Default Credentials* (ex.: conta de serviço do App Engine) |
| `FIREBASESTORAGE` | Não | Bucket do Firebase Storage (ex.: `seu-projeto.appspot.com`) |
| `FIREBASEDB` | Não | URL do Realtime Database |
| `REDIS_PASSWORD`, `MONGO_USERNAME`, `MONGO_PASSWORD`, `MONGO_DATABASE` | Só p/ Docker | Usadas pelo `docker-compose.yml` |

A aplicação valida as variáveis na inicialização e encerra com uma mensagem indicando quais estão ausentes.

## Executando localmente

1. Suba MongoDB e Redis (expostos apenas em `127.0.0.1`):

   ```bash
   docker compose up -d
   ```

2. Ajuste o `.env` para apontar para esses serviços:

   ```env
   DB_URL=mongodb://<MONGO_USERNAME>:<MONGO_PASSWORD>@localhost:27017/scheduling_api?authSource=admin
   CACHE_HOST=localhost
   CACHE_PORT=6379
   CACHE_USERNAME=default
   CACHE_PASSWORD=<REDIS_PASSWORD>
   FIREBASE_CREDENTIALS_PATH=firebase_config.json
   ```

3. Inicie em modo de desenvolvimento (recarrega a cada alteração):

   ```bash
   npm run dev
   ```

4. Verifique: `GET http://localhost:<PORT>/health` deve retornar `{ "message": "API Online" }`.

## Criando o primeiro administrador

O cadastro de owners (`POST /owner`) exige um token de administrador, então o primeiro admin precisa ser inserido diretamente no banco.

1. Gere o hash da senha (formato `salt:hash` usado pela API):

   ```bash
   node -e "const c=require('crypto');const s=c.randomBytes(16).toString('hex');console.log(s+':'+c.scryptSync(process.argv[1],s,64).toString('hex'))" "SuaSenhaForte"
   ```

2. Insira o documento no MongoDB (ex.: via `mongosh`):

   ```js
   use scheduling_api
   db.owners.insertOne({
     name: "Administrador",
     username: "admin",
     password: "<hash gerado no passo 1>",
     role: "admin",
     createdAt: new Date(),
     updatedAt: new Date()
   })
   ```

3. Autentique em `POST /owner/auth` para obter o token.

## Build de produção

```bash
npm run build   # compila para dist/ e resolve os aliases de import
npm start       # executa dist/app.js
```

## Deploy no Google App Engine

O projeto roda no **App Engine Standard** (`runtime: nodejs24`). No deploy, o App Engine instala as dependências, executa o script `gcp-build` (que roda o build) e inicia com `npm start`.

1. Crie o `app.yaml` na raiz (ele está no `.gitignore` por conter segredos):

   ```yaml
   runtime: nodejs24
   env: standard
   instance_class: F1

   env_variables:
     ENVIROMENT: "production"
     CHAVE_JWT: "..."
     DB_URL: "..."
     FIREBASESTORAGE: "..."
     FIREBASEDB: "..."
     CACHE_USERNAME: "default"
     CACHE_PASSWORD: "..."
     CACHE_HOST: "..."
     CACHE_PORT: "..."
   ```

   Não defina `FIREBASE_CREDENTIALS_PATH`: em produção a API usa a conta de serviço do App Engine (`<projeto>@appspot.gserviceaccount.com`), que precisa ter acesso ao Realtime Database e ao Storage do Firebase.

2. Faça o deploy:

   ```bash
   gcloud app deploy
   ```

O `.gcloudignore` impede o envio de `.env`, credenciais, `node_modules` e `dist`.

**Rede:** MongoDB e Redis devem ser serviços externos (ex.: MongoDB Atlas, Redis Cloud ou Memorystore). Como o App Engine Standard não tem IP de saída fixo, libere o acesso a partir de qualquer IP (protegido por senha e TLS) ou configure um *Serverless VPC Access connector* com Cloud NAT.

## Autenticação

A API usa dois tipos de token, sempre enviados no cabeçalho `Authorization: Bearer <token>`:

| Token | Quem usa | Como obter | Rotas |
|---|---|---|---|
| **Firebase ID Token** | Clientes finais (quem agenda) | Login pelo Firebase Authentication no app cliente | Consultas e agendamentos (marcadas com 🔥) |
| **JWT da API** | Owners e administradores | `POST /owner/auth` | Gestão de owners, empresas, funcionários e serviços (marcadas com 🔑 / 🛡️) |

O JWT da API expira em 30 minutos e contém o id do owner (`sub`), `username`, `role` (`owner` ou `admin`) e os ids das suas empresas.

**Permissão por empresa:** nas rotas que alteram dados de uma empresa (marcadas com 🏢), a API confere se o owner autenticado é o dono da empresa (`ownerId` no banco). Administradores têm acesso a todas as empresas. Sem permissão, a resposta é `403`.

## Funcionalidades e endpoints

Legenda: 🔥 Firebase ID Token · 🔑 JWT de owner ou admin · 🛡️ JWT de admin · 🏢 somente o dono da empresa ou admin · — sem autenticação

### Saúde

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/health` | — | Verifica se a API está no ar |

### Owners (proprietários)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/owner` | 🛡️ | Cadastra um owner. Body: `{ name, username, password }` |
| POST | `/owner/auth` | — | Autentica e retorna o token. Body: `{ username, password }` |
| PATCH | `/owner/:id` | 🔑 | Atualiza `name` e/ou `password`. Um owner só pode alterar a si mesmo; admin pode alterar qualquer um |
| DELETE | `/owner/:id` | 🛡️ | Exclusão lógica do owner |

Senhas são armazenadas com `scrypt` e salt aleatório; nunca são retornadas nas respostas.

### Empresas

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/company` | 🛡️ | Cadastra uma empresa vinculada a um owner (`ownerId`) |
| GET | `/company/search_domain?subdomain=<valor>` | — | Retorna o `_id` da empresa pelo subdomínio |
| GET | `/company/:id` | 🔥 | Detalhes da empresa com seus tipos de serviço |
| PATCH | `/company/:id` | 🔑 🏢 | Atualiza dados, endereço, redes sociais, geolocalização e configuração de horários |
| DELETE | `/company/:id` | 🛡️ | Exclusão lógica da empresa |
| PUT | `/company/update_logo/:companyId` | 🔑 🏢 | Envia o logo (`multipart/form-data`, campo `file`) para o Firebase Storage |

Exemplo de cadastro:

```json
{
  "cnpj": "12345678000199",
  "name": "Barbearia Exemplo",
  "ownerId": "<id do owner>",
  "address": { "street": "Rua A", "number": "100", "city": "São Paulo", "state": "SP", "zipCode": "01000000" },
  "configuration": {
    "defaultPeriodInMinutes": 30,
    "openingHours": "08:00",
    "closingTime": "18:00",
    "lunchBreak": { "start": "12:00", "end": "13:00" }
  },
  "social": { "instagram": "@exemplo", "whatsapp": "11999999999" },
  "geoLocation": { "type": "Point", "coordinates": [-46.63, -23.55] }
}
```

| Campo de `configuration` | Descrição |
|---|---|
| `defaultPeriodInMinutes` | Duração de cada horário disponível |
| `openingHours` / `closingTime` | Abertura e fechamento (`HH:mm`, padrão `08:00`–`18:00`) |
| `lunchBreak` | Intervalo sem atendimento (padrão `12:00`–`13:00`) |
| `lockSchedulePeriodInMinutes` | Tempo de reserva temporária de um horário (padrão 10 minutos) |

### Funcionários

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/company/employees/:companyId` | 🔑 🏢 | Cadastra funcionário. Body: `{ name, profilePhotoUrl }` |
| GET | `/company/employees/:companyId` | 🔥 | Lista os funcionários da empresa |
| GET | `/company/employees/:companyId/:id` | 🔑 | Detalhes de um funcionário |
| PATCH | `/company/employees/:companyId/:id` | 🔑 🏢 | Atualiza `name` e/ou `profilePhotoUrl` |
| DELETE | `/company/employees/:companyId/:id` | 🔑 🏢 | Remove o funcionário |

### Tipos de serviço

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/schedules/types/:companyId` | 🔥 | Lista os serviços da empresa |
| POST | `/schedules/types/:companyId` | 🔑 🏢 | Cadastra serviço. Body: `{ name, price }` |
| PATCH | `/schedules/types/:companyId/:id` | 🔑 🏢 | Atualiza `name` e/ou `price` |
| DELETE | `/schedules/types/:companyId/:id` | 🔑 🏢 | Remove o serviço |

### Agendamentos

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/schedules/:companyId?startsAt=YYYY-MM-DD&endsAt=YYYY-MM-DD` | 🔥 | Lista os horários do dia com seu estado (padrão: hoje) |
| POST | `/lock_schedule/:companyId` | 🔥 | Reserva temporariamente um horário. Body: `{ startsAt, endsAt, typeId }` |
| DELETE | `/lock_schedule/:companyId` | 🔥 | Libera a reserva. Body: `{ startsAt, endsAt }` |
| POST | `/schedules/:companyId` | 🔥 | Confirma o agendamento. Body: `{ startsAt, endsAt, typeId, employeeId, phoneNumber }` |
| GET | `/schedules/:companyId/:id` | 🔥 | Detalhes de um agendamento |
| DELETE | `/schedules/:companyId/:id` | 🔥 | Cancela um agendamento |

Datas de `startsAt`/`endsAt` no body seguem ISO 8601 com fuso (ex.: `2026-11-03T14:00:00-03:00`).

## Fluxo de agendamento

```
GET /schedules/:companyId   →   POST /lock_schedule/:companyId   →   POST /schedules/:companyId
  (consulta horários)            (reserva temporária no Redis)         (confirma no MongoDB)
```

1. **Consulta:** a API gera os horários do dia a partir da configuração da empresa (abertura, fechamento e duração padrão), remove o intervalo de almoço e os horários já passados, e marca o estado de cada um.
2. **Reserva:** o cliente reserva um horário, que fica bloqueado no Redis pelo tempo de `lockSchedulePeriodInMinutes`. Ao expirar, o horário volta a ficar livre automaticamente.
3. **Confirmação:** só o cliente que reservou pode confirmar o horário. O agendamento é gravado no MongoDB e a reserva é removida.

A cada reserva, liberação ou confirmação, a API atualiza o nó `<companyId>/<YYYY-MM-DD>` no Firebase Realtime Database (campo `deliveryIdEvent`), permitindo que os apps clientes atualizem a agenda em tempo real.

| Estado | Significado |
|---|---|
| `open` | Livre |
| `lock` | Reservado temporariamente por um cliente |
| `scheduled` | Agendado |
| `closed` | Indisponível (ex.: intervalo de almoço; não aparece na listagem) |

## Formato das respostas

Todas as respostas seguem o envelope:

```json
{
  "statusCode": 200,
  "message": "Sucesso",
  "dados": { },
  "statusProcess": true
}
```

| Status | Quando ocorre |
|---|---|
| `400` | Regra de negócio violada (ex.: horário indisponível) ou JSON inválido |
| `401` | Token ausente, inválido ou expirado; usuário ou senha incorretos |
| `403` | Token válido sem permissão para a operação |
| `404` | Recurso não encontrado ou rota inexistente |
| `406` | Parâmetros inválidos (falha de validação), com o detalhe de cada campo em `message` |
| `409` | Registro duplicado (ex.: `username` já existente) |
| `500` | Erro interno |
