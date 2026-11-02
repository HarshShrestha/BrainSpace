import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { app } from '../src/app.js';
let mongo: MongoMemoryServer | undefined;
const alice = request.agent(app), bob = request.agent(app);
let itemId = '', token = '';
beforeAll(async () => {
  process.env.ACCESS_TOKEN_SECRET = 'test-only-secret-with-at-least-32-characters';
  const uri = process.env.TEST_MONGODB_URI || (mongo = await MongoMemoryServer.create()).getUri();
  await mongoose.connect(uri, { dbName: `brainspace_test_${randomUUID().replaceAll('-', '')}` });
}, 120000);
afterAll(async () => { if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); await mongo?.stop(); });
describe('BrainSpace API', () => {
  it('rejects anonymous access and invalid registrations', async () => {
    expect((await request(app).get('/api/content')).status).toBe(401);
    expect((await alice.post('/api/auth/signup').send({ username: '!', password: 'short' })).status).toBe(400);
  });
  it('registers users and does not leak passwords', async () => {
    const a = await alice.post('/api/auth/signup').send({ username: 'alice', password: 'correct horse battery' });
    expect(a.status).toBe(201); expect(a.body.data.password).toBeUndefined();
    expect((await bob.post('/api/auth/signup').send({ username: 'bob', password: 'another password' })).status).toBe(201);
    expect((await request(app).post('/api/auth/signup').send({ username: 'alice', password: 'correct horse battery' })).status).toBe(409);
  });
  it('validates URLs and creates and lists tagged content', async () => {
    expect((await alice.post('/api/content').send({ title: 'Bad', link: 'javascript:alert(1)', type: 'article' })).status).toBe(400);
    const result = await alice.post('/api/content').send({ title: 'A useful article', link: 'https://example.com/story', type: 'article', tags: ['Ideas', 'ideas'] });
    expect(result.status).toBe(201); itemId = result.body.data._id;
    expect(result.body.data.tags).toHaveLength(1);
    expect((await alice.get('/api/content')).body.data).toHaveLength(1);
    expect((await bob.get('/api/content')).body.data).toHaveLength(0);
  });
  it('enforces ownership on delete', async () => {
    expect((await bob.delete(`/api/content/${itemId}`)).status).toBe(404);
    expect((await alice.delete('/api/content/not-an-id')).status).toBe(400);
    expect((await alice.get('/api/content')).body.data).toHaveLength(1);
  });
  it('creates, rotates and revokes share links', async () => {
    token = (await alice.post('/api/share')).body.data.token;
    const shared = await request(app).get(`/api/share/${token}`);
    expect(shared.status).toBe(200); expect(shared.body.data.username).toBe('alice');
    expect(shared.body.data.content).toHaveLength(1); expect(shared.body.data.content[0].userId).toBeUndefined();
    const next = (await alice.post('/api/share')).body.data.token;
    expect((await request(app).get(`/api/share/${token}`)).status).toBe(404);
    expect((await request(app).get(`/api/share/${next}`)).status).toBe(200);
    await alice.delete('/api/share'); expect((await request(app).get(`/api/share/${next}`)).status).toBe(404);
  });
  it('deletes content, logs out, and rejects wrong credentials', async () => {
    expect((await alice.delete(`/api/content/${itemId}`)).status).toBe(200);
    expect((await alice.get('/api/content')).body.data).toHaveLength(0);
    const signedIn = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'correct horse battery' });
    const stolenCookie = signedIn.headers['set-cookie'][0].split(';')[0];
    await alice.post('/api/auth/logout'); expect((await alice.get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Cookie', stolenCookie)).status).toBe(401);
    expect((await alice.post('/api/auth/login').send({ username: 'alice', password: 'wrong password' })).status).toBe(401);
    expect((await alice.post('/api/auth/login').send({ username: 'alice', password: 'correct horse battery' })).status).toBe(200);
  });
  it('rejects untrusted browser origins for mutations', async () => {
    expect((await alice.post('/api/content').set('Origin', 'https://evil.example').send({})).status).toBe(403);
  });
});
