import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { app } from "../src/app.js";
import { Content } from "../src/models/content.model.js";
import { Folder } from "../src/models/folder.model.js";
import { moveContent } from "../src/services/content.service.js";

const SECRET = "test-only-secret-with-at-least-32-characters";
const password = "correct horse battery";
let mongo: MongoMemoryServer | undefined;
beforeAll(async () => {
  process.env.ACCESS_TOKEN_SECRET = SECRET;
  const uri =
    process.env.TEST_MONGODB_URI ||
    (mongo = await MongoMemoryServer.create()).getUri();
  await mongoose.connect(uri, {
    dbName: `brainspace_regressions_${randomUUID().replaceAll("-", "")}`,
  });
  await Promise.all(mongoose.modelNames().map((m) => mongoose.model(m).init()));
}, 120000);
afterAll(async () => {
  if (mongoose.connection.readyState === 1)
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongo?.stop();
});
async function account() {
  const agent = request.agent(app);
  const username = `u_${randomUUID().slice(0, 8)}`;
  const res = await agent.post("/api/auth/signup").send({ username, password });
  expect(res.status).toBe(201);
  return { agent, id: res.body.data.id as string };
}
const clearsCookie = (res: request.Response) =>
  ((res.headers["set-cookie"] as unknown as string[] | undefined) || []).some(
    (c) => c.startsWith("accessToken=;"),
  );

describe("sessions", () => {
  it("clears the cookie on logout even when the session is expired or revoked", async () => {
    const { id } = await account();
    const expired = jwt.sign(
      { _id: id, sv: 0, exp: Math.floor(Date.now() / 1000) - 10 },
      SECRET,
    );
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `accessToken=${expired}`);
    expect(res.status).toBe(200);
    expect(clearsCookie(res)).toBe(true);
    const anonymous = await request(app).post("/api/auth/logout");
    expect(anonymous.status).toBe(200);
  });
  it("still revokes every session when logging out with a valid one", async () => {
    const { agent } = await account();
    const cookie = (await agent.get("/api/auth/me")).request.cookies;
    expect(cookie).toContain("accessToken=");
    expect((await agent.post("/api/auth/logout")).status).toBe(200);
    expect(
      (await request(app).get("/api/auth/me").set("Cookie", cookie)).status,
    ).toBe(401);
  });
  it("rejects a signed token with a non-ObjectId user id as 401, not 500", async () => {
    const token = jwt.sign({ _id: "not-an-object-id", sv: 0 }, SECRET);
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe("folders", () => {
  it("treats folder names as unique regardless of case", async () => {
    const { agent } = await account();
    expect((await agent.post("/api/folders").send({ name: "Research" })).status).toBe(201);
    const dup = await agent.post("/api/folders").send({ name: "research" });
    expect(dup.status).toBe(409);
    expect((await agent.post("/api/folders").send({ name: "R.search" })).status).toBe(201);
  });
  it("does not leave an item in a folder deleted mid-move", async () => {
    const { agent, id: userId } = await account();
    const folder = (await agent.post("/api/folders").send({ name: "Gone" })).body.data._id;
    const item = (
      await agent.post("/api/content").send({ title: "x", link: "https://e.com", type: "article" })
    ).body.data._id;
    // Simulate losing the race: the folder disappears after moveContent's existence check.
    const original = Folder.exists.bind(Folder);
    let calls = 0;
    Folder.exists = ((filter: object) => {
      calls++;
      return calls === 1 ? original(filter) : Promise.resolve(null);
    }) as typeof Folder.exists;
    try {
      await expect(moveContent(userId, item, folder)).rejects.toMatchObject({ statusCode: 404 });
    } finally {
      Folder.exists = original;
    }
    expect((await Content.findById(item).lean())?.folderId).toBeNull();
  });
  it("returns items moved in concurrently to the root when a folder is deleted", async () => {
    const { agent, id: userId } = await account();
    const folder = (await agent.post("/api/folders").send({ name: "Temp" })).body.data._id;
    const item = (
      await agent.post("/api/content").send({ title: "x", link: "https://e.com", type: "article" })
    ).body.data._id;
    const originalExists = Content.exists.bind(Content);
    // Emptiness check passes, then the item lands in the folder before deletion.
    Content.exists = (async () => {
      await Content.updateOne({ _id: item, userId }, { $set: { folderId: folder } });
      return null;
    }) as unknown as typeof Content.exists;
    try {
      expect((await agent.delete(`/api/folders/${folder}`)).status).toBe(200);
    } finally {
      Content.exists = originalExists;
    }
    expect((await Content.findById(item).lean())?.folderId).toBeNull();
  });
});

describe("tags", () => {
  it("keeps tags private to each account", async () => {
    const a = await account();
    const b = await account();
    const tag = `t${randomUUID().slice(0, 6)}`;
    const ta = await a.agent.post("/api/content").send({ title: "a", link: "https://a.com", type: "article", tags: [tag] });
    const tb = await b.agent.post("/api/content").send({ title: "b", link: "https://b.com", type: "article", tags: [tag] });
    expect(ta.body.data.tags[0].title).toBe(tag);
    expect(tb.body.data.tags[0].title).toBe(tag);
    expect(ta.body.data.tags[0]._id).not.toBe(tb.body.data.tags[0]._id);
  });
});

describe("share status codes", () => {
  it("returns 201 on first save, 200 with the same id on re-save", async () => {
    const owner = await account();
    const viewer = await account();
    const { token } = (await owner.agent.post("/api/share")).body.data;
    const url = `https://brainspace.example/shared/${token}`;
    const first = await viewer.agent.post("/api/received-shares").send({ url });
    const again = await viewer.agent.post("/api/received-shares").send({ url });
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body.data.id).toBe(first.body.data.id);
  });
  it("returns 404 when revoking without an active link", async () => {
    const { agent } = await account();
    expect((await agent.delete("/api/share")).status).toBe(404);
    await agent.post("/api/share");
    expect((await agent.delete("/api/share")).status).toBe(200);
  });
});

describe("rate limits", () => {
  it("does not let failed sign-ins block account creation", async () => {
    for (let i = 0; i < 31; i++)
      await request(app).post("/api/auth/login").send({ username: "nobody_here", password: "wrong-password" });
    const login = await request(app).post("/api/auth/login").send({ username: "nobody_here", password: "wrong-password" });
    expect(login.status).toBe(429);
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({ username: `fresh_${randomUUID().slice(0, 6)}`, password });
    expect(signup.status).toBe(201);
  });
});
