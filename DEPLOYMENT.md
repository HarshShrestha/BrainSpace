# Deployment guide

This guide describes the implemented Node/Express API, MongoDB database and static Vite frontend. No production infrastructure is provisioned by this repository. The recommended initial topology is one HTTPS hostname, with a reverse proxy serving `frontend/dist` and forwarding `/api/` to one private Node process on port 8000. When AI is enabled, Node starts a local Python subprocess for each RAG request; no Python HTTP listener is required. MongoDB should be a private, backed-up managed service or a separately secured instance. Keeping frontend and API on the same origin is important for the HTTP-only `SameSite=Lax` session cookie; cross-site hosting is not supported by the default cookie configuration.

## 1. Prepare services and secrets

- Provision Node.js 22.12+, Python 3.10+ (standard library only) and MongoDB compatible with Mongoose 9; restrict database network access to the backend host and create a least-privilege database user with TLS enabled for remote connections. Enable backups and test restoring them.
- Choose a DNS hostname and provision HTTPS. Keep Node and MongoDB off the public internet; expose only ports 80/443 on the reverse proxy.
- Store environment variables in the host's secret manager or service environment, not in the repository, logs or frontend bundle:

| Variable | Used by | Example / behavior |
| --- | --- | --- |
| `MONGODB_URI` | backend | Full URI including database name and required TLS options, e.g. a provider-supplied `mongodb+srv://…/brainspace`. Required. |
| `ACCESS_TOKEN_SECRET` | backend | At least 32 random characters; required. Changing it invalidates all sessions. |
| `NODE_ENV` | backend | `production` enables Secure cookies. |
| `PORT` | backend | Defaults to `8000`. Bind/route privately at the infrastructure layer. |
| `CORS_ORIGIN` | backend | Required in production. Exact public frontend origin, e.g. `https://brain.example.com`; comma-separated if multiple trusted origins. No trailing slash. |
| `TRUST_PROXY_HOPS` | backend | Optional integer 1–10; set only to the exact count of trusted reverse proxies. Used for client IP/rate limiting; incorrect values permit spoofing or overly broad throttling. |
| `RAG_PYTHON` | backend | Optional absolute path to the Python 3.10+ executable; defaults to `python3`. |
| `RAG_ENABLED` | backend | Optional; `true` explicitly enables AI indexing and chat. Default off. |
| `OPENAI_API_KEY` | backend | Required when AI is enabled; secret manager only, never frontend. |
| `OPENAI_EMBEDDING_MODEL` | backend | Optional; default `text-embedding-3-small`. Changing it requires reindexing. |
| `OPENAI_CHAT_MODEL` | backend | Optional; default `gpt-4o-mini`; must support Chat Completions structured outputs. |
| `VITE_API_URL` | frontend build | Optional; defaults to `/api`. Build-time and public, never a secret. Prefer the same-origin default. |

Use a secret manager to generate/store the token secret, for example `openssl rand -hex 32`. Never paste actual secrets into documentation. MongoDB credentials and token secrets must not be in the built frontend.

## 2. Build and launch

From a clean checkout of the desired commit:

```bash
npm ci
npm --prefix frontend ci
npm run build
npm --prefix frontend run build
NODE_ENV=production npm start
```

Use a process manager or hosting service to run `node dist/index.js` with its working directory set to the repository root (so `python -m rag.worker` can locate the Python package), with the environment above, restart on failure, and retain structured deployment logs without secrets or share tokens. The API exits if the token secret is weak, the production CORS origin is missing, or MongoDB cannot connect. Configure health checks at `/api/health`; this is a liveness endpoint, not a database connectivity guarantee. Probe an authenticated data workflow separately.

## 3. Route traffic and configure HTTPS

Point the custom domain's DNS record at the proxy; obtain and renew a certificate using your hosting provider or ACME client. Redirect HTTP to HTTPS. For an Nginx deployment, after installing your actual certificate and replacing the paths, hostname and local upstream, the HTTPS server block can use:

```nginx
server {
    listen 443 ssl;
    server_name brain.example.com;
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    root /path/to/BrainSpace/frontend/dist;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Bearer share tokens appear in URLs: disable or redact access logs.
        access_log off;
    }
    location / { try_files $uri $uri/ /index.html; }
}
```

