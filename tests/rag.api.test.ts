import { beforeAll, afterAll, describe, it, expect } from "vitest";
import path from "node:path";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { app } from "../src/app.js";
let mongo: MongoMemoryServer | undefined;
const alice = request.agent(app),
  bob = request.agent(app);
let id = "";
const fact =
  "The project uses blue cards for each source. The cards are arranged in a generous grid for a calm reading experience. ".repeat(
    3,
  );
beforeAll(async () => {
  process.env.PYTHONPATH = path.resolve("tests/python_stubs");
  process.env.ACCESS_TOKEN_SECRET =
    "test-only-secret-with-at-least-32-characters";
  process.env.RAG_ENABLED = "true";
  process.env.OPENAI_API_KEY = "test-only";
  process.env.OPENAI_EMBEDDING_MODEL = "test-model";
  const uri =
    process.env.TEST_MONGODB_URI ||
    (mongo = await MongoMemoryServer.create()).getUri();
  await mongoose.connect(uri, {
    dbName: `brainspace_rag_test_${randomUUID().replaceAll("-", "")}`,
  });
}, 120000);
afterAll(async () => {
  if (mongoose.connection.readyState === 1)
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongo?.stop();
  delete process.env.PYTHONPATH;
  delete process.env.RAG_ENABLED;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_EMBEDDING_MODEL;
});
describe("RAG API integration (Python pipeline, provider stub only)", () => {
  it("authenticates users and requires explicit indexing consent", async () => {
    expect(
      (
        await request(app)
          .post("/api/assistant/ask")
          .send({ question: "What is this?" })
      ).status,
    ).toBe(401);
    await alice
      .post("/api/auth/signup")
      .send({ username: "ragalice", password: "correct horse battery" });
    await bob
      .post("/api/auth/signup")
      .send({ username: "ragbob", password: "correct horse battery" });
    id = (
      await alice.post("/api/content").send({
        title: "Design notes",
        link: "https://example.com",
        type: "article",
        tags: [],
      })
    ).body.data._id;
    expect(
      (await alice.post(`/api/assistant/index/${id}`).send({ text: fact }))
        .status,
    ).toBe(400);
    expect(
      (
        await bob
          .post(`/api/assistant/index/${id}`)
          .send({ consent: true, text: fact })
      ).status,
    ).toBe(404);
  });
  it("returns a safe error when Python is unavailable", async () => {
    process.env.RAG_PYTHON = "/definitely/missing/python3";
    try {
      const result = await alice
        .post(`/api/assistant/index/${id}`)
        .send({ consent: true, text: fact });
      expect(result.status).toBe(503);
      expect(result.body.message).toMatch(/Python AI service is unavailable/);
    } finally {
      delete process.env.RAG_PYTHON;
    }
  });
  it("indexes user-supplied text without exposing vectors through content list or sharing", async () => {
    const result = await alice
      .post(`/api/assistant/index/${id}`)
      .send({ consent: true, text: fact });
    expect(result.status).toBe(200);
    expect(
      (await alice.get("/api/assistant/status")).body.data.compatible,
    ).toBe(1);
    const list = (await alice.get("/api/content")).body.data;
    expect(list[0].rag.chunks).toBeUndefined();
    const token = (await alice.post("/api/share")).body.data.token;
    const shared = (await request(app).get(`/api/share/${token}`)).body.data;
    expect(shared.content[0].rag).toBeUndefined();
    expect(JSON.stringify(shared)).not.toContain(fact);
  });
  it("answers with verified real source excerpts only and isolates users", async () => {
    const reply = await alice
      .post("/api/assistant/ask")
      .send({ question: "What does the project use?" });
    expect(reply.status).toBe(200);
    expect(reply.body.data.abstained).toBe(false);
    expect(reply.body.data.sources[0].quote).toBe(
      "The project uses blue cards for each source.",
    );
    expect(reply.body.data.sources[0].sourceType).toBe("pasted");
    expect(
      (
        await bob
          .post("/api/assistant/ask")
          .send({ question: "What does the project use?" })
      ).body.data.abstained,
    ).toBe(true);
  });
  it("abstains for irrelevant retrieval, fabricated evidence, and failed verification", async () => {
    for (const question of [
      "unrelated question",
      "invent a citation",
      "unsupported claim",
    ])
      expect(
        (await alice.post("/api/assistant/ask").send({ question })).body.data
          .abstained,
      ).toBe(true);
  });
  it("lets owners remove the AI index without deleting their saved link", async () => {
    expect((await bob.delete(`/api/assistant/index/${id}`)).status).toBe(404);
    expect((await alice.delete(`/api/assistant/index/${id}`)).status).toBe(200);
    expect((await alice.get("/api/content")).body.data).toHaveLength(1);
    expect((await alice.get("/api/assistant/status")).body.data.indexed).toBe(
      0,
    );
    expect(
      (
        await alice
          .post(`/api/assistant/index/${id}`)
          .send({ consent: true, text: fact })
      ).status,
    ).toBe(200);
  });
  it("deletion removes indexed evidence and forbids subsequent access", async () => {
    await alice.delete(`/api/content/${id}`);
    expect((await alice.get("/api/assistant/status")).body.data.indexed).toBe(
      0,
    );
    expect(
      (
        await alice
          .post("/api/assistant/ask")
          .send({ question: "What does the project use?" })
      ).body.data.abstained,
    ).toBe(true);
  });
});
