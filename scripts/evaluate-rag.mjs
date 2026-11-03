/** Live evaluation of a labelled synthetic set. Makes billable provider requests only with explicit opt-in. */
import "dotenv/config";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
if (process.env.RAG_EVAL_ALLOW_PAID !== "true") {
  console.error(
    "Live evaluation can incur charges. Set RAG_EVAL_ALLOW_PAID=true explicitly after reviewing RAG_EVALUATION.md.",
  );
  process.exit(1);
}
if (process.env.RAG_ENABLED !== "true" || !process.env.GEMINI_API_KEY) {
  console.error("Set RAG_ENABLED=true and GEMINI_API_KEY first.");
  process.exit(1);
}
process.env.ACCESS_TOKEN_SECRET =
  "isolated-evaluation-secret-at-least-32-characters";
const { app } = await import("../dist/app.js");
const { Content } = await import("../dist/models/content.model.js");
const { runWorker } = await import("../dist/services/rag/worker.js");
const fixture = JSON.parse(
  await readFile("tests/fixtures/rag-eval.json", "utf8"),
);
const mongo = await MongoMemoryServer.create();
const client = request.agent(app);
const lookup = new Map();
try {
  await mongoose.connect(mongo.getUri("brainspace_eval"));
  const signup = await client
    .post("/api/auth/signup")
    .send({ username: "rageval", password: "temporary-evaluation-password" });
  if (signup.status !== 201) throw new Error(`Signup failed: ${signup.status}`);
  for (const source of fixture.sources) {
    const created = await client.post("/api/content").send({
      title: source.title,
      link: `https://example.com/${source.id}`,
      type: "article",
      tags: [],
    });
    if (created.status !== 201)
      throw new Error(`Create failed: ${created.status}`);
    const id = created.body.data._id;
    lookup.set(id, source.id);
    const indexed = await client
      .post(`/api/assistant/index/${id}`)
      .send({ consent: true, text: source.text });
    if (indexed.status !== 200)
      throw new Error(
        `Index failed for ${source.id}: ${indexed.status} ${indexed.body.message || ""}`,
      );
  }
  const docs = await Content.find({}).select("title link rag").lean();
  const candidates = [];
  for (const d of docs)
    for (const chunk of d.rag.chunks)
      candidates.push({
        id: `S${candidates.length + 1}`,
        contentId: d._id.toString(),
        title: d.title,
        link: d.link,
        text: chunk.text,
        embedding: chunk.embedding,
      });
  const results = [];
  for (const q of fixture.questions) {
    const start = performance.now();
    const ids = await runWorker("evaluate_retrieval", {
      question: q.question,
      candidates,
    });
    const retrieved = [...new Set(ids.map((id) => lookup.get(id)))];
    const relevant = q.relevant;
    const response = await client
      .post("/api/assistant/ask")
      .send({ question: q.question });
    if (response.status !== 200)
      throw new Error(
        `Question ${q.id} failed: ${response.status} ${response.body.message || ""}`,
      );
    const a = response.body.data;
    const correctCitations = a.sources.every((s) => {
      const doc = fixture.sources.find((d) => d.id === lookup.get(s.contentId));
      return doc && doc.text.includes(s.quote);
    });
    const expectedAnswer = q.answerIncludes.every((term) =>
      a.answer.toLowerCase().includes(term),
    );
    const safe = !q.forbidden || !a.answer.includes(q.forbidden);
    results.push({
      id: q.id,
      relevantRetrieval: relevant.length
        ? retrieved.filter((x) => relevant.includes(x)).length / relevant.length
        : null,
      contextPrecision:
        relevant.length && retrieved.length
          ? retrieved.filter((x) => relevant.includes(x)).length /
            retrieved.length
          : null,
      injectionCase: Boolean(q.forbidden),
      correctAbstention: a.abstained === q.shouldAbstain,
      expectedTermsPresent: q.shouldAbstain ? null : expectedAnswer,
      citationsValid: correctCitations && (a.abstained || a.sources.length > 0),
      safe,
      latencyMs: Math.round(performance.now() - start),
    });
  }
  const mean = (values) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const measured = (key) =>
    results
      .map((r) => r[key])
      .filter((v) => v !== null)
      .map(Number);
  const report = {
    note: "Synthetic smoke evaluation, not a production-quality or hallucination-free guarantee. Context precision is relative to labelled relevant sources; keyword checks are not semantic correctness or faithfulness.",
    model: process.env.GEMINI_CHAT_MODEL || "gemini-3.8-flash",
    embeddingModel:
      process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
    cases: results.length,
    recallAt5: mean(measured("relevantRetrieval")),
    contextPrecisionAt5: mean(measured("contextPrecision")),
    abstentionAccuracy: mean(measured("correctAbstention")),
    expectedTermRate: mean(measured("expectedTermsPresent")),
    citationValidity: mean(measured("citationsValid")),
    injectionSafety: mean(
      results.filter((r) => r.injectionCase).map((r) => Number(r.safe)),
    ),
    meanLatencyMs: mean(measured("latencyMs")),
    results,
  };
  console.log(JSON.stringify(report, null, 2));
  if (process.env.RAG_EVAL_REPORT_PATH)
    await writeFile(
      process.env.RAG_EVAL_REPORT_PATH,
      JSON.stringify(report, null, 2) + "\n",
    );
} finally {
  await mongoose.disconnect();
  await mongo.stop();
}
