import { createHash, randomBytes } from 'node:crypto';
import { Link } from '../models/link.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listContent } from '../services/content.service.js';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export const create = asyncHandler(async (req, res) => {
  const token = randomBytes(32).toString('base64url');
  await Link.findOneAndUpdate({ userId: req.userId! }, { hash: digest(token) }, { upsert: true, returnDocument: 'after' });
  res.status(201).json({ success: true, data: { token } });
});
export const revoke = asyncHandler(async (req, res) => { await Link.deleteOne({ userId: req.userId! }); res.json({ success: true, data: null }); });
export const view = asyncHandler(async (req, res) => {
  const token = String(req.params.token);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(404, 'Shared brain not found');
  const link = await Link.findOne({ hash: digest(token) }).lean();
  if (!link) throw new ApiError(404, 'Shared brain not found');
  const owner = await User.findById(link.userId).select('username').lean();
  if (!owner) throw new ApiError(404, 'Shared brain not found');
  const items = await listContent(link.userId.toString());
  res.json({ success: true, data: { username: owner.username, content: items.map(({ title, link: url, type, tags, createdAt, _id }) => ({ _id, title, link: url, type, tags, createdAt })) } });
});
