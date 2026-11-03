# AI search: setup, safeguards and evaluation

## Enable it

1. Install Python 3.10+ (no additional Python packages are needed), and run MongoDB and the BrainSpace API/frontend from the repository root as described in README.md. If needed, set `RAG_PYTHON` to the absolute Python executable path on the backend.
2. In the **backend** `.env` or secret manager set:

```dotenv
RAG_ENABLED=true
OPENAI_API_KEY=<your-server-side-key>
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o-mini
```

The key requires an OpenAI account with access to the selected models, available billing/quota, and network access to `https://api.openai.com`. The model must support Chat Completions structured outputs. Keep the key out of Git, logs, browser code and chat. The two model settings are optional with the shown defaults. After editing the environment, restart the API. Changing the embedding model requires reindexing each source.
3. Save a link. On its card choose **Index for AI**. Paste at least 80 characters of source text, or leave the box empty to fetch a publicly accessible HTML/plain-text page. Read the privacy notice and explicitly consent. The first 24,000 characters are chunked and embedded. Restricted pages, PDFs, images, audio and video are not parsed/transcribed; paste their text or transcript instead. User content, questions and retrieved excerpts are sent to OpenAI and incur usage charges. Indexing is not automatic.
4. Open the floating chat button and ask a question in **Ask your space**. Review the linked sources and quotations; pasted text is labelled and is not verified against the linked page. Extracted content can also become stale; each question is independent, so the chatbot does not resolve follow-up references from earlier messages. Click **Reindex for AI** to refresh changed text or **Remove AI index** to remove indexed chunks/vectors while retaining the saved link. Deleting the link also deletes its live index.

## How it works

The Python RAG worker handles extraction, chunking, embeddings, retrieval, generation and evidence checks. The authenticated Express API scopes MongoDB reads and writes by user and starts the worker through private stdin/stdout; there is no Python HTTP endpoint. Existing indexed data is compatible. Each authenticated user can only index and retrieve their own content. Public page retrieval permits only HTTP(S) on standard ports, validates all DNS answers, pins the connection to a public address and revalidates each redirect. It caps response size and time. An external egress firewall is still required for defense in depth. HTML extraction is best effort, with no JavaScript execution or authenticated browsing.

Text is split into overlapping ~1,000-character chunks. Vectors are stored in the owning content document. Retrieval ranks by cosine similarity, selects up to five chunks with a fixed 0.35 threshold, then asks the chat model to use only those excerpts. The server rejects answers without matching verbatim quotes and asks the model in a separate call to check whether the quotes support the answer. If retrieval, citation validation or support checks fail, the assistant abstains. A provider error is shown rather than fabricated into an answer.

**These measures reduce risk; they do not guarantee truth, completeness, prompt-injection immunity or zero hallucinations.** The checker can make mistakes, the sources themselves can be inaccurate, and exact quotes do not prove entailment. Users should verify citations, especially for consequential decisions. Model output is displayed as text, not executed. Do not treat AI as an authority for medical, legal, financial, safety or other high-stakes decisions.

The implementation is deliberately bounded: 250 indexed sources/account, 24,000 characters/source, 30 chunks/source, per-request Python subprocess ranking, 30 indexing/ask requests per user per 15 minutes **per server process**, 30-second provider timeouts, and a 120-second overall worker deadline. The cosine threshold is a starting heuristic, not a calibrated confidence probability. There is no vector database, OCR, transcription, automatic reindexing, chat memory, streaming or distributed quota. Backups may retain deleted data subject to the operator's policy.

## Test without provider charges

```bash
npm run build && npm test && npm run test:rag
npm --prefix frontend run build && npm --prefix frontend test
```

The deterministic tests cover retrieval and irrelevant-query abstention, fabricated and misattributed quotations, verifier rejection, user isolation, deletion/unindexing, explicit consent, address filtering and provider error contracts. Integration tests use a stubbed provider and temporary MongoDB. They do not establish actual model quality or fully exercise all SSRF/prompt-injection variants.

## Optional live evaluation (billable)

The synthetic labelled fixture is `tests/fixtures/rag-eval.json`. The runner creates a temporary MongoDB, indexes only that synthetic text and calls the configured OpenAI models. It **does not** use real user data. It will refuse to run unless the explicit opt-in environment variable is set. After configuring the key, review costs and run:

```bash
RAG_EVAL_ALLOW_PAID=true npm run eval:rag
# Optional: write the aggregate report to a private local file
RAG_EVAL_ALLOW_PAID=true RAG_EVAL_REPORT_PATH=/path/to/private-report.json npm run eval:rag
```

The JSON report includes source-level recall@5, source-level context precision@5, correct abstention rate, expected-keyword rate, exact citation validity, injection-marker safety and mean latency. Retrieval metrics are computed against the fixture's source labels; the keyword check is a rough proxy, **not** a semantic correctness or faithfulness metric. The latency includes a second embedding call used to measure retrieval. The runner does not calculate monetary costs; use provider usage/billing telemetry. The four synthetic cases are a smoke test, not a statistically meaningful benchmark. No live run is claimed until executed with a valid key.

## Production evaluation plan

Before release, construct a much larger held-out, consented and access-controlled labelled set representative of actual users: relevant and irrelevant sources, paraphrases, multi-document questions, ambiguous/missing evidence, contradictory/outdated sources, multilingual text, prompt-injection attempts, long documents and cross-user access. Measure retrieval recall@k and context precision by labelled source/chunk, answer relevance and correctness, human-rated claim-level faithfulness, citation entailment and validity, refusal/abstention precision and recall, leakage/injection resistance, p50/p95 latency, error rate, token use and cost. Report confidence intervals and slice results by source type and user scenario. Use independent reviewers and adjudicate disagreements; do not use the same model's support check as ground truth. Review failures and calibrate thresholds on a separate development set, then rerun the held-out set. Repeat on model/prompt/chunking changes and monitor privacy-safe aggregates in production. Define release thresholds with product owners; this repo does not assert universal thresholds or that all failure modes have been evaluated.
