# Development

## Architecture

The root is the Express/TypeScript API. `src/routes` maps endpoints, `src/controllers` validates input and shapes responses, `src/services` implements reusable data operations, `src/models` defines Mongoose schemas, `src/middlewares` authenticates requests, and `src/app.ts` configures middleware and centralized errors. `src/index.ts` checks configuration, connects MongoDB, then starts the server. Existing history and Mongoose models are retained.

The Vite application lives in `frontend/`: `features/` groups auth, content and sharing UI; `components/` contains shared UI; `services/api.ts` centralizes requests; `store/state.ts` contains Recoil atoms; `types/` holds shared TypeScript types. UI and API are developed independently and connected through `/api` (Vite proxies it to port 8000).

## API contract

All endpoints return `{ success, data }` on success or `{ success: false, message }` on failure. JSON requests use same-origin cookies (`credentials: include`).

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create account; `{username,password}`; sets session cookie |
| POST | `/api/auth/login` | Authenticate and set cookie |
| POST | `/api/auth/logout` | Require authentication, invalidate all current user sessions, clear cookie |
| GET | `/api/auth/me` | Current user |
| GET, POST | `/api/content` | List own items; create `{title,link,type,tags}` |
| DELETE | `/api/content/:id` | Delete own item |
| POST, DELETE | `/api/share` | Rotate/create or revoke own share token |
| GET | `/api/share/:token` | Public read-only shared collection |
| GET | `/api/assistant/status` | Configured status and indexed/compatible source counts |
| POST, DELETE | `/api/assistant/index/:id` | Explicitly index or remove the owner’s source index |
| POST | `/api/assistant/ask` | Answer from the owner’s index with quoted sources or abstain |
| GET | `/api/health` | Process liveness (not a database health check) |

Allowed content types: `article`, `video`, `audio`, `image`. Links must use HTTP(S); tags are normalized to lowercase. Lists are currently unpaginated, in line with the source product notes. Avoid logging URLs containing share tokens. The public link exposes the owner's username and all content, including tags; revocation immediately stops access.

## Workflow and conventions

Install and run commands are in [README.md](README.md). Branch from the current main branch, make a focused change, run the relevant suites, inspect the diff and commit a coherent milestone. Keep application/API code in TypeScript and RAG pipeline code in Python; prefer small domain-oriented components, keep network requests in `services/api.ts`, validate untrusted inputs at API boundaries, and scope every private database query to the authenticated user. Do not use Redux. Recoil atoms hold the current user and content list; local ephemeral form/dialog state stays local. Make writes through the API and update atom state only after success.

For a feature: define and validate the API contract, add a service or model as needed, add the API route and owner checks, connect the frontend service and components, and test success, errors and authorization. Add new environment variables to `.env.example` and document them in the deployment guide. Never store secrets in source or the frontend. Keep tests near frontend components and in `tests/` for API/browser workflows.

```bash
npm run dev                       # backend watch mode
npm --prefix frontend run dev     # frontend dev server
npm run build && npm test         # backend compile and integration tests
npm run test:rag                  # Python retrieval and safety tests
npm --prefix frontend run build && npm --prefix frontend test
npm run test:e2e                  # built app, isolated DB and browser
```

Recoil 0.7.7's peer range permits React 18; this project pins React 18.3.1 rather than assuming React 19 compatibility. Recoil's ecosystem is mature and should be reviewed before any major React upgrade; replacing it requires an explicit product decision.

## AI retrieval

The opt-in RAG pipeline lives in `rag/` (Python standard library): safe public page extraction, overlapping chunking, Gemini embeddings, cosine retrieval, structured grounded generation, exact-quote validation and a separate model support-check. Express authenticates users and scopes MongoDB reads and writes in `src/services/rag/assistant.service.ts`, then starts a private Python subprocess over stdin/stdout through `worker.ts`; no additional network port is exposed. Start the API from the repository root so Python can import the `rag` package. Set `RAG_PYTHON` to the Python 3.10+ executable if `python3` is not on PATH. The source text and vectors are stored under the owning Content record; deleting a source or removing its index removes them from the live database. Existing MongoDB index format is unchanged. The frontend provides explicit consent and shows source quotations. The assistant opens as the main workspace, with saved sources and indexing controls in the sidebar; Google Material Symbols are self-hosted in `frontend/src/assets` with their license. Follow [RAG_EVALUATION.md](RAG_EVALUATION.md) before claiming quality or enabling production usage. No provider key belongs in frontend code.

## Folders and shared spaces

Folders are account-owned and single-level; items have an optional folder reference. Moving is scoped to the owner; folders must be empty before deletion. Shared with me stores a hash of a manually pasted BrainSpace share link per recipient. It is read-only, does not import files or grant edit access, and becomes unavailable on owner revocation or rotation. The full workspace chat lists the user’s own sources in its sidebar. The theme is stored locally in the browser.
