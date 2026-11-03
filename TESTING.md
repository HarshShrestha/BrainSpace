# Testing

## Tools and scope

- **API:** Vitest, Supertest and `mongodb-memory-server` in `tests/api.test.ts`, exercising real Express handlers and MongoDB. Tests cover account creation and login, invalid inputs, authorization/owner isolation, content creation/list/deletion, link rotation/revocation, public retrieval, origin rejection and session invalidation.
- **Frontend:** Vitest, jsdom and React Testing Library in `frontend/src/**/*.test.tsx` cover content form submission/error/escape, list/empty/delete behavior and authentication-driven Recoil updates.
- **Browser:** `tests/e2e.mjs` uses Playwright, the built frontend, the built API and an isolated temporary MongoDB. It exercises registration, saving, indexing, cited chat, index removal, search, read-only sharing, revocation, deletion, logout/login and a mobile-width overflow check. Python OpenAI HTTP calls are intercepted by a test-only stub; no real provider is tested. The screenshots in `docs/screenshots` were generated from this isolated test. Set `SCREENSHOT_DIR=docs/screenshots` when deliberately refreshing them; normal test runs do not alter tracked screenshots.

## Commands

```bash
npm ci
npm --prefix frontend ci
npm run build
npm test
npm run test:rag
npm --prefix frontend run build
npm --prefix frontend test
npx playwright install chromium
npm run test:e2e
```

For a local system Chromium binary instead of the Playwright-managed browser:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:e2e
```

The MongoDB test server can download a MongoDB binary the first time and needs supported OS libraries and network access. API integration tests can instead use `TEST_MONGODB_URI`; a randomly named test database is created and dropped, so the supplied account must be allowed to create and drop that isolated database. Do not supply a production connection. Browser tests always use a temporary MongoDB server and bind dynamically selected localhost ports. Stop other test runs before regenerating shared screenshots.

## Expectations and known gaps

New behavior should include focused success, invalid-input, authorization and error cases. Run the full commands above before release. There is no enforced numerical coverage threshold yet; coverage is not equivalent to security assurance. Tests do not yet include exhaustive keyboard/screen-reader audits, large-scale performance tests, real external hosted MongoDB, real TLS/reverse-proxy infrastructure, or all browser engines. The browser test checks one desktop and one mobile viewport; manual accessibility and cross-browser checks are still recommended.

## RAG evaluation

`npm run test:rag` runs Python standard-library unit tests for retrieval, citations, address filtering and provider validation. `npm test` runs authenticated/isolated API integration tests against the actual Python subprocess with a test-only provider stub. These are automated regression checks, **not** proof of answer quality with a real model. The optional `npm run eval:rag` uses a small labelled synthetic set and real billable model calls only when explicitly enabled with `RAG_EVAL_ALLOW_PAID=true`; no live model evaluation has been run by default. See [RAG_EVALUATION.md](RAG_EVALUATION.md) for setup, metrics, limitations and a production evaluation plan. Frontend tests use mocked API responses and do not establish real provider compatibility.
