# BrainSpace

A quiet place for the links and ideas you want to keep. BrainSpace brings articles, documents, videos, audio and images together in a personal, searchable collection—and lets you share a read-only view when you choose.

![BrainSpace workspace](docs/screenshots/workspace.png)

<details><summary>Mobile view</summary>

![BrainSpace on mobile](docs/screenshots/mobile.png)

</details>

Screenshots use sample data created by the automated browser test.

## Features

- Create an account and sign in with a username and password.
- Save HTTP(S) links with a title, type and optional tags; browse, search and filter them.
- Remove saved items. Each account can access only its own collection.
- Create a revocable, read-only link to your entire collection. Anyone possessing the link can view it; creating a new one invalidates the old one.
- Responsive interface, keyboard-accessible dialogs, loading, empty and error states.

Search currently matches saved titles, URLs and tags in the browser; it does not index the contents of external pages. Semantic/embedding search is a possible future enhancement, not an implemented feature. Editing saved items, password recovery and collections are not currently implemented.

## Stack and architecture

React 18, TypeScript, Vite and Recoil in `frontend/`; TypeScript, Express, Mongoose and MongoDB in `src/`. A same-origin reverse proxy serves the frontend and routes `/api` to the API. Authentication uses bcrypt and a signed, HTTP-only cookie. MongoDB holds users, content, tags and hashed sharing tokens. See [DEVELOPMENT.md](DEVELOPMENT.md).

## Local setup

Prerequisites: Node.js 22.12+ and npm, and a running MongoDB instance. From the repository root:

```bash
npm ci
npm --prefix frontend ci
cp .env.example .env
```

Set `MONGODB_URI` to your MongoDB URI and replace `ACCESS_TOKEN_SECRET` in `.env` with at least 32 random characters. Leave `CORS_ORIGIN=http://localhost:5173` for the default Vite development server. Do not commit `.env`.

```bash
# Terminal 1: API on http://localhost:8000
npm run dev
# Terminal 2: frontend on http://localhost:5173 (proxies /api to the API)
npm --prefix frontend run dev
```

Visit `http://localhost:5173` and create an account. Set `PORT`, `CORS_ORIGIN`, or the optional `TRUST_PROXY_HOPS` on the backend as needed; the default Vite dev proxy expects port 8000. For other deployments, the frontend's optional build-time `VITE_API_URL` defaults to `/api`.

## Build and test

```bash
npm run build && npm test
npm --prefix frontend run build && npm --prefix frontend test
npx playwright install chromium  # one-time, if Chromium is not already available
npm run test:e2e
```

MongoDB integration tests use an isolated temporary database and may download a MongoDB binary on first use. See [TESTING.md](TESTING.md) for prerequisites, browser configuration, and coverage limitations. For production configuration, security, migrations and rollback, see [DEPLOYMENT.md](DEPLOYMENT.md).
