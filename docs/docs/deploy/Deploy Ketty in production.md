## Setting up required services

:::note
This guide is for deploying Ketty (v2) in production. Refer to [Repositories & Setup](https://docs.ketty.community/docs/developerGuide/Repositories%20&%20Setup) to build Ketty (v2) or Editoria (v1) locally.
:::

There are a few things that need to be up and running before running the app:

- Databases
- S3-compatible object storage
- Coko microservices:
  - Pagedjs (pdf preview & generation)
  - XSweet (docx upload to html conversions)
  - EpubChecker (epub validation before generating file)
  - Flax (publish books on the web)

### Databases

The app, as well as each of the microservices needs a separate postgresql database to connect to. Make sure that the pgcrypto extension is installed on each of them.  
To install this extension you can run `CREATE EXTENSION IF NOT EXISTS pgcrypto;` in your postgres environment.

Additionally, the database for the main app needs the [pgvector extension](https://github.com/pgvector/pgvector), used for RAG Search in the Knowledge Base. To install pgvector run `CREATE EXTENSION IF NOT EXISTS vector;` in your postgres environment.

### Object storage

An S3 or S3-compatible (eg. Minio, Google cloud, Digital ocean and more) object storage bucket is needed for file uploads.

### Coko Microservices

Each of the microservices will need a client id and a client secret. These values will then be passed to Ketty's server as environment variables, so that the server can perform its authentication with the microservices. To get a valid id/secret pair, run `yarn create:client` in the respective microservice.

All microservices are published in dockerhub:

- Pagedjs: https://hub.docker.com/r/cokoapps/pagedjs/tags
- Xsweet: https://hub.docker.com/r/cokoapps/xsweet/tags
- Epubchecker: https://hub.docker.com/r/cokoapps/epubchecker/tags
- Flax: https://hub.docker.com/r/cokoapps/ketty-flax/tags

For more details on how to run each microservice, check the read me file in the following repos:

- Pagedjs: https://gitlab.coko.foundation/cokoapps/pagedjs
- Xsweet: https://gitlab.coko.foundation/cokoapps/xsweet
- Epubchecker: https://gitlab.coko.foundation/cokoapps/epub-checker
- Flax: https://gitlab.coko.foundation/coko-org/products/ketty/flax

---

## Running Ketty

Ketty is provided as two separate docker containers ([Ketty client](https://hub.docker.com/r/cokoapps/ketty-client/tags) and [Ketty server](https://hub.docker.com/r/cokoapps/ketty-server/tags)). The two containers will run on separate ports (or even separate machines if that suits the specific setup). The client image only serves a static bundle.

### Repositories

You can find the repos for Ketty server & client in the following links:

- Ketty client: https://gitlab.coko.foundation/ketty/ketty
- Ketty server: https://gitlab.coko.foundation/ketty/server

### Environment variables

First thing to do is to setup the correct environment variables in the environment where the containers will run. The most up to date list of environment variables can be found in the [production compose file](https://gitlab.coko.foundation/coko-org/products/ketty/ketty/-/blob/main/docker-compose.demo-deploy.yml?ref_type=heads) in the Ketty repo. You can use this compose file as is, or recreate its logic with the docker compose equivalent of your choice (eg. kubernetes).

Some notes on specific variables:

- Make sure `NODE_ENV=production` on production environments
- Make sure each container has a unique `SERVER_IDENTIFIER` value
- Make sure `FEATURE_UPLOAD_DOCX_FILES` is set to `true`
- Make sure `FEATURE_BOOK_STRUCTURE` is set to `false`
- Make sure `KETIDA_FLAVOUR` is set to `LULU`
- `FEATURE_POD=true` is required for v2
- `SERVICE_ICML_...` variables are optional, as they are not used in v2
- If you are not using wax's AI integration, you can skip the `AI_ENABLED` and `CHAT_GPT_KEY` variables
- `MAILER_...` variables are necessary for emails to work
- `WS_HEARTBEAT_INTERVAL`, `FAIL_SAFE_UNLOCKING_INTERVAL`, `TEMP_DIRECTORY_CRON_JOB_SCHEDULE` and `TEMP_DIRECTORY_CRON_JOB_OFFSET` are optional unless you want to override their values

### Config file

To enable export templates and integration with lulu, you will also need to mount a config file (eg. [with compose](https://gitlab.coko.foundation/coko-org/products/ketty/ketty/-/blob/main/docker-compose.demo-deploy.yml?ref_type=heads#L67)) inside the server container at the `config/local.js` location.  
This will enable these specific templates, but you can also replace these with the templates of your choice.  
Note that in the lulu integration section, you should replace the `{clientUrl}` and `{luluClientId}` with proper values, as well as replace the sandbox values with their non-sandboxes equivalents.

```
module.exports = {
  templates: [
    {
      label: "slategrey",
      url: "https://gitlab.coko.foundation/coko-org/products/ketty/ketty-templates/slategrey.git",
      assetsRoot: "dist",
      supportedNoteTypes: ["footnotes"],
    },
    {
      label: "significa",
      url: "https://gitlab.coko.foundation/coko-org/products/ketty/ketty-templates/significa.git",
      assetsRoot: "dist",
      supportedNoteTypes: ["footnotes"],
    },
    {
      label: "bikini",
      url: "https://gitlab.coko.foundation/coko-org/products/ketty/ketty-templates/bikini.git",
      assetsRoot: "dist",
      supportedNoteTypes: ["footnotes"],
    },
    {
      label: "vanilla",
      url: "https://gitlab.coko.foundation/coko-org/products/ketty/ketty-templates/vanilla.git",
      assetsRoot: "dist",
      default: true,
      supportedNoteTypes: ["footnotes"],
    },
    {
      label: "atosh",
      url: "https://gitlab.coko.foundation/coko-org/products/ketty/ketty-templates/atosh.git",
      assetsRoot: "dist",
      supportedNoteTypes: ["footnotes"],
    },
    {
      label: "eclypse",
      url: "https://gitlab.coko.foundation/coko-org/products/ketty/ketty-templates/eclypse.git",
      assetsRoot: "dist",
      supportedNoteTypes: ["footnotes"],
    },
    {
      label: "logical",
      url: "https://gitlab.coko.foundation/coko-org/products/ketty/ketty-templates/logical.git",
      assetsRoot: "dist",
      supportedNoteTypes: ["footnotes"],
    },
    {
      label: "tenberg",
      url: "https://gitlab.coko.foundation/coko-org/products/ketty/ketty-templates/tenberg.git",
      assetsRoot: "dist",
      supportedNoteTypes: ["footnotes"],
    },
  ],
  integrations: {
    lulu: {
      baseAPIURL: "https://api.sandbox.lulu.com/api/project-inject/projects",
      redirectUri: "{clientUrl}/provider-redirect/lulu",
      tokenUrl:
        "https://api.sandbox.lulu.com/auth/realms/glasstree/protocol/openid-connect/token",
      clientId: "{luluClientId}",
      loginUrl:
        "https://api.sandbox.lulu.com/auth/realms/glasstree/protocol/openid-connect/auth",
      projectBaseUrl: "https://www.sandbox.lulu.com/account/projects",
    },
  },
};
```

### Websockets

The server container exposes two different ports, one for the main server and one for the websocket server (used for keeping chapters locked when a user is editing). You should map each of these to a different port on your machine. See [the server port part of the compose file](https://gitlab.coko.foundation/coko-org/products/ketty/ketty/-/blob/main/docker-compose.demo-deploy.yml?ref_type=heads#L18-19) for reference.

### SSL

All containers will run on simple http or ws protocols, as they are meant to expose their ports only to the machine on which they are running. It is up to the specific sysadmin setup to map those exposed ports to a url that will have SSL certificates enabled (eg. via nginx reverse proxy or equivalent).

---

## Bookhub.ng reference deployment (how it is done)

This section documents the current Bookhub.ng installation based on the local stack we run on the host.

### Location

- Repo root: /home/oreva/bookhub/ketty-client-src
- Backup snapshot example: /home/oreva/bookhub/our-last-working-state-10-17.tgz

### Services and ports

- Client UI: 5173
- Server API: 3000
- Server WebSocket: 3333
- Flax (web preview/publish): 3005
- Pagedjs (PDF preview): 3003
- Xsweet (DOCX import): 3004
- Epubchecker: 3001
- MinIO: 9000 (API), 9001 (console)
- Postgres DBs: 5432 (main) + service DBs

### Environment configuration

Environment variables are stored in:

- /home/oreva/bookhub/ketty-client-src/.env

Key values (examples):

- CLIENT_URL=https://bookhub.ng
- SERVER_URL=https://bookhub.ng
- WEBSOCKET_SERVER_URL=wss://bookhub.ng/ws
- S3_URL=http://s3:9000
- S3_BUCKET=uploads
- S3_ACCESS_KEY_ID_USER=ketida
- S3_SECRET_ACCESS_KEY_USER=superSecretUserPassword
- PAGEDJS_PUBLIC_URL=https://bookhub.ng/preview
- SERVICE_PAGEDJS_URL=http://pagedjs:3003
- SERVICE_FLAX_URL=http://flax:3005
- FLAX_PUBLIC_URL=https://bookhub.ng
- KETIDA_FLAVOUR=POD
- FEATURE_POD=true
- MAILER_* values if email is enabled

### Docker compose startup

Standard start (when compose is healthy):

```
cd /home/oreva/bookhub/ketty-client-src
sudo docker-compose -f docker-compose.yml up -d
```

If compose v1 fails with ContainerConfig errors, rebuild the images and run the server manually:

```
cd /home/oreva/bookhub/ketty-client-src
sudo DOCKER_BUILDKIT=0 docker-compose -f docker-compose.yml build client server

sudo docker run -d --name ketty-client-src_server_1 \
  --network ketty-client-src_default \
  -p 3000:3000 -p 3333:3333 \
  --env-file .env \
  -e KETIDA_FLAVOUR=POD \
  -e FEATURE_POD=true \
  -e SERVER_URL=https://bookhub.ng \
  -e WEBSOCKET_SERVER_URL=wss://bookhub.ng/ws \
  -e CLIENT_URL=https://bookhub.ng \
  -e POSTGRES_HOST=db \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_DB=ketida_dev \
  -e POSTGRES_USER=dev_user \
  -e POSTGRES_PASSWORD=dev_user_password \
  -e S3_URL=http://s3:9000 \
  -e S3_BUCKET=uploads \
  -e S3_ACCESS_KEY_ID_USER=ketida \
  -e S3_SECRET_ACCESS_KEY_USER=superSecretUserPassword \
  -e FILE_STORAGE_URL=http://s3:9000 \
  -e FILE_STORAGE_PUBLIC_URL=https://bookhub.ng/storage \
  -e PAGEDJS_PUBLIC_URL=https://bookhub.ng/preview \
  ketty-client-src_server yarn coko-server start-dev
```

### Nginx routing (host)

Nginx is the public entrypoint. Key routes in /etc/nginx/sites-enabled/default:

- /            -> client (5173)
- /graphql     -> server (3000)
- /api         -> server (3000)
- /ws/         -> server websocket (3333) with rewrite
- /preview/previewer/ -> pagedjs (3003) with rewrite
- /preview/    -> flax (3005)
- /books/      -> flax (3005)
- /storage/    -> MinIO (9000)

### Validation checks

- API: curl -k https://bookhub.ng/graphql (POSTs should succeed)
- Web preview: https://bookhub.ng/preview/<user>/<book>/
- PDF preview: https://bookhub.ng/preview/previewer/<id>/index.html
- Flax health: curl http://localhost:3005/healthcheck
- Pagedjs health: curl http://localhost:3003/healthcheck

### Backup

To capture the current state:

```
cd /home/oreva/bookhub
sudo tar -czf our-last-working-state-10-17.tgz ketty-client-src
```
