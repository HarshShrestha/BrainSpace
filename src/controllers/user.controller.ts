import type { CookieOptions } from 'express';
import { z } from 'zod';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const credentials = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, 'Username must be 3–30 letters, numbers or underscores'),
  password: z.string().min(8).refine(s => Buffer.byteLength(s, 'utf8') <= 72, 'Password is too long'),
});
const cookieOptions = (): CookieOptions => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });
export const signup = asyncHandler(async (req, res) => {
  const data = credentials.parse(req.body);
  if (await User.exists({ username: data.username })) throw new ApiError(409, 'Username is already taken');
  const user = await User.create(data);
  res.cookie('accessToken', user.generateAccessToken(), cookieOptions()).status(201).json({ success: true, data: { id: user.id, username: user.username } });
});
export const login = asyncHandler(async (req, res) => {
  const data = credentials.parse(req.body);
  const user = await User.findOne({ username: data.username }).select('+password +tokenVersion');
  if (!user || !await user.isPasswordCorrect(data.password)) throw new ApiError(401, 'Invalid username or password');
  res.cookie('accessToken', user.generateAccessToken(), cookieOptions()).json({ success: true, data: { id: user.id, username: user.username } });
});
export const logout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.userId }, { $inc: { tokenVersion: 1 } });
  res.clearCookie('accessToken', { ...cookieOptions(), maxAge: undefined }).json({ success: true, data: null });
});
export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).lean();
  if (!user) throw new ApiError(401, 'Please sign in');
  res.json({ success: true, data: { id: user._id, username: user.username } });
});