The SPA fallback is required for `/shared/<token>` links. Disable or redact token-bearing paths in **all** upstream logs, tracing, monitoring and analytics, not just Nginx; use a restrictive `Referrer-Policy` (the frontend also sends `no-referrer`). Configure the proxy's HTTP-to-HTTPS redirect and certificate renewal for the chosen host. Check that the real proxy chain matches `TRUST_PROXY_HOPS` and that the frontend hostname exactly matches `CORS_ORIGIN`. Do not rely on CORS as authorization.

## 4. Database and migration precautions

Models create unique indexes on usernames, tag titles, share hashes and share owner; content has an owner/date index. There is no migration or seed framework and no seed data. Back up any existing database before rollout. On a pre-existing deployment, inspect for duplicate usernames, tag titles, link hashes or multiple links per user before building unique indexes; resolve collisions deliberately with a verified backup and a migration plan. New share links are stored as SHA-256 digests; old plaintext link records, if any were manually created, are not compatible and should be reissued with user consent. Test upgrades and index creation on a restored copy first. MongoDB auto-indexing must not be disabled without separately creating the model indexes.

## 5. Verify before admitting users

1. Confirm DNS/certificate and HTTPS redirect; check proxy `/api/health` and SPA deep-link routing.
2. Create a disposable account, save and retrieve a link, filter/search, delete it, sign out and sign back in.
3. Create a share link, open it in a private browser, rotate/revoke it and verify the prior link stops working. Treat the link as a secret: it grants read access to the entire collection.
4. Confirm a second account cannot read/delete the first account's content; verify cookies are Secure, HttpOnly and SameSite=Lax, and disallowed origins cannot mutate state.
5. Confirm the app reconnects after process restart, persists real data in the intended database and does not expose `.env`, MongoDB credentials or signing keys. Remove only the disposable account/data under your approved cleanup procedure.
6. Run `npm audit`, backend and frontend tests, and the browser suite; review dependency alerts and the limitations in `TESTING.md`.

## 6. Operations and rollback

Monitor process restarts, API error rates, database connections/storage, backup success and certificate expiration. Login rate limiting is in-memory per process, not distributed; use a shared rate-limit store or edge protection before running multiple instances. There is no password-reset flow or multi-factor authentication. Logout invalidates all sessions for that user. Share tokens should never appear in logs. Establish alert thresholds and incident-response ownership before production use.

To roll back, restore the previously tested application artifact/commit and its matching environment configuration, restart the service, and check health and critical workflows. Do not blindly restore an old database over newer user data. If a schema/data migration was performed, follow its tested rollback plan or restore a backup only after evaluating data loss and obtaining authorization. Rotating the signing key invalidates all sessions; rotating a share link invalidates the previous link.

## 7. Optional AI search

AI is off by default. Before enabling it, review provider data-handling terms, user consent, spending limits and [RAG_EVALUATION.md](RAG_EVALUATION.md). Set the variables in the backend secret manager and allow outbound HTTPS to the OpenAI API; source fetching also needs outbound HTTP(S) to publicly accessible pages. Prevent access to private, loopback, link-local and cloud-metadata addresses at the network layer as defense in depth; the application validates and pins DNS addresses on each redirect, but should not be the only network control. Do not log prompts, source text, bearer keys, or share tokens. Source excerpts and questions are transmitted to OpenAI; an index stores source chunks and embeddings in MongoDB. Backups retain them until their retention period expires, even if a live index is removed.

The current index is limited to 250 indexed sources per account and performs per-request Python-process cosine ranking, not a scalable vector database. Protect the service from abuse and configure distributed quotas/monitoring before multi-instance or high-volume deployment; the built-in AI rate limit is per-process. Changing the embedding model makes existing indexes incompatible until individually reindexed. There is no automatic refresh of changed websites, transcription, OCR, PDF parsing, or private-site authentication. Treat an unreachable/unsupported source as a request for pasted text, never as verified content. Real model accuracy, production network policy, data retention and costs need staging verification before rollout.
